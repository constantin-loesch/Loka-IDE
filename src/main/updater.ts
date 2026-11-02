// Updates: vergleicht den Git-Stand dieser App mit GitHub und baut sie bei Bedarf neu.
//
// Die App wird aus dem Quellcode gebaut (scripts/install.sh bzw. `npm run app`). Beim Bauen
// merkt sie sich Commit und Quellordner. Ein Update ist daher: git pull → npm install →
// neu bauen → nach dem Beenden die alte App austauschen und neu starten.
import { app } from 'electron'
import { spawn } from 'node:child_process'
import { chmodSync, copyFileSync, existsSync, readdirSync, renameSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { UpdateInfo, UpdateState } from '../shared/types'
import { userPath } from './agentTools'

const REPO = 'constantin-loesch/Lokal-IDE'
const BRANCH = 'main'
/** Wie oft im Hintergrund nachgesehen wird */
const INTERVAL_MS = 4 * 60 * 60 * 1000

type Send = (channel: string, payload: unknown) => void

let state: UpdateState = { state: 'idle' }
let send: Send = () => undefined
/** Fertig gebaute neue Version (App-Bundle bzw. AppImage) */
let built: string | null = null

function setState(s: UpdateState): void {
  state = s
  send('update:state', s)
}

/** Beim Entwickeln ist der Projektordner der Quellordner, in der fertigen App der beim Bauen gemerkte. */
function sourceDir(): string {
  return app.isPackaged ? __SOURCE_DIR__ : app.getAppPath()
}

export function info(): UpdateInfo {
  return { commit: __BUILD_COMMIT__, buildDate: __BUILD_DATE__, sourceDir: sourceDir(), repo: REPO }
}

export function getState(): UpdateState {
  return state
}

// ---------- Prüfen ----------

interface CompareResponse {
  status: 'ahead' | 'behind' | 'identical' | 'diverged'
  ahead_by: number
  commits: { sha: string; commit: { message: string; author: { date: string } | null } }[]
}

/**
 * Fragt GitHub, welche Commits auf main neuer sind als der Stand dieser App.
 * silent = automatische Prüfung: Fehler (offline, Rate-Limit) nicht anzeigen.
 */
export async function check(silent = false): Promise<UpdateState> {
  // Während Installation oder wenn schon fertig gebaut: nichts überschreiben
  if (state.state === 'installing' || state.state === 'ready') return state
  if (!__BUILD_COMMIT__) {
    if (!silent) setState({ state: 'error', message: 'Diese App wurde ohne Git-Informationen gebaut – Updates sind nicht möglich.' })
    return state
  }
  const previous = state
  if (!silent) setState({ state: 'checking' })
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/compare/${__BUILD_COMMIT__}...${BRANCH}`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Lokal-IDE' },
      signal: AbortSignal.timeout(15000)
    })
    // 404: Der eigene Commit ist (noch) nicht auf GitHub – lokal gebaut, nicht veröffentlicht
    if (res.status === 404) {
      setState({ state: 'up-to-date', checkedAt: new Date().toISOString() })
      return state
    }
    if (!res.ok) throw new Error(`GitHub antwortet mit ${res.status}${res.status === 403 ? ' (zu viele Anfragen – später erneut versuchen)' : ''}`)
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
    else setState({ state: 'error', message: `Update-Prüfung fehlgeschlagen: ${err instanceof Error ? err.message : err}` })
  }
  return state
}

export function start(s: Send): void {
  send = s
  // Kurz nach dem Start und danach regelmäßig
  setTimeout(() => void check(true), 8000)
  setInterval(() => void check(true), INTERVAL_MS)
}

// ---------- Installieren ----------

async function run(cmd: string, args: string[], cwd: string, log: (t: string) => void, env: NodeJS.ProcessEnv = {}): Promise<string> {
  const PATH = await userPath()
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
    child.on('error', (err) => fail(new Error(`${cmd} konnte nicht gestartet werden: ${err.message}`)))
    child.on('close', (code) => (code === 0 ? done(out) : fail(new Error(`„${cmd} ${args.join(' ')}“ ist fehlgeschlagen (Code ${code}).`))))
  })
}

/** Holt die neue Version und baut sie. Die laufende App bleibt bis zum Neustart unverändert. */
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
        `Der Quellordner ${dir} fehlt oder ist kein Git-Repository. Installiere neu mit:\n` +
          `curl -fsSL https://raw.githubusercontent.com/${REPO}/${BRANCH}/scripts/install.sh | sh`
      )
    }
    step('Prüfe den Quellordner')
    const dirty = (await run('git', ['status', '--porcelain', '--untracked-files=no'], dir, () => undefined)).trim()
    if (dirty) {
      throw new Error(`Im Quellordner ${dir} gibt es nicht committete Änderungen. Committe oder verwirf sie, dann erneut versuchen.\n${dirty}`)
    }

    step('Lade die neue Version (git pull)')
    await run('git', ['pull', '--ff-only', 'origin', BRANCH], dir, log)

    step('Installiere Abhängigkeiten (npm install)')
    await run('npm', ['install', '--no-audit', '--no-fund'], dir, log)

    if (!app.isPackaged) {
      // Beim Entwickeln baut `npm run dev` selbst – nur neu starten
      built = null
      setState({ state: 'ready', dev: true })
      return
    }

    step('Baue die App (dauert ein paar Minuten)')
    if (process.platform === 'darwin') {
      await run('npm', ['run', 'app'], dir, log, { LOKAL_IDE_BUILD_ONLY: '1' })
      built = join(dir, 'dist', process.arch === 'arm64' ? 'mac-arm64' : 'mac', 'Lokal IDE.app')
    } else {
      await run('npm', ['run', 'app:linux'], dir, log)
      const dist = join(dir, 'dist')
      const images = readdirSync(dist)
        .filter((f) => f.endsWith('.AppImage'))
        .map((f) => join(dist, f))
        .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
      built = images[0] ?? null
    }
    if (!built || !existsSync(built)) throw new Error('Die gebaute App wurde nicht gefunden.')
    log(`\n✔ Neue Version gebaut: ${built}\n`)
    setState({ state: 'ready', dev: false })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log(`\n✖ ${message}\n`)
    setState({ state: 'error', message })
  }
}

// ---------- Neu starten ----------

/** Pfad des laufenden App-Bundles („…/Lokal IDE.app“) auf dem Mac. */
function runningBundle(): string | null {
  const i = process.execPath.indexOf('.app/')
  return i > 0 ? process.execPath.slice(0, i + 4) : null
}

/** Tauscht die App gegen die neu gebaute und startet sie neu. */
export function restart(): void {
  if (state.state !== 'ready') return
  if (!app.isPackaged || !built) {
    // Entwicklungsmodus: electron-vite startet die App nicht selbst neu
    app.relaunch()
    app.exit(0)
    return
  }

  if (process.platform === 'darwin') {
    const dest = runningBundle() ?? join(homedir(), 'Applications', 'Lokal IDE.app')
    const script = join(sourceDir(), 'scripts', 'mac-install-app.sh')
    // Läuft weiter, nachdem die App beendet ist: warten, austauschen, wieder öffnen
    const child = spawn(
      '/bin/sh',
      ['-c', 'while kill -0 "$3" 2>/dev/null; do sleep 0.3; done; sh "$0" "$1" "$2" && open "$2"', script, built, dest, String(process.pid)],
      { detached: true, stdio: 'ignore' }
    )
    child.unref()
    app.quit()
    return
  }

  // Linux: Das laufende AppImage darf ersetzt werden, solange die Datei umbenannt statt überschrieben wird
  const dest = process.env.APPIMAGE ?? join(homedir(), '.local', 'bin', 'lokal-ide')
  const tmp = `${dest}.new`
  copyFileSync(built, tmp)
  chmodSync(tmp, 0o755)
  renameSync(tmp, dest)
  app.relaunch({ execPath: dest, args: [] })
  app.exit(0)
}
