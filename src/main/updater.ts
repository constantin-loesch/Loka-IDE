// Updates: compares this app's Git state with GitHub and rebuilds it if needed.
//
// The app is built from source (scripts/install.sh or `npm run app`). At build time
// it remembers the commit and source folder. An update therefore is: git pull → npm install →
// rebuild → after quitting, swap the old app and restart.
import { app } from 'electron'
import { spawn } from 'node:child_process'
import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { UpdateInfo, UpdateState } from '../shared/types'
import { userPath } from './agentTools'
import { t as tr } from './i18n'

const REPO = 'constantin-loesch/Lokal-IDE'
const BRANCH = 'main'
/** How often to check in the background */
const INTERVAL_MS = 4 * 60 * 60 * 1000

type Send = (channel: string, payload: unknown) => void

let state: UpdateState = { state: 'idle' }
let send: Send = () => undefined
/** Finished new version (app bundle or AppImage) */
let built: string | null = null

function setState(s: UpdateState): void {
  state = s
  send('update:state', s)
}

/** During development the project folder is the source folder, in the finished app the one remembered at build time. */
function sourceDir(): string {
  return app.isPackaged ? __SOURCE_DIR__ : app.getAppPath()
}

export function info(): UpdateInfo {
  return { commit: __BUILD_COMMIT__, buildDate: __BUILD_DATE__, sourceDir: sourceDir(), repo: REPO }
}

export function getState(): UpdateState {
  return state
}

// ---------- Checking ----------

interface CompareResponse {
  status: 'ahead' | 'behind' | 'identical' | 'diverged'
  ahead_by: number
  commits: { sha: string; commit: { message: string; author: { date: string } | null } }[]
}

/**
 * Asks GitHub which commits on main are newer than this app's state.
 * silent = automatic check: don't show errors (offline, rate limit).
 */
export async function check(silent = false): Promise<UpdateState> {
  // During installation or when already built: don't overwrite anything
  if (state.state === 'installing' || state.state === 'ready') return state
  if (!__BUILD_COMMIT__) {
    if (!silent) setState({ state: 'error', message: tr('This app was built without Git information – updates are not possible.') })
    return state
  }
  const previous = state
  if (!silent) setState({ state: 'checking' })
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/compare/${__BUILD_COMMIT__}...${BRANCH}`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Lokal-IDE' },
      signal: AbortSignal.timeout(15000)
    })
    // 404: our own commit is not on GitHub (yet) – built locally, not published
    if (res.status === 404) {
      setState({ state: 'up-to-date', checkedAt: new Date().toISOString() })
      return state
    }
    if (!res.ok) throw new Error(tr('GitHub responds with {status}', { status: res.status }) + (res.status === 403 ? ' ' + tr('(too many requests – try again later)') : ''))
    const data = (await res.json()) as CompareResponse
    if (data.ahead_by > 0) {
      const commits = data.commits
        .map((c) => ({ sha: c.sha, message: c.commit.message.split('\n')[0], date: c.commit.author?.date ?? '' }))
        .reverse()
      setState({ state: 'available', behindBy: data.ahead_by, commits, latest: commits[0]?.sha ?? '' })
    } else {
      setState({ state: 'up-to-date', checkedAt: new Date().toISOString() })
    }
  } catch (err) {
    if (silent) state = previous
    else setState({ state: 'error', message: tr('Update check failed: {message}', { message: err instanceof Error ? err.message : String(err) }) })
  }
  return state
}

export function start(s: Send): void {
  send = s
  // Shortly after start and then regularly
  setTimeout(() => void check(true), 8000)
  setInterval(() => void check(true), INTERVAL_MS)
}

// ---------- Installing ----------

async function run(cmd: string, args: string[], cwd: string, log: (t: string) => void, env: NodeJS.ProcessEnv = {}): Promise<string> {
  // Node.js loaded by the install script (if the system has none in version 22+) first
  const PATH = [join(homedir(), '.local', 'share', 'lokal-ide', 'node', 'bin'), await userPath()].join(':')
  return new Promise((done, fail) => {
    const child = spawn(cmd, args, {
      cwd,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined, PATH, FORCE_COLOR: '0', ...env }
    })
    let out = ''
    const collect = (b: Buffer): void => {
      const t = b.toString()
      out += t
      log(t)
    }
    child.stdout.on('data', collect)
    child.stderr.on('data', collect)
    child.on('error', (err) => fail(new Error(tr('{cmd} could not be started: {message}', { cmd, message: err.message }))))
    child.on('close', (code) => (code === 0 ? done(out) : fail(new Error(tr('“{command}” failed (code {code}).', { command: `${cmd} ${args.join(' ')}`, code: String(code) })))))
  })
}

/** Fetches the new version and builds it. The running app stays unchanged until the restart. */
export async function install(): Promise<void> {
  if (state.state === 'installing') return
  const dir = sourceDir()
  const log = (t: string): void => send('update:log', t)
  const step = (s: string): void => {
    setState({ state: 'installing', step: s })
    log(`\n▶ ${s}\n`)
  }

  try {
    if (!existsSync(join(dir, '.git'))) {
      throw new Error(
        tr('The source folder {dir} is missing or not a Git repository. Reinstall with:', { dir }) + '\n' +
          `curl -fsSL https://raw.githubusercontent.com/${REPO}/${BRANCH}/scripts/install.sh | sh`
      )
    }
    step(tr('Checking the source folder'))
    // npm install rewrites package-lock.json itself – no reason to abort the update
    await run('git', ['checkout', '--', 'package-lock.json'], dir, () => undefined).catch(() => '')
    const dirty = (await run('git', ['status', '--porcelain', '--untracked-files=no'], dir, () => undefined)).trim()
    if (dirty) {
      throw new Error(tr('The source folder {dir} has uncommitted changes. Commit or discard them, then try again.', { dir }) + `\n${dirty}`)
    }

    step(tr('Downloading the new version (git pull)'))
    await run('git', ['pull', '--ff-only', 'origin', BRANCH], dir, log)

    step(tr('Installing dependencies (npm install)'))
    await run('npm', ['install', '--no-audit', '--no-fund'], dir, log)

    if (!app.isPackaged) {
      // During development `npm run dev` builds by itself – just restart
      built = null
      setState({ state: 'ready', dev: true })
      return
    }

    step(tr('Building the app (takes a few minutes)'))
    if (process.platform === 'darwin') {
      await run('npm', ['run', 'app'], dir, log, { LOKAL_IDE_BUILD_ONLY: '1' })
      // Own output folder (see package-mac.sh) so a running app in dist/ stays untouched
      built = join(dir, 'dist', 'update', process.arch === 'arm64' ? 'mac-arm64' : 'mac', 'Lokal IDE.app')
    } else {
      await run('npm', ['run', 'app:linux'], dir, log)
      const dist = join(dir, 'dist')
      const images = readdirSync(dist)
        .filter((f) => f.endsWith('.AppImage'))
        .map((f) => join(dist, f))
        .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
      built = images[0] ?? null
    }
    if (!built || !existsSync(built)) throw new Error(tr('The built app was not found.'))
    log('\n✔ ' + tr('New version built: {path}', { path: built }) + '\n')
    setState({ state: 'ready', dev: false, installTo: installTarget() })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log(`\n✖ ${message}\n`)
    setState({ state: 'error', message })
  }
}

// ---------- Restarting ----------

/** Path of the running app bundle (“…/Lokal IDE.app”) on the Mac. */
function runningBundle(): string | null {
  const i = process.execPath.indexOf('.app/')
  return i > 0 ? process.execPath.slice(0, i + 4) : null
}

/**
 * Where the new version goes. Normally where the app is right now – unless it runs
 * directly from the project's build folder or from a temporary location: then to ~/Applications.
 */
export function installTarget(): string {
  if (process.platform !== 'darwin') return process.env.APPIMAGE ?? join(homedir(), '.local', 'bin', 'lokal-ide')
  const fallback = join(homedir(), 'Applications', 'Lokal IDE.app')
  const running = runningBundle()
  if (!running) return fallback
  const insideSource = running.startsWith(sourceDir() + '/')
  const translocated = running.includes('/AppTranslocation/') || running.startsWith('/private/var/folders/') || running.startsWith('/Volumes/')
  return insideSource || translocated ? fallback : running
}

/** Is an update build running? Then the app should not simply quit. */
export function isInstalling(): boolean {
  return state.state === 'installing'
}

/** Swaps the app for the newly built one and restarts it. */
export function restart(): void {
  if (state.state !== 'ready') return
  if (!app.isPackaged || !built) {
    // Development mode: electron-vite doesn't restart the app by itself
    app.relaunch()
    app.exit(0)
    return
  }

  if (process.platform === 'darwin') {
    const dest = installTarget()
    const script = join(sourceDir(), 'scripts', 'mac-install-app.sh')
    const logDir = join(homedir(), 'Library', 'Logs', 'Lokal IDE')
    mkdirSync(logDir, { recursive: true })
    const logFile = join(logDir, 'update.log')
    // Keeps running after the app has quit: wait, swap, reopen.
    // Output goes to ~/Library/Logs/Lokal IDE/update.log
    const child = spawn(
      '/bin/sh',
      [
        '-c',
        'exec >>"$5" 2>&1; echo "--- $(date) Update: $1 -> $2"; ' +
          'while kill -0 "$3" 2>/dev/null; do sleep 0.3; done; ' +
          'if sh "$0" "$1" "$2"; then echo "installed"; open "$2"; else echo "swap failed"; open "$4"; fi',
        script,
        built,
        dest,
        String(process.pid),
        // If necessary reopen the old app
        runningBundle() ?? dest,
        logFile
      ],
      { detached: true, stdio: 'ignore', env: { ...process.env, PATH: '/usr/bin:/bin:/usr/sbin:/sbin' } }
    )
    child.unref()
    app.quit()
    return
  }

  // Linux: the running AppImage may be replaced as long as the file is renamed instead of overwritten
  const dest = process.env.APPIMAGE ?? join(homedir(), '.local', 'bin', 'lokal-ide')
  const tmp = `${dest}.new`
  copyFileSync(built, tmp)
  chmodSync(tmp, 0o755)
  renameSync(tmp, dest)
  app.relaunch({ execPath: dest, args: [] })
  app.exit(0)
}
