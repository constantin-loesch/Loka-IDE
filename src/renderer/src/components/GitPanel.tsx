import { useCallback, useEffect, useState } from 'react'
import type { GitFileStatus, GitHubAccount, GitStatus } from '../../../shared/types'
import { Icon } from './Icon'
import { t } from '../i18n'

interface Props {
  root: string | null
  onOpenFolder: () => void
  onOpenFile: (path: string) => void
}

const TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=repo&description=Lokal%20IDE'

const STATUS_LABEL: Record<GitFileStatus, { letter: string; title: string }> = {
  modified: { letter: 'M', title: 'Modified' },
  added: { letter: 'A', title: 'Added' },
  deleted: { letter: 'D', title: 'Deleted' },
  renamed: { letter: 'R', title: 'Renamed' },
  untracked: { letter: 'U', title: 'New (not versioned yet)' },
  conflict: { letter: '!', title: 'Conflict' }
}

/** IPC errors contain a technical prefix – only show the actual message. */
function errorText(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}

/** "https://github.com/user/repo.git" → "user/repo" */
function repoName(url: string): string {
  return url.replace(/^.*github\.com[:/]/, '').replace(/\.git$/, '')
}

function webUrl(remote: string): string | null {
  const m = remote.match(/github\.com[:/](.+?)(\.git)?$/)
  return m ? `https://github.com/${m[1]}` : null
}

export default function GitPanel({ root, onOpenFolder, onOpenFile }: Props): React.JSX.Element {
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [account, setAccount] = useState<GitHubAccount | null | undefined>(undefined)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  // Remember deselected files – so new changes are selected automatically
  const [excluded, setExcluded] = useState<Set<string>>(new Set())

  const refresh = useCallback(async () => {
    if (!root) return
    try {
      setStatus(await window.api.git.status(root))
    } catch (err) {
      setError(errorText(err))
    }
  }, [root])

  // Refresh the status regularly and when returning to the window
  useEffect(() => {
    setStatus(null)
    void refresh()
    const timer = setInterval(refresh, 4000)
    window.addEventListener('focus', refresh)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [refresh])

  useEffect(() => {
    window.api.github.account().then(setAccount).catch(() => setAccount(null))
  }, [])

  /** Runs an action, shows progress and errors and reloads the status afterwards. */
  const run = async (label: string, action: () => Promise<unknown>, success?: string): Promise<boolean> => {
    setBusy(label)
    setError(null)
    setNotice(null)
    try {
      await action()
      if (success) setNotice(success)
      return true
    } catch (err) {
      setError(errorText(err))
      return false
    } finally {
      setBusy(null)
      await refresh()
    }
  }

  if (!root) {
    return (
      <div className="empty-hint">
        <p>{t('Open a folder to use Git.')}</p>
        <button className="btn primary" onClick={onOpenFolder}>
          {t('Open Folder')}
        </button>
      </div>
    )
  }

  const messages = (
    <>
      {busy && <div className="git-msg busy">{busy} …</div>}
      {error && (
        <div className="git-msg err" onClick={() => setError(null)} title={t('Click to close')}>
          {error}
        </div>
      )}
      {notice && (
        <div className="git-msg ok" onClick={() => setNotice(null)} title={t('Click to close')}>
          {notice}
        </div>
      )}
    </>
  )

  if (!status) return <div className="empty-hint">{t('Loading …')}</div>

  if (!status.isRepo) {
    return (
      <div className="git-panel">
        {messages}
        <div className="empty-hint">
          <p>{t('This folder is not a Git repository yet.')}</p>
          <button className="btn primary" disabled={!!busy} onClick={() => run(t('Creating repository'), () => window.api.git.init(root))}>
            {t('Create Git repository')}
          </button>
        </div>
      </div>
    )
  }

  const dir = status.root
  const selected = status.files.filter((f) => !excluded.has(f.path))
  const allSelected = selected.length === status.files.length

  const toggle = (path: string): void =>
    setExcluded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })

  const doCommit = async (): Promise<void> => {
    const ok = await run(
      t('Committing'),
      () => window.api.git.commit(dir, message, selected.map((f) => f.path)),
      selected.length === 1 ? t('1 file committed.') : t('{count} files committed.', { count: selected.length })
    )
    if (ok) {
      setMessage('')
      setExcluded(new Set())
    }
  }

  const canCommit = !busy && message.trim() !== '' && selected.length > 0 && status.identity !== null

  return (
    <div className="git-panel">
      {/* Branch and sync */}
      <div className="git-branch">
        <Icon name="git" size={14} />
        <span className="git-branch-name" title={status.upstream ?? t('No upstream')}>
          {status.branch}
        </span>
        <span className="spacer" />
        {status.remoteUrl && (
          <>
            <button className="icon-btn" title={t('Pull – fetch changes from GitHub')} disabled={!!busy} onClick={() => run(t('Fetching changes'), () => window.api.git.pull(dir), t('Up to date.'))}>
              <Icon name="arrow-down" size={15} />
              {status.behind > 0 && <span className="git-count">{status.behind}</span>}
            </button>
            <button className="icon-btn" title={t('Push – upload commits to GitHub')} disabled={!!busy || !status.hasCommits} onClick={() => run(t('Uploading'), () => window.api.git.push(dir), t('Uploaded.'))}>
              <Icon name="arrow-up" size={15} />
              {(status.ahead > 0 || !status.upstream) && <span className="git-count">{status.upstream ? status.ahead : '•'}</span>}
            </button>
          </>
        )}
        <button className="icon-btn" title={t('Refresh')} onClick={() => void refresh()}>
          <Icon name="refresh" size={15} />
        </button>
      </div>

      {messages}

      {!status.identity && <IdentityForm busy={!!busy} onSave={(n, e) => run(t('Saving author'), () => window.api.git.setIdentity(dir, n, e))} />}

      {/* Commit */}
      <div className="git-commit">
        <textarea
          rows={3}
          placeholder={t('Commit message (⌘↩ to commit)')}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.metaKey && canCommit) void doCommit()
          }}
        />
        <button className="btn primary" disabled={!canCommit} onClick={doCommit}>
          <Icon name="check" size={14} /> Commit{selected.length > 0 ? ` (${selected.length})` : ''}
        </button>
      </div>

      {/* Changes */}
      <div className="git-section-title">
        <label className="git-check" title={t('Select/deselect all')}>
          <input
            type="checkbox"
            checked={status.files.length > 0 && allSelected}
            disabled={status.files.length === 0}
            onChange={() => setExcluded(allSelected ? new Set(status.files.map((f) => f.path)) : new Set())}
          />
        </label>
        {t('Changes')} <span className="git-count">{status.files.length}</span>
      </div>
      <div className="git-files">
        {status.files.length === 0 && <div className="empty-hint">{t('No changes.')}</div>}
        {status.files.map((f) => {
          const slash = f.rel.lastIndexOf('/')
          const label = STATUS_LABEL[f.status]
          return (
            <div key={f.path} className="git-file" title={f.rel}>
              <input type="checkbox" checked={!excluded.has(f.path)} onChange={() => toggle(f.path)} />
              <span
                className={`git-file-name ${f.status === 'deleted' ? 'deleted' : ''}`}
                onClick={() => f.status !== 'deleted' && onOpenFile(f.path)}
              >
                {f.rel.slice(slash + 1)}
                {slash > 0 && <span className="git-file-dir">{f.rel.slice(0, slash)}</span>}
              </span>
              <span className={`git-status s-${f.status}`} title={t(label.title)}>
                {label.letter}
              </span>
            </div>
          )
        })}
      </div>

      <GitHubSection
        dir={dir}
        status={status}
        account={account}
        busy={!!busy}
        run={run}
        onAccount={setAccount}
      />
    </div>
  )
}

function IdentityForm({ busy, onSave }: { busy: boolean; onSave: (name: string, email: string) => void }): React.JSX.Element {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  return (
    <div className="git-box">
      <p>{t('Who should be the author of the commits?')}</p>
      <input placeholder={t('Name')} value={name} onChange={(e) => setName(e.target.value)} />
      <input placeholder={t('Email')} value={email} onChange={(e) => setEmail(e.target.value)} />
      <button className="btn" disabled={busy || !name.trim() || !email.trim()} onClick={() => onSave(name.trim(), email.trim())}>
        {t('Save')}
      </button>
    </div>
  )
}

function GitHubSection({
  dir,
  status,
  account,
  busy,
  run,
  onAccount
}: {
  dir: string
  status: Extract<GitStatus, { isRepo: true }>
  account: GitHubAccount | null | undefined
  busy: boolean
  run: (label: string, action: () => Promise<unknown>, success?: string) => Promise<boolean>
  onAccount: (a: GitHubAccount | null) => void
}): React.JSX.Element {
  const [token, setToken] = useState('')
  const [repo, setRepo] = useState(dir.split('/').pop()?.replace(/\s+/g, '-') ?? 'project')
  const [isPrivate, setIsPrivate] = useState(true)
  const [editRemote, setEditRemote] = useState(false)
  const [remoteInput, setRemoteInput] = useState('')
  const [storage, setStorage] = useState('')
  useEffect(() => {
    window.api.github.storage().then(setStorage).catch(() => setStorage(''))
  }, [])

  const connect = (): Promise<boolean> =>
    run(t('Connecting to GitHub'), async () => {
      onAccount(await window.api.github.connect(token))
      setToken('')
    }, t('Connected to GitHub.'))

  const saveRemote = async (): Promise<void> => {
    const ok = await run(t('Saving remote'), () => window.api.git.setRemote(dir, remoteInput.trim()), t('Remote saved.'))
    if (ok) setEditRemote(false)
  }

  const web = status.remoteUrl ? webUrl(status.remoteUrl) : null

  return (
    <div className="git-github">
      <div className="git-section-title">GitHub</div>

      {/* Account */}
      {account === undefined ? null : account ? (
        <div className="git-account">
          <img src={account.avatarUrl} alt="" />
          <span>
            {t('Signed in as')} <b>{account.login}</b>
          </span>
          <span className="spacer" />
          <button
            className="link-btn"
            disabled={busy}
            onClick={() => run(t('Signing out'), async () => {
              await window.api.github.disconnect()
              onAccount(null)
            })}
          >
            {t('Sign out')}
          </button>
        </div>
      ) : (
        <div className="git-box">
          <p>
            {t('Connect your GitHub account with an access token. It will be stored {where}.', { where: storage || t('in the system keychain') })}
          </p>
          <ol>
            <li>
              <button className="text-link" onClick={() => window.api.openUrl(TOKEN_URL)}>
                {t('Create token on GitHub')}
              </button>{' '}
              {t('(the “repo” checkbox is already ticked)')}
            </li>
            <li>{t('Copy the token and paste it here:')}</li>
          </ol>
          <input
            type="password"
            placeholder="ghp_…"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && token.trim() && void connect()}
          />
          <button className="btn primary" disabled={busy || !token.trim()} onClick={connect}>
            {t('Connect')}
          </button>
        </div>
      )}

      {/* Remote */}
      {status.remoteUrl && !editRemote ? (
        <div className="git-remote">
          <span className="muted">{t('Repository:')}</span>{' '}
          {web ? (
            <button className="text-link" onClick={() => window.api.openUrl(web)}>
              {repoName(status.remoteUrl)}
            </button>
          ) : (
            <span>{status.remoteUrl}</span>
          )}
          <button
            className="link-btn"
            onClick={() => {
              setRemoteInput(status.remoteUrl ?? '')
              setEditRemote(true)
            }}
          >
            {t('Change')}
          </button>
        </div>
      ) : (
        <>
          {!status.remoteUrl && account && (
            <div className="git-box">
              <p>{t('Create a new repository on GitHub and upload the code:')}</p>
              <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder={t('Repository name')} />
              <label className="git-check-label">
                <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} /> {t('Private')}
              </label>
              <button
                className="btn primary"
                disabled={busy || !repo.trim()}
                onClick={() =>
                  run(
                    t('Publishing to GitHub'),
                    () => window.api.github.publish(dir, repo.trim(), isPrivate),
                    status.hasCommits ? t('Published to GitHub.') : t('Repository created. Make a commit and push it.')
                  )
                }
              >
                {t('Publish to GitHub')}
              </button>
            </div>
          )}
          <div className="git-box">
            <p>{status.remoteUrl ? t('Change remote URL:') : t('Or link an existing repository:')}</p>
            <input
              placeholder="https://github.com/name/repo.git"
              value={remoteInput}
              onChange={(e) => setRemoteInput(e.target.value)}
            />
            <div className="git-row">
              <button className="btn" disabled={busy || !remoteInput.trim()} onClick={saveRemote}>
                {t('Save')}
              </button>
              {editRemote && (
                <button className="link-btn" onClick={() => setEditRemote(false)}>
                  {t('Cancel')}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
