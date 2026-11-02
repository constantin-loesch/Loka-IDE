// Devcontainer: anlegen, starten, neu aufbauen, stoppen.
// Gestartet wird über die offizielle Dev-Container-CLI (@devcontainers/cli) – sie versteht
// Images, Dockerfiles, Docker Compose und Features genau wie VS Code.
import { app } from 'electron'
import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import type { DevcontainerLog, DevcontainerStatus, DevcontainerTemplate } from '../shared/types'
import { userPath } from './agentTools'

/** Basis-Images – die offiziellen Dev-Container-Images bringen Git, Benutzer „vscode“ und sudo mit. */
export const BASE_IMAGES: Record<string, { label: string; image: string }> = {
  ubuntu: { label: 'Ubuntu (Basis)', image: 'mcr.microsoft.com/devcontainers/base:ubuntu' },
  debian: { label: 'Debian (Basis)', image: 'mcr.microsoft.com/devcontainers/base:debian' },
  node: { label: 'Node.js & TypeScript', image: 'mcr.microsoft.com/devcontainers/typescript-node:22' },
  python: { label: 'Python 3', image: 'mcr.microsoft.com/devcontainers/python:3.12' },
  go: { label: 'Go', image: 'mcr.microsoft.com/devcontainers/go:1' },
  rust: { label: 'Rust', image: 'mcr.microsoft.com/devcontainers/rust:1' },
  java: { label: 'Java (Maven & Gradle)', image: 'mcr.microsoft.com/devcontainers/java:21' },
  cpp: { label: 'C/C++ (gcc, CMake, gdb)', image: 'mcr.microsoft.com/devcontainers/cpp:ubuntu' },
  dotnet: { label: '.NET', image: 'mcr.microsoft.com/devcontainers/dotnet:8.0' },
  universal: { label: 'Universal (alles, sehr groß)', image: 'mcr.microsoft.com/devcontainers/universal:2' }
}

/** Zusätzliche Build-Tools als Dev-Container-Features. */
export const FEATURES: Record<string, { label: string; id: string; options?: Record<string, unknown> }> = {
  node: { label: 'Node.js + npm', id: 'ghcr.io/devcontainers/features/node:1', options: { version: 'lts' } },
  python: { label: 'Python + pip', id: 'ghcr.io/devcontainers/features/python:1' },
  go: { label: 'Go', id: 'ghcr.io/devcontainers/features/go:1' },
  rust: { label: 'Rust + Cargo', id: 'ghcr.io/devcontainers/features/rust:1' },
  java: {
    label: 'Java + Maven + Gradle',
    id: 'ghcr.io/devcontainers/features/java:1',
    options: { installMaven: true, installGradle: true }
  },
  dotnet: { label: '.NET SDK', id: 'ghcr.io/devcontainers/features/dotnet:2' },
  'build-essential': {
    label: 'C/C++ Build-Tools (gcc, make, CMake)',
    id: 'ghcr.io/devcontainers-extra/features/apt-packages:1',
    options: { packages: 'build-essential,cmake,pkg-config' }
  },
  docker: { label: 'Docker im Container', id: 'ghcr.io/devcontainers/features/docker-in-docker:2' },
  'github-cli': { label: 'GitHub CLI (gh)', id: 'ghcr.io/devcontainers/features/github-cli:1' }
}

// ---------- Docker & CLI aufrufen ----------

/** Docker Desktop liegt oft außerhalb des PATH, den aus dem Finder gestartete Apps bekommen. */
async function dockerEnv(): Promise<NodeJS.ProcessEnv> {
  const extra = ['/usr/local/bin', '/opt/homebrew/bin', join(homedir(), '.docker/bin'), '/Applications/Docker.app/Contents/Resources/bin']
  const PATH = [await userPath(), ...extra].join(':')
  return { ...process.env, PATH }
}

/** Pfad zur Dev-Container-CLI – im App-Bundle aus dem entpackten Teil (asarUnpack). */
function cliPath(): string {
  return join(app.getAppPath(), 'node_modules/@devcontainers/cli/devcontainer.js').replace('app.asar', 'app.asar.unpacked')
}

export function docker(args: string[], timeout = 20000): Promise<string> {
  return dockerEnv().then(
    (env) =>
      new Promise((done, fail) => {
        execFile('docker', args, { env, timeout, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
          if (err) {
            const e = new Error((stderr || err.message).trim()) as Error & { code?: unknown }
            e.code = (err as NodeJS.ErrnoException).code
            fail(e)
          } else done(stdout)
        })
      })
  )
}

/** Startet `docker …` als Prozess mit Pipes (für Port-Weiterleitungen). */
export async function spawnDocker(args: string[]): Promise<ChildProcess> {
  return spawn('docker', args, { env: await dockerEnv(), stdio: ['pipe', 'pipe', 'pipe'] })
}

/** Befehl und Umgebung, um die Dev-Container-CLI mit dem Node.js von Electron auszuführen. */
export async function cliCommand(args: string[]): Promise<{ file: string; args: string[]; env: NodeJS.ProcessEnv }> {
  return {
    file: process.execPath,
    args: [cliPath(), ...args],
    env: { ...(await dockerEnv()), ELECTRON_RUN_AS_NODE: '1' }
  }
}

// ---------- devcontainer.json lesen ----------

/** Entfernt Kommentare und überzählige Kommas (JSONC), ohne Text in Strings anzufassen. */
export function parseJsonc(text: string): unknown {
  let out = ''
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '"') {
      const start = i
      for (i++; i < text.length && text[i] !== '"'; i++) if (text[i] === '\\') i++
      out += text.slice(start, i + 1)
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++
      out += '\n'
    } else if (c === '/' && text[i + 1] === '*') {
      i = text.indexOf('*/', i + 2)
      if (i < 0) break
      i++
    } else out += c
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'))
}

export function findConfig(root: string): string | null {
  const candidates = [join(root, '.devcontainer', 'devcontainer.json'), join(root, '.devcontainer.json')]
  return candidates.find((p) => existsSync(p)) ?? null
}

async function readConfig(root: string): Promise<{ path: string; json: Record<string, unknown> } | null> {
  const path = findConfig(root)
  if (!path) return null
  try {
    return { path, json: parseJsonc(await readFile(path, 'utf8')) as Record<string, unknown> }
  } catch {
    // Kaputte Datei: trotzdem als vorhanden melden, die CLI zeigt beim Start den Fehler
    return { path, json: {} }
  }
}

/** forwardPorts kann Zahlen oder „host:port“ enthalten – wir nehmen den Port. */
function forwardPortsOf(json: Record<string, unknown>): number[] {
  const list = Array.isArray(json.forwardPorts) ? json.forwardPorts : []
  return list
    .map((p) => (typeof p === 'number' ? p : Number(String(p).split(':').pop())))
    .filter((p) => Number.isInteger(p) && p > 0 && p < 65536)
}

// ---------- Status ----------

/** Merkt sich Ergebnisse von `up` (Arbeitsordner im Container) und laufende Starts. */
const known = new Map<string, { remoteWorkspaceFolder: string }>()
const starting = new Set<string>()
let running: ChildProcess | null = null

async function dockerState(): Promise<{ docker: DevcontainerStatus['docker']; message?: string }> {
  try {
    await docker(['info', '--format', '{{.ServerVersion}}'], 8000)
    return { docker: 'ok' }
  } catch (err) {
    const e = err as Error & { code?: unknown }
    if (e.code === 'ENOENT') return { docker: 'missing' }
    return { docker: 'not-running', message: e.message.split('\n')[0] }
  }
}

/** Container dieses Projekts – die CLI markiert ihn mit dem Label devcontainer.local_folder. */
async function findContainer(root: string): Promise<{ id: string; state: string; image: string } | null> {
  const out = await docker([
    'ps',
    '-a',
    '--filter',
    `label=devcontainer.local_folder=${root}`,
    '--format',
    '{{.ID}}\t{{.State}}\t{{.Image}}'
  ]).catch(() => '')
  const line = out.trim().split('\n')[0]
  if (!line) return null
  const [id, state, image] = line.split('\t')
  return { id, state, image }
}

export async function status(root: string): Promise<DevcontainerStatus> {
  const cfg = await readConfig(root)
  const base: DevcontainerStatus = {
    configPath: cfg?.path ?? null,
    name: typeof cfg?.json.name === 'string' ? cfg.json.name : null,
    docker: 'ok',
    state: 'none',
    containerId: null,
    image: null,
    remoteWorkspaceFolder: null,
    forwardPorts: cfg ? forwardPortsOf(cfg.json) : []
  }
  const d = await dockerState()
  base.docker = d.docker
  base.dockerMessage = d.message
  if (d.docker !== 'ok') return base

  const c = await findContainer(root)
  if (c) {
    base.containerId = c.id
    base.image = c.image
    base.state = c.state === 'running' ? 'running' : 'stopped'
    base.remoteWorkspaceFolder =
      known.get(root)?.remoteWorkspaceFolder ??
      (typeof cfg?.json.workspaceFolder === 'string' ? cfg.json.workspaceFolder : `/workspaces/${basename(root)}`)
  }
  if (starting.has(root)) base.state = 'starting'
  return base
}

/** Laufender Container eines Projekts oder null. */
export async function runningContainer(root: string): Promise<string | null> {
  const c = await findContainer(root)
  return c?.state === 'running' ? c.id : null
}

// ---------- Anlegen ----------

export function templateFor(t: DevcontainerTemplate): Record<string, unknown> {
  const features: Record<string, unknown> = {}
  for (const key of t.features) {
    const f = FEATURES[key]
    if (f) features[f.id] = f.options ?? {}
  }
  const json: Record<string, unknown> = {
    name: t.name || 'Dev Container',
    image: BASE_IMAGES[t.image]?.image ?? BASE_IMAGES.ubuntu.image
  }
  if (Object.keys(features).length) json.features = features
  if (t.forwardPorts.length) json.forwardPorts = t.forwardPorts
  if (t.postCreateCommand.trim()) json.postCreateCommand = t.postCreateCommand.trim()
  json.remoteUser = 'vscode'
  return json
}

export async function create(root: string, t: DevcontainerTemplate): Promise<string> {
  const dir = join(root, '.devcontainer')
  const path = join(dir, 'devcontainer.json')
  if (existsSync(path)) throw new Error('.devcontainer/devcontainer.json gibt es schon.')
  await mkdir(dir, { recursive: true })
  const header =
    '// Dev Container – Dokumentation: https://containers.dev/implementors/json_reference/\n' +
    '// Weitere Features (Build-Tools, Sprachen, CLIs): https://containers.dev/features\n'
  await writeFile(path, header + JSON.stringify(templateFor(t), null, 2) + '\n')
  return path
}

/** Vorschlag für den Dialog, abhängig von den Dateien im Projekt. */
export async function suggest(root: string): Promise<DevcontainerTemplate> {
  const has = (f: string): boolean => existsSync(join(root, f))
  const t: DevcontainerTemplate = { name: basename(root), image: 'ubuntu', features: [], forwardPorts: [], postCreateCommand: '' }
  if (has('package.json')) {
    t.image = 'node'
    t.postCreateCommand = has('pnpm-lock.yaml') ? 'pnpm install' : has('yarn.lock') ? 'yarn install' : 'npm install'
    t.forwardPorts = [3000, 5173]
  } else if (has('pyproject.toml') || has('requirements.txt')) {
    t.image = 'python'
    t.postCreateCommand = has('requirements.txt') ? 'pip install -r requirements.txt' : 'pip install -e .'
    t.forwardPorts = [8000]
  } else if (has('go.mod')) {
    t.image = 'go'
    t.postCreateCommand = 'go mod download'
    t.forwardPorts = [8080]
  } else if (has('Cargo.toml')) {
    t.image = 'rust'
    t.postCreateCommand = 'cargo fetch'
  } else if (has('pom.xml') || has('build.gradle') || has('build.gradle.kts')) {
    t.image = 'java'
    t.forwardPorts = [8080]
  } else if (has('CMakeLists.txt') || has('Makefile')) {
    t.image = 'cpp'
  }
  t.features = ['github-cli']
  return t
}

// ---------- Starten, neu aufbauen, stoppen ----------

export interface UpResult {
  containerId: string
  remoteWorkspaceFolder: string
  forwardPorts: number[]
}

/**
 * Startet den Devcontainer (baut ihn bei Bedarf). Die Ausgabe der CLI geht live an `log`.
 * rebuild = Container löschen und neu bauen.
 */
export async function up(root: string, rebuild: boolean, log: (l: DevcontainerLog) => void): Promise<UpResult> {
  if (running) throw new Error('Es läuft schon ein Container-Start.')
  const args = ['up', '--workspace-folder', root, '--log-format', 'text']
  if (rebuild) args.push('--remove-existing-container', '--build-no-cache')
  const cmd = await cliCommand(args)
  starting.add(root)
  log({ text: `$ devcontainer ${args.join(' ')}\n` })

  try {
    const stdout = await new Promise<string>((done, fail) => {
      const child = spawn(cmd.file, cmd.args, { env: cmd.env, cwd: root })
      running = child
      let out = ''
      child.stdout.on('data', (b: Buffer) => {
        out += b.toString()
      })
      // Fortschritt (Image-Download, Build, Features) schreibt die CLI nach stderr
      child.stderr.on('data', (b: Buffer) => log({ text: b.toString() }))
      child.on('error', fail)
      child.on('close', (code) => (code === 0 ? done(out) : fail(new Error(lastJson(out)?.message ?? `devcontainer up endete mit Code ${code}`))))
    })
    const result = lastJson(stdout)
    if (!result || result.outcome !== 'success') throw new Error(result?.message ?? 'Start fehlgeschlagen')
    const remoteWorkspaceFolder = result.remoteWorkspaceFolder ?? `/workspaces/${basename(root)}`
    known.set(root, { remoteWorkspaceFolder })
    const cfg = await readConfig(root)
    log({ text: `\nContainer läuft: ${result.containerId.slice(0, 12)}\n`, done: true })
    return { containerId: result.containerId, remoteWorkspaceFolder, forwardPorts: cfg ? forwardPortsOf(cfg.json) : [] }
  } catch (err) {
    log({ text: `\nFehler: ${err instanceof Error ? err.message : err}\n`, done: true, error: true })
    throw err
  } finally {
    running = null
    starting.delete(root)
  }
}

interface CliResult {
  outcome?: string
  message?: string
  containerId: string
  remoteWorkspaceFolder?: string
}

/** Die CLI schreibt das Ergebnis als letzte JSON-Zeile nach stdout. */
function lastJson(out: string): CliResult | null {
  const lines = out.trim().split('\n').reverse()
  for (const l of lines) {
    try {
      return JSON.parse(l) as CliResult
    } catch {
      /* nächste Zeile */
    }
  }
  return null
}

export function cancelUp(): void {
  running?.kill('SIGTERM')
}

export async function stop(root: string): Promise<void> {
  const c = await findContainer(root)
  if (c) await docker(['stop', c.id], 60000)
}

export async function remove(root: string): Promise<void> {
  const c = await findContainer(root)
  if (c) await docker(['rm', '-f', c.id], 60000)
  known.delete(root)
}

/** Ports, auf denen im Container ein Dienst lauscht – aus /proc/net/tcp, klappt in jedem Linux-Container. */
export async function listeningPorts(containerId: string): Promise<number[]> {
  const out = await docker(['exec', containerId, 'cat', '/proc/net/tcp', '/proc/net/tcp6'], 5000).catch(() => '')
  const ports = new Set<number>()
  for (const line of out.split('\n')) {
    const f = line.trim().split(/\s+/)
    // f[1] = lokale Adresse „0100007F:1F90“, f[3] = Zustand, 0A = LISTEN
    if (f[3] !== '0A' || !f[1]?.includes(':')) continue
    const port = parseInt(f[1].split(':').pop() ?? '', 16)
    if (port > 0) ports.add(port)
  }
  return [...ports].sort((a, b) => a - b)
}
