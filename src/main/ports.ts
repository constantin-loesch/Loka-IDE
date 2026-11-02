// Ports: erkennt Dienste aus den Terminals der IDE und leitet Ports aus dem Devcontainer
// auf localhost weiter – wie die Ports-Ansicht in VS Code.
import { execFile } from 'node:child_process'
import { createServer, type Server, type Socket } from 'node:net'
import type { PortInfo } from '../shared/types'
import * as devcontainer from './devcontainer'
import * as terminal from './terminal'

type Send = (channel: string, payload: unknown) => void

interface Forward {
  containerId: string
  port: number
  localPort: number
  server: Server
  /** Von Hand oder per forwardPorts – bleibt auch, wenn gerade nichts lauscht */
  pinned: boolean
}

const forwards = new Map<number, Forward>()
/** Lokale Ports, die der Nutzer selbst hinzugefügt hat */
const pinnedLocal = new Set<number>()
/** Ports, deren automatische Weiterleitung der Nutzer beendet hat – nicht erneut weiterleiten */
const ignored = new Set<number>()

let root: string | null = null
let containerId: string | null = null
let last = ''
let timer: NodeJS.Timeout | null = null
let send: Send = () => undefined

// ---------- Weiterleitung in den Container ----------

/**
 * Wird im Container ausgeführt und verbindet stdin/stdout mit 127.0.0.1:<port>.
 * Nimmt das erste vorhandene Werkzeug: bash, nc, socat oder node.
 */
const PROXY = [
  'p=$1',
  'if command -v bash >/dev/null 2>&1; then exec bash -c \'exec 3<>/dev/tcp/127.0.0.1/\'"$p"\'; cat <&3 & cat >&3; wait\'; fi',
  'if command -v nc >/dev/null 2>&1; then exec nc 127.0.0.1 "$p"; fi',
  'if command -v socat >/dev/null 2>&1; then exec socat - TCP:127.0.0.1:"$p"; fi',
  'if command -v node >/dev/null 2>&1; then exec node -e \'const s=require("net").connect(+process.argv[1],"127.0.0.1");process.stdin.pipe(s);s.pipe(process.stdout);s.on("error",()=>process.exit(1))\' "$p"; fi',
  'echo "Kein Werkzeug für die Weiterleitung gefunden (bash, nc, socat oder node)" >&2; exit 1'
].join('\n')

function pipeToContainer(socket: Socket, cid: string, port: number): void {
  void devcontainer.spawnDocker(['exec', '-i', cid, 'sh', '-c', PROXY, 'proxy', String(port)]).then((child) => {
    const end = (): void => {
      socket.destroy()
      child.kill()
    }
    socket.pipe(child.stdin!)
    child.stdout!.pipe(socket)
    socket.on('close', end)
    socket.on('error', end)
    child.on('close', end)
    child.on('error', end)
  })
}

/** Lauscht auf 127.0.0.1 – ist der Wunsch-Port belegt, den nächsten freien nehmen (wie VS Code). */
function listen(server: Server, wanted: number): Promise<number> {
  return new Promise((done, fail) => {
    let attempt = 0
    const tryPort = (p: number): void => {
      server.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE' && attempt++ < 20) tryPort(p + 1)
        else if (err.code === 'EADDRINUSE' || err.code === 'EACCES') tryPort(0)
        else fail(err)
      })
      server.listen(p, '127.0.0.1', () => {
        const addr = server.address()
        done(typeof addr === 'object' && addr ? addr.port : p)
      })
    }
    tryPort(wanted)
  })
}

export async function forward(port: number, pinned = true): Promise<number> {
  const existing = forwards.get(port)
  if (existing) {
    existing.pinned ||= pinned
    return existing.localPort
  }
  if (!containerId) {
    // Ohne Container: lokalen Port nur in die Liste aufnehmen
    pinnedLocal.add(port)
    ignored.delete(port)
    void refresh()
    return port
  }
  const cid = containerId
  const server = createServer((socket) => pipeToContainer(socket, cid, port))
  const localPort = await listen(server, port)
  forwards.set(port, { containerId: cid, port, localPort, server, pinned })
  ignored.delete(port)
  void refresh()
  return localPort
}

export function unforward(port: number): void {
  const f = forwards.get(port)
  if (f) {
    f.server.close()
    forwards.delete(port)
    ignored.add(port)
  }
  pinnedLocal.delete(port)
  void refresh()
}

function closeAllForwards(): void {
  for (const f of forwards.values()) f.server.close()
  forwards.clear()
}

// ---------- Lokale Ports aus den Terminals ----------

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((done) => {
    execFile(cmd, args, { timeout: 4000, maxBuffer: 4 * 1024 * 1024 }, (_err, stdout) => done(String(stdout ?? '')))
  })
}

/** Alle Nachfahren der Terminal-Shells (Dev-Server laufen als Kind der Shell). */
async function descendants(rootPids: number[]): Promise<Set<number>> {
  const out = await run('ps', ['-A', '-o', 'pid=,ppid='])
  const children = new Map<number, number[]>()
  for (const line of out.split('\n')) {
    const [pid, ppid] = line.trim().split(/\s+/).map(Number)
    if (!pid) continue
    children.set(ppid, [...(children.get(ppid) ?? []), pid])
  }
  const all = new Set<number>()
  const queue = [...rootPids]
  while (queue.length) {
    const p = queue.pop()!
    if (all.has(p)) continue
    all.add(p)
    queue.push(...(children.get(p) ?? []))
  }
  return all
}

/** Lauschende TCP-Ports mit Prozess: lsof (macOS, die meisten Linux) oder ss (Linux). */
async function listeners(): Promise<{ pid: number; name: string; port: number }[]> {
  const result: { pid: number; name: string; port: number }[] = []
  const lsof = await run('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN', '-Fpcn'])
  if (lsof) {
    let pid = 0
    let name = ''
    for (const line of lsof.split('\n')) {
      if (line[0] === 'p') pid = Number(line.slice(1))
      else if (line[0] === 'c') name = line.slice(1)
      else if (line[0] === 'n') {
        const port = Number(line.slice(line.lastIndexOf(':') + 1))
        if (port) result.push({ pid, name, port })
      }
    }
    return result
  }
  // ss -ltnpH: „LISTEN 0 511 *:3000 *:* users:(("node",pid=123,fd=20))“
  const ss = await run('ss', ['-ltnpH'])
  for (const line of ss.split('\n')) {
    const f = line.trim().split(/\s+/)
    const port = Number(f[3]?.slice(f[3].lastIndexOf(':') + 1))
    const m = line.match(/\("([^"]+)",pid=(\d+)/)
    if (port && m) result.push({ pid: Number(m[2]), name: m[1], port })
  }
  return result
}

async function localPorts(): Promise<PortInfo[]> {
  const pids = terminal.localPids()
  const found = new Map<number, PortInfo>()
  if (pids.length) {
    const family = await descendants(pids)
    for (const l of await listeners()) {
      if (!family.has(l.pid) || found.has(l.port)) continue
      found.set(l.port, { port: l.port, source: 'local', process: l.name, forwarded: false, url: `http://localhost:${l.port}` })
    }
  }
  for (const port of pinnedLocal) {
    if (!found.has(port)) found.set(port, { port, source: 'local', forwarded: true, url: `http://localhost:${port}` })
    else found.get(port)!.forwarded = true
  }
  return [...found.values()]
}

// ---------- Container ----------

async function containerPorts(): Promise<PortInfo[]> {
  if (!containerId) return []
  const listening = await devcontainer.listeningPorts(containerId)
  // Neue Dienste automatisch weiterleiten (VS Code macht das genauso)
  for (const port of listening) {
    if (!forwards.has(port) && !ignored.has(port)) await forward(port, false).catch(() => undefined)
  }
  const result: PortInfo[] = []
  for (const f of forwards.values()) {
    if (!f.pinned && !listening.includes(f.port)) {
      // Dienst beendet und nicht fest eingetragen: Weiterleitung aufräumen
      f.server.close()
      forwards.delete(f.port)
      continue
    }
    result.push({
      port: f.port,
      source: 'container',
      localPort: f.localPort,
      forwarded: f.pinned,
      url: `http://localhost:${f.localPort}`
    })
  }
  return result
}

// ---------- Abfrage ----------

let busy = false
export async function refresh(): Promise<PortInfo[]> {
  if (busy) return JSON.parse(last || '[]')
  busy = true
  try {
    const list = [...(await containerPorts()), ...(await localPorts())].sort((a, b) => a.port - b.port)
    const json = JSON.stringify(list)
    if (json !== last) {
      last = json
      send('ports:changed', list)
    }
    return list
  } finally {
    busy = false
  }
}

export function list(): PortInfo[] {
  return JSON.parse(last || '[]')
}

export function start(s: Send): void {
  send = s
  timer ??= setInterval(() => void refresh(), 3000)
}

export function stopPolling(): void {
  if (timer) clearInterval(timer)
  timer = null
  closeAllForwards()
}

/** Projekt geöffnet oder Container gestartet/gestoppt: Ziel der Weiterleitungen aktualisieren. */
export async function setProject(dir: string | null): Promise<void> {
  if (dir !== root) {
    root = dir
    ignored.clear()
    pinnedLocal.clear()
  }
  const cid = root ? await devcontainer.runningContainer(root).catch(() => null) : null
  if (cid !== containerId) {
    closeAllForwards()
    containerId = cid
  }
  void refresh()
}

/** Nach dem Start eines Containers: Ports aus forwardPorts weiterleiten. */
export async function containerStarted(dir: string, cid: string, forwardPorts: number[]): Promise<void> {
  root = dir
  if (cid !== containerId) closeAllForwards()
  containerId = cid
  ignored.clear()
  for (const p of forwardPorts) await forward(p, true).catch(() => undefined)
  void refresh()
}
