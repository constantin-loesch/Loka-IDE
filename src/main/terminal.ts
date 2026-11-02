// Integriertes Terminal: echte Pseudo-Terminals (node-pty) – lokal oder im Devcontainer.
import { randomUUID } from 'node:crypto'
import { chmodSync, existsSync, statSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import * as pty from 'node-pty'
import type { TerminalCreateOptions, TerminalInfo } from '../shared/types'
import { defaultShell, userPath } from './agentTools'
import * as devcontainer from './devcontainer'

interface Term {
  info: TerminalInfo
  proc: pty.IPty
}

const terms = new Map<string, Term>()
let counter = 0

type Send = (channel: string, payload: unknown) => void

/** Shell im Container: bash, sonst sh. */
const CONTAINER_SHELL = 'if command -v bash >/dev/null 2>&1; then exec bash -l; else exec sh -l; fi'

/**
 * node-pty startet Shells über „spawn-helper“. Fehlt dessen Ausführungsrecht (passiert bei
 * manchen npm-Installationen), schlägt jeder Start mit „posix_spawnp failed“ fehl.
 */
let helperChecked = false
function ensureSpawnHelper(): void {
  if (helperChecked || process.platform === 'win32') return
  helperChecked = true
  try {
    const base = dirname(require.resolve('node-pty/package.json')).replace('app.asar', 'app.asar.unpacked')
    for (const dir of [join(base, 'build/Release'), join(base, 'prebuilds', `${process.platform}-${process.arch}`)]) {
      const helper = join(dir, 'spawn-helper')
      if (existsSync(helper) && (statSync(helper).mode & 0o111) === 0) chmodSync(helper, 0o755)
    }
  } catch {
    /* schreibgeschützt (signiertes App-Bundle) – dann hat es der Build schon richtig gemacht */
  }
}

export async function create(opts: TerminalCreateOptions, send: Send): Promise<TerminalInfo> {
  ensureSpawnHelper()
  const id = randomUUID()
  const cols = 100
  const rows = 30
  let proc: pty.IPty

  if (opts.target === 'container') {
    if (!(await devcontainer.runningContainer(opts.cwd))) throw new Error('Der Devcontainer läuft nicht. Starte ihn zuerst.')
    // `devcontainer exec` setzt Benutzer, Umgebung und Arbeitsordner aus der devcontainer.json
    const cmd = await devcontainer.cliCommand(['exec', '--workspace-folder', opts.cwd, 'sh', '-c', CONTAINER_SHELL])
    proc = pty.spawn(cmd.file, cmd.args, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: opts.cwd,
      env: { ...cmd.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' } as Record<string, string>
    })
  } else {
    const env = { ...process.env } as Record<string, string>
    delete env.ELECTRON_RUN_AS_NODE
    proc = pty.spawn(defaultShell(), ['-l'], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: opts.cwd,
      env: {
        ...env,
        PATH: await userPath(),
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        TERM_PROGRAM: 'LokalIDE',
        LANG: env.LANG || 'de_DE.UTF-8'
      }
    })
  }

  counter++
  const info: TerminalInfo = {
    id,
    title: opts.title ?? (opts.target === 'container' ? `Container ${counter}` : `${basename(defaultShell())} ${counter}`),
    target: opts.target,
    cwd: opts.cwd
  }
  terms.set(id, { info, proc })

  // Befehl erst schicken, wenn die Shell bereit ist (erste Ausgabe = Prompt)
  let pending = opts.command
  const runPending = (): void => {
    if (!pending) return
    const c = pending
    pending = undefined
    proc.write(c + '\r')
  }
  const fallback = pending ? setTimeout(runPending, 2500) : null

  proc.onData((data) => {
    send('terminal:data', { id, data })
    if (pending) setTimeout(runPending, 80)
  })
  proc.onExit(({ exitCode }) => {
    if (fallback) clearTimeout(fallback)
    terms.delete(id)
    send('terminal:exit', { id, code: exitCode })
  })
  return info
}

export function write(id: string, data: string): void {
  terms.get(id)?.proc.write(data)
}

export function resize(id: string, cols: number, rows: number): void {
  const t = terms.get(id)
  if (t && cols > 0 && rows > 0) {
    try {
      t.proc.resize(Math.floor(cols), Math.floor(rows))
    } catch {
      /* Prozess gerade beendet */
    }
  }
}

export function kill(id: string): void {
  const t = terms.get(id)
  if (!t) return
  terms.delete(id)
  try {
    t.proc.kill()
  } catch {
    /* schon beendet */
  }
}

export function killAll(): void {
  for (const id of [...terms.keys()]) kill(id)
}

export function list(): TerminalInfo[] {
  return [...terms.values()].map((t) => t.info)
}

/** Prozess-IDs der lokalen Shells – für die Erkennung offener Ports. */
export function localPids(): number[] {
  return [...terms.values()].filter((t) => t.info.target === 'local').map((t) => t.proc.pid)
}
