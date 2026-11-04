// Git and GitHub functions for the source control panel.
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { GitFile, GitFileStatus, GitHubAccount, GitStatus } from '../shared/types'
import { t } from './i18n'

// Git must never ask for passwords interactively – otherwise the call hangs.
// GIT_ASKPASS=true returns empty answers, so authentication fails immediately.
const GIT_ENV = { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: 'true', GCM_INTERACTIVE: 'never' }

function git(cwd: string, args: string[], input?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile('git', args, { cwd, env: GIT_ENV, maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error((stderr || stdout || err.message).trim()))
      else resolve(stdout)
    })
    if (input !== undefined) child.stdin?.end(input)
  })
}

const tryGit = (cwd: string, args: string[]): Promise<string | null> => git(cwd, args).catch(() => null)

function mapStatus(x: string, y: string): GitFileStatus {
  if (x === '?' && y === '?') return 'untracked'
  if (x === 'U' || y === 'U' || (x === 'A' && y === 'A') || (x === 'D' && y === 'D')) return 'conflict'
  if (x === 'R' || x === 'C') return 'renamed'
  if (x === 'A') return 'added'
  if (x === 'D' || y === 'D') return 'deleted'
  return 'modified'
}

export async function status(dir: string): Promise<GitStatus> {
  const top = (await tryGit(dir, ['rev-parse', '--show-toplevel']))?.trim()
  if (!top) return { isRepo: false }

  const out = await git(top, ['status', '--porcelain=v1', '-z', '-b', '--untracked-files=all'])
  const parts = out.split('\0')
  let branch = 'main'
  let upstream: string | null = null
  let ahead = 0
  let behind = 0
  const files: GitFile[] = []

  for (let i = 0; i < parts.length; i++) {
    const line = parts[i]
    if (!line) continue
    if (line.startsWith('## ')) {
      // e.g. "## main...origin/main [ahead 1, behind 2]" or "## No commits yet on main"
      const head = line.slice(3)
      const noCommits = head.match(/^No commits yet on (.+)$/)
      if (noCommits) branch = noCommits[1]
      else {
        const m = head.match(/^(.+?)(?:\.\.\.(\S+))?(?: \[(.+)\])?$/)
        if (m) {
          branch = m[1]
          upstream = m[2] ?? null
          ahead = Number(m[3]?.match(/ahead (\d+)/)?.[1] ?? 0)
          behind = Number(m[3]?.match(/behind (\d+)/)?.[1] ?? 0)
        }
      }
      continue
    }
    const x = line[0]
    const y = line[1]
    const rel = line.slice(3)
    // For renames the old path follows as its own entry
    if (x === 'R' || x === 'C') i++
    files.push({ path: join(top, rel), rel, status: mapStatus(x, y) })
  }

  const [hasHead, remoteUrl, name, email] = await Promise.all([
    tryGit(top, ['rev-parse', '--verify', 'HEAD']),
    tryGit(top, ['remote', 'get-url', 'origin']),
    tryGit(top, ['config', 'user.name']),
    tryGit(top, ['config', 'user.email'])
  ])

  return {
    isRepo: true,
    root: top,
    branch,
    hasCommits: hasHead !== null,
    upstream,
    ahead,
    behind,
    remoteUrl: remoteUrl?.trim() || null,
    files,
    identity: name?.trim() && email?.trim() ? { name: name.trim(), email: email.trim() } : null
  }
}

export async function init(dir: string): Promise<void> {
  await git(dir, ['init', '-b', 'main'])
}

/** Commits exactly the given files (including new and deleted ones). */
export async function commit(dir: string, message: string, paths: string[]): Promise<void> {
  if (!message.trim()) throw new Error(t('Please enter a commit message.'))
  if (paths.length === 0) throw new Error(t('No files selected.'))
  await git(dir, ['add', '-A', '--', ...paths])
  await git(dir, ['commit', '-m', message, '--', ...paths])
}

export async function push(dir: string): Promise<void> {
  const s = await status(dir)
  if (!s.isRepo) throw new Error(t('Not a Git repository.'))
  if (!s.remoteUrl) throw new Error(t('No remote set up – connect a GitHub repository first.'))
  try {
    await git(dir, s.upstream ? ['push'] : ['push', '-u', 'origin', 'HEAD'])
  } catch (err) {
    throw friendlyAuthError(err)
  }
}

export async function pull(dir: string): Promise<void> {
  try {
    await git(dir, ['pull', '--no-rebase', '--no-edit'])
  } catch (err) {
    throw friendlyAuthError(err)
  }
}

function friendlyAuthError(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err)
  if (/Authentication failed|could not read Username|terminal prompts disabled|403|401/i.test(msg)) {
    return new Error(t('GitHub sign-in failed. Connect your GitHub account in the Git panel.') + '\n\n' + msg)
  }
  return err instanceof Error ? err : new Error(msg)
}

export async function setRemote(dir: string, url: string): Promise<void> {
  const existing = await tryGit(dir, ['remote', 'get-url', 'origin'])
  await git(dir, existing ? ['remote', 'set-url', 'origin', url] : ['remote', 'add', 'origin', url])
}

export async function setIdentity(dir: string, name: string, email: string): Promise<void> {
  // Global, so it applies to all projects
  await git(dir, ['config', '--global', 'user.name', name])
  await git(dir, ['config', '--global', 'user.email', email])
}

// ---------- GitHub ----------
// The token is stored in the system keychain (via Git's credential helper).

const CRED = 'protocol=https\nhost=github.com\n'

async function storedToken(): Promise<string | null> {
  const out = await git(process.cwd(), ['credential', 'fill'], CRED + '\n').catch(() => null)
  return out?.match(/^password=(.+)$/m)?.[1] || null
}

async function api<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {})
    }
  })
  const body = (await res.json().catch(() => ({}))) as T & { message?: string; errors?: { message?: string }[] }
  if (!res.ok) {
    const detail = body.errors?.map((e) => e.message).filter(Boolean).join(', ')
    throw new Error(`GitHub: ${body.message ?? res.statusText}${detail ? ` (${detail})` : ''}`)
  }
  return body
}

interface GhUser {
  login: string
  id: number
  name: string | null
  avatar_url: string
}

const toAccount = (u: GhUser): GitHubAccount => ({ login: u.login, name: u.name, avatarUrl: u.avatar_url })

export async function account(): Promise<GitHubAccount | null> {
  const token = await storedToken()
  if (!token) return null
  try {
    return toAccount(await api<GhUser>(token, '/user'))
  } catch {
    return null
  }
}

/**
 * Without a credential helper Git cannot store the token. On the Mac there is the keychain,
 * on Linux the GNOME/KDE keyring via libsecret – if that is missing, Git uses a file.
 */
async function ensureCredentialHelper(cwd: string): Promise<void> {
  const current = (await tryGit(cwd, ['config', '--get', 'credential.helper']))?.trim()
  if (current) return
  if (process.platform === 'darwin') {
    await git(cwd, ['config', '--global', 'credential.helper', 'osxkeychain'])
    return
  }
  const execPath = (await tryGit(cwd, ['--exec-path']))?.trim()
  const libsecret = execPath && existsSync(join(execPath, 'git-credential-libsecret'))
  await git(cwd, ['config', '--global', 'credential.helper', libsecret ? 'libsecret' : 'store'])
}

/** Where the token is stored – for the hint in the UI */
export async function credentialStorage(): Promise<string> {
  const helper = (await tryGit(process.cwd(), ['config', '--get', 'credential.helper']))?.trim()
  if (helper === 'osxkeychain' || (!helper && process.platform === 'darwin')) return t('in the macOS keychain')
  if (helper === 'libsecret') return t('in the keyring of your Linux desktop (libsecret)')
  if (helper === 'store' || !helper) return t('in the file ~/.git-credentials (unencrypted – install libsecret for more security)')
  return t('via the Git credential helper “{helper}”', { helper })
}

export async function connect(token: string): Promise<GitHubAccount> {
  token = token.trim()
  const user = await api<GhUser>(token, '/user').catch(() => {
    throw new Error(t('The token is invalid or expired.'))
  })
  const cwd = process.cwd()
  await ensureCredentialHelper(cwd)
  // Replace the old entry, then store the new one in the keychain
  await git(cwd, ['credential', 'reject'], CRED + '\n').catch(() => undefined)
  await git(cwd, ['credential', 'approve'], `${CRED}username=${user.login}\npassword=${token}\n\n`)

  // Set up the commit author if none is set yet
  const name = await tryGit(cwd, ['config', '--global', 'user.name'])
  const email = await tryGit(cwd, ['config', '--global', 'user.email'])
  if (!name?.trim()) await git(cwd, ['config', '--global', 'user.name', user.name || user.login])
  if (!email?.trim()) await git(cwd, ['config', '--global', 'user.email', `${user.id}+${user.login}@users.noreply.github.com`])

  return toAccount(user)
}

export async function disconnect(): Promise<void> {
  await git(process.cwd(), ['credential', 'reject'], CRED + '\n')
}

/** Creates a new GitHub repository, links it as origin and pushes the code. */
export async function publish(dir: string, name: string, isPrivate: boolean): Promise<string> {
  const token = await storedToken()
  if (!token) throw new Error(t('Connect your GitHub account first.'))
  const repo = await api<{ clone_url: string; html_url: string }>(token, '/user/repos', {
    method: 'POST',
    body: JSON.stringify({ name, private: isPrivate })
  })
  await setRemote(dir, repo.clone_url)
  const s = await status(dir)
  if (s.isRepo && s.hasCommits) await git(dir, ['push', '-u', 'origin', 'HEAD'])
  return repo.html_url
}
