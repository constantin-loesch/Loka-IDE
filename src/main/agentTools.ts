// Werkzeuge, mit denen das Modell selbstständig im Projektordner arbeitet.
// Alles ist auf den Projektordner beschränkt; Schreiben und Befehle nur nach Freigabe (siehe llm.ts).
import { execFile, spawn } from 'node:child_process'
import { mkdir, open, readdir, readFile, realpath, stat, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { HIDDEN } from './files'

/** Damit Werkzeug-Ergebnisse den Kontext des Modells nicht sprengen – wird an die Kontextgröße angepasst. */
let MAX_OUTPUT_CHARS = 8000

/** Etwa 15 % des Kontexts pro Werkzeug-Ergebnis (≈ 4 Zeichen pro Token). */
export function setContextBudget(contextTokens: number): void {
  MAX_OUTPUT_CHARS = Math.round(Math.min(16000, Math.max(2500, contextTokens * 4 * 0.15)))
}
const MAX_SEARCH_FILE_BYTES = 1024 * 1024

function clip(text: string): string {
  if (text.length <= MAX_OUTPUT_CHARS) return text
  return text.slice(0, MAX_OUTPUT_CHARS) + '\n… (gekürzt – frag gezielter nach, z. B. mit Zeilenbereich)'
}

/** Löst einen Pfad relativ zum Projektordner auf und verhindert Zugriffe außerhalb. */
async function inside(root: string, path: string): Promise<string> {
  const realRoot = await realpath(root)
  const target = resolve(realRoot, path.replace(/^\/+/, '') || '.')
  const real = await realpath(target).catch(() => {
    throw new Error(`Nicht gefunden: ${path}. Finde den richtigen Pfad mit find_files oder search_code.`)
  })
  if (real !== realRoot && !real.startsWith(realRoot + sep)) throw new Error('Zugriff außerhalb des Projektordners ist nicht erlaubt.')
  return real
}

const rel = (root: string, abs: string): string => relative(root, abs) || '.'

async function isBinary(path: string): Promise<boolean> {
  const fh = await open(path, 'r')
  try {
    const buf = Buffer.alloc(4096)
    const { bytesRead } = await fh.read(buf, 0, buf.length, 0)
    return buf.subarray(0, bytesRead).includes(0)
  } finally {
    await fh.close()
  }
}

/** Alle Dateien unterhalb von dir, ohne versteckte Build-/Abhängigkeitsordner. */
async function* walk(dir: string, limit = { left: 5000 }): AsyncGenerator<string> {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    if (limit.left <= 0) return
    if (HIDDEN.has(e.name) || e.name === '.git') continue
    const full = join(dir, e.name)
    if (e.isDirectory()) yield* walk(full, limit)
    else if (e.isFile()) {
      limit.left--
      yield full
    }
  }
}

export async function listFiles(root: string, path: string, depth: number): Promise<string> {
  const start = await inside(root, path)
  const lines: string[] = []
  const maxDepth = Math.min(Math.max(depth || 1, 1), 4)

  const visit = async (dir: string, level: number): Promise<void> => {
    if (lines.length >= 400) return
    const entries = (await readdir(dir, { withFileTypes: true }))
      .filter((e) => !HIDDEN.has(e.name) && e.name !== '.git')
      .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))
    for (const e of entries) {
      if (lines.length >= 400) {
        lines.push('… (weitere Einträge ausgelassen)')
        return
      }
      const indent = '  '.repeat(level)
      if (e.isDirectory()) {
        lines.push(`${indent}${e.name}/`)
        if (level + 1 < maxDepth) await visit(join(dir, e.name), level + 1)
      } else {
        lines.push(`${indent}${e.name}`)
      }
    }
  }
  await visit(start, 0)
  return clip(`Inhalt von ${rel(await realpath(root), start)}:\n${lines.join('\n') || '(leer)'}`)
}

export async function readFileLines(root: string, path: string, startLine: number, endLine: number): Promise<string> {
  const file = await inside(root, path)
  if ((await stat(file)).isDirectory()) return `${path} ist ein Ordner – benutze list_files.`
  if (await isBinary(file)) return `${path} ist eine Binärdatei und kann nicht gelesen werden.`
  const all = (await readFile(file, 'utf8')).split('\n')
  const from = Math.max(1, startLine || 1)
  const to = Math.min(all.length, endLine > 0 ? endLine : all.length)
  const width = String(to).length
  const body = all
    .slice(from - 1, to)
    .map((l, i) => `${String(from + i).padStart(width)}| ${l}`)
    .join('\n')
  return clip(`${rel(await realpath(root), file)} (Zeilen ${from}–${to} von ${all.length}):\n${body}`)
}

export async function searchCode(root: string, query: string, path: string): Promise<string> {
  if (!query.trim()) return 'Leerer Suchbegriff.'
  const start = await inside(root, path)
  let re: RegExp
  try {
    re = new RegExp(query, 'i')
  } catch {
    re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
  }
  const hits: string[] = []
  const files = (await stat(start)).isFile() ? [start] : walk(start)
  for await (const file of files) {
    if (hits.length >= 60) break
    try {
      const s = await stat(file)
      if (s.size > MAX_SEARCH_FILE_BYTES || (await isBinary(file))) continue
      const lines = (await readFile(file, 'utf8')).split('\n')
      for (let i = 0; i < lines.length && hits.length < 60; i++) {
        if (re.test(lines[i])) hits.push(`${rel(await realpath(root), file)}:${i + 1}: ${lines[i].trim().slice(0, 200)}`)
      }
    } catch {
      // unlesbare Datei überspringen
    }
  }
  if (hits.length === 0) return `Keine Treffer für „${query}“.`
  return clip(`${hits.length}${hits.length >= 60 ? '+' : ''} Treffer für „${query}“:\n${hits.join('\n')}`)
}

export async function findFiles(root: string, pattern: string): Promise<string> {
  // Einfache Platzhalter: * und ?; sonst Teilstring im Pfad
  const p = pattern.trim().toLowerCase()
  if (!p) return 'Leeres Suchmuster.'
  const re = /[*?]/.test(p)
    ? new RegExp('^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$')
    : null
  const realRoot = await realpath(root)
  const found: string[] = []
  for await (const file of walk(realRoot)) {
    const r = rel(realRoot, file).toLowerCase()
    const name = r.split('/').pop()!
    if (re ? re.test(name) || re.test(r) : r.includes(p)) found.push(rel(realRoot, file))
    if (found.length >= 100) break
  }
  return found.length ? clip(`${found.length} Datei(en):\n${found.join('\n')}`) : `Keine Datei passt zu „${pattern}“.`
}

/** Prüft nur, ob die Datei existiert – das Öffnen selbst macht die Oberfläche. */
export async function resolveForOpen(root: string, path: string): Promise<string> {
  const file = await inside(root, path)
  if ((await stat(file)).isDirectory()) throw new Error(`${path} ist ein Ordner.`)
  return file
}

// ---------- Schreibende Werkzeuge (nur nach Freigabe) ----------

const MAX_WRITE_BYTES = 1024 * 1024

/** Zielpfad für Schreibzugriffe – auch für Dateien, die es noch nicht gibt. */
async function writableTarget(root: string, path: string): Promise<{ abs: string; rel: string; exists: boolean }> {
  const realRoot = await realpath(root)
  const clean = path.replace(/^\/+/, '')
  if (!clean) throw new Error('Kein Dateipfad angegeben.')
  const abs = resolve(realRoot, clean)
  if (!abs.startsWith(realRoot + sep)) throw new Error('Schreiben außerhalb des Projektordners ist nicht erlaubt.')
  const relPath = relative(realRoot, abs)
  if (relPath.split(sep).includes('.git')) throw new Error('Der .git-Ordner darf nicht verändert werden.')

  // Vorhandene Zwischenordner dürfen nicht per Symlink nach außen zeigen
  let probe = abs
  while (probe !== realRoot) {
    const real = await realpath(probe).catch(() => null)
    if (real) {
      if (real !== realRoot && !real.startsWith(realRoot + sep)) throw new Error('Pfad zeigt aus dem Projektordner heraus.')
      break
    }
    probe = resolve(probe, '..')
  }
  const s = await stat(abs).catch(() => null)
  if (s?.isDirectory()) throw new Error(`${path} ist ein Ordner.`)
  return { abs, rel: relPath, exists: !!s }
}

export interface PlannedWrite {
  abs: string
  rel: string
  before: string
  after: string
  isNew: boolean
}

/** Prüft write_file und liefert alten/neuen Inhalt für die Freigabe – schreibt noch nichts. */
export async function planWrite(root: string, path: string, content: string): Promise<PlannedWrite> {
  if (Buffer.byteLength(content) > MAX_WRITE_BYTES) throw new Error('Inhalt ist zu groß (max. 1 MB).')
  const t = await writableTarget(root, path)
  const before = t.exists ? await readFile(t.abs, 'utf8') : ''
  if (t.exists && (await isBinary(t.abs))) throw new Error(`${path} ist eine Binärdatei.`)
  return { abs: t.abs, rel: t.rel, before, after: content, isNew: !t.exists }
}

/** Prüft edit_file: Der alte Text muss genau einmal vorkommen. */
export async function planEdit(root: string, path: string, oldText: string, newText: string): Promise<PlannedWrite & { snippetBefore: string; snippetAfter: string }> {
  const t = await writableTarget(root, path)
  if (!t.exists) throw new Error(`Nicht gefunden: ${path}. Neue Dateien legst du mit write_file an.`)
  if (!oldText) throw new Error('old_text ist leer. Gib den genauen Text an, der ersetzt werden soll.')
  const before = await readFile(t.abs, 'utf8')
  const count = before.split(oldText).length - 1
  if (count > 1) throw new Error(`old_text kommt ${count}-mal in ${path} vor. Nimm mehr umgebende Zeilen dazu, damit die Stelle eindeutig ist.`)
  if (count === 1) {
    const after = before.replace(oldText, () => newText)
    return { abs: t.abs, rel: t.rel, before, after, isNew: false, snippetBefore: oldText, snippetAfter: newText }
  }

  // Kleine Modelle geben den alten Text selten exakt wieder (andere Einrückung, Zeilen zusammengezogen,
  // Semikolons). Deshalb ohne Leerraum und Semikolons vergleichen – aber nur bei eindeutigem Treffer.
  const range = looseFind(before, oldText)
  if (range === 'mehrfach') throw new Error(`old_text passt an mehreren Stellen in ${path}. Nimm mehr umgebende Zeilen dazu.`)
  if (!range) {
    throw new Error(
      `old_text kommt in ${path} nicht vor. Kopiere den Text exakt aus dem aktuellen Inhalt unten (ohne Zeilennummern) ` +
        `oder schreib die Datei mit write_file komplett neu.\n\nAktueller Inhalt von ${t.rel}:\n${numbered(before)}`
    )
  }
  const [start, end] = range
  const after = before.slice(0, start) + newText + before.slice(end)
  return { abs: t.abs, rel: t.rel, before, after, isNew: false, snippetBefore: before.slice(start, end), snippetAfter: newText }
}

const IGNORED = /[\s;]/

/** Sucht `needle` in `text` und ignoriert dabei Leerraum und Semikolons. Liefert die Stelle im Original. */
function looseFind(text: string, needle: string): [number, number] | 'mehrfach' | null {
  const map: number[] = []
  let norm = ''
  for (let i = 0; i < text.length; i++) {
    if (IGNORED.test(text[i])) continue
    norm += text[i]
    map.push(i)
  }
  const n = needle.split('').filter((c) => !IGNORED.test(c)).join('')
  if (n.length < 3) return null
  const first = norm.indexOf(n)
  if (first < 0) return null
  if (norm.indexOf(n, first + 1) >= 0) return 'mehrfach'
  let start = map[first]
  let end = map[first + n.length - 1] + 1
  // Ganze Zeilen ersetzen, wenn der Treffer am Zeilenanfang beginnt, damit die Einrückung stimmt
  const lineStart = text.lastIndexOf('\n', start - 1) + 1
  if (/^[ \t]*$/.test(text.slice(lineStart, start))) start = lineStart
  // Ein direkt folgendes Semikolon gehört noch dazu
  if (text[end] === ';') end++
  return [start, end]
}

function numbered(text: string, max = 120): string {
  const lines = text.split('\n')
  const shown = lines.slice(0, max).map((l, i) => `${String(i + 1).padStart(String(Math.min(lines.length, max)).length)}| ${l}`)
  return shown.join('\n') + (lines.length > max ? `\n… (${lines.length - max} weitere Zeilen)` : '')
}

/** Ersetzt die Zeilen start–end (1-basiert, inklusive) – einfacher für kleine Modelle als exakter Text. */
export async function planReplaceLines(root: string, path: string, start: number, end: number, newText: string): Promise<PlannedWrite & { snippetBefore: string; snippetAfter: string }> {
  const t = await writableTarget(root, path)
  if (!t.exists) throw new Error(`Nicht gefunden: ${path}. Neue Dateien legst du mit write_file an.`)
  const before = await readFile(t.abs, 'utf8')
  const lines = before.split('\n')
  if (!Number.isInteger(start) || start < 1 || start > lines.length + 1) {
    throw new Error(`start_line ${start} liegt außerhalb der Datei (1–${lines.length}).\n\nAktueller Inhalt von ${t.rel}:\n${numbered(before)}`)
  }
  const last = Math.min(Math.max(end || start, start - 1), lines.length)
  const removed = lines.slice(start - 1, last)
  // Einen abschließenden Zeilenumbruch nicht verdoppeln
  const inserted = newText === '' ? [] : newText.replace(/\n$/, '').split('\n')
  const after = [...lines.slice(0, start - 1), ...inserted, ...lines.slice(last)].join('\n')
  return { abs: t.abs, rel: t.rel, before, after, isNew: false, snippetBefore: removed.join('\n'), snippetAfter: inserted.join('\n') }
}

export async function applyWrite(plan: PlannedWrite): Promise<void> {
  await mkdir(dirname(plan.abs), { recursive: true })
  await writeFile(plan.abs, plan.after, 'utf8')
}

// ---------- Terminal ----------

/** Befehle, die immer nachgefragt werden – auch im Automatik-Modus. */
const DANGEROUS: [RegExp, string][] = [
  [/\bsudo\b/, 'Administrator-Rechte (sudo)'],
  [/\brm\s+(-\w*[rRf]|--recursive|--force)/, 'Rekursives/erzwungenes Löschen'],
  [/(^|[;&|]\s*)(rm|rmdir|unlink)\s/, 'Löscht Dateien'],
  [/\bgit\s+push\b/, 'Hochladen zu einem Remote (git push)'],
  [/\bgit\s+(reset\s+--hard|clean\s+-\w*f|checkout\s+--\s|restore\b)/, 'Verwirft Änderungen in Git'],
  [/--force\b|\s-f\b.*\bpush\b/, 'Erzwungene Aktion (--force)'],
  [/\b(curl|wget)\b[^|]*\|\s*(sh|bash|zsh|python\d?|node)\b/, 'Lädt ein Skript herunter und führt es aus'],
  [/\b(mkfs|dd\s+if=|diskutil|shutdown|reboot|halt)\b/, 'System-/Datenträger-Befehl'],
  [/\bchmod\s+-R|\bchown\b/, 'Ändert Rechte/Besitzer'],
  [/\b(npm|yarn|pnpm)\s+publish\b/, 'Veröffentlicht ein Paket'],
  [/\b(kill|killall|pkill)\b/, 'Beendet Prozesse'],
  [/(^|[^<])>\s*\/(?!dev\/null)/, 'Schreibt in eine Datei außerhalb des Projekts'],
  [/~\/|\$HOME|\.\.\/|\bcd\s+(\.\.|\/|~)/, 'Greift auf Pfade außerhalb des Projekts zu']
]

// ---------- Syntaxprüfung nach dem Schreiben ----------

function runCheck(cmd: string, args: string[], env: NodeJS.ProcessEnv = process.env): Promise<string | null> {
  return new Promise((done) => {
    execFile(cmd, args, { timeout: 15000, env }, (err, _out, stderr) => {
      if (!err) return done(null)
      // Programm nicht installiert → keine Aussage möglich
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return done(null)
      done(String(stderr || err.message).trim().split('\n').slice(0, 12).join('\n'))
    })
  })
}

/**
 * Schnelle Syntaxprüfung je nach Dateityp. Liefert eine Fehlermeldung oder null.
 * Kleine Modelle machen oft Klammer- oder Einrückungsfehler – so merken sie es sofort.
 */
export async function syntaxCheck(abs: string): Promise<string | null> {
  const ext = abs.slice(abs.lastIndexOf('.') + 1).toLowerCase()
  if (ext === 'json') {
    try {
      JSON.parse(await readFile(abs, 'utf8'))
      return null
    } catch (err) {
      return err instanceof Error ? err.message : String(err)
    }
  }
  const PATH = await userPath()
  if (['js', 'mjs', 'cjs'].includes(ext)) {
    // Electron kann sich wie Node verhalten – dann braucht es kein installiertes Node
    return runCheck(process.execPath, ['--check', abs], { ...process.env, ELECTRON_RUN_AS_NODE: '1', PATH })
  }
  if (ext === 'py') return runCheck('python3', ['-m', 'py_compile', abs], { ...process.env, PATH })
  if (ext === 'sh' || ext === 'bash') return runCheck('bash', ['-n', abs], { ...process.env, PATH })
  return null
}

/** Welcher Befehl führt die Tests dieses Projekts aus? Für die Projektübersicht. */
export async function detectTestCommand(root: string): Promise<string | null> {
  const has = async (f: string): Promise<boolean> => !!(await stat(join(root, f)).catch(() => null))
  try {
    const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
    if (pkg.scripts?.test && !/no test specified/.test(pkg.scripts.test)) return 'npm test'
  } catch {
    /* kein Node-Projekt */
  }
  if ((await has('pytest.ini')) || (await has('pyproject.toml')) || (await has('tests'))) return 'python3 -m pytest'
  if (await has('Cargo.toml')) return 'cargo test'
  if (await has('go.mod')) return 'go test ./...'
  if (await has('Makefile')) return 'make test'
  return null
}

export function dangerOf(command: string): string | undefined {
  return DANGEROUS.find(([re]) => re.test(command))?.[1]
}

/**
 * Aus dem Finder gestartete Apps bekommen nur einen minimalen PATH (ohne Homebrew, nvm …).
 * Deshalb einmalig den PATH der Login-Shell des Nutzers ermitteln.
 */
let shellPath: Promise<string> | null = null
/** Login-Shell des Nutzers – macOS nutzt standardmäßig zsh, Linux meist bash */
const defaultShell = (): string => process.env.SHELL || (process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash')
function userPath(): Promise<string> {
  shellPath ??= new Promise((done) => {
    const shell = defaultShell()
    execFile(shell, ['-ilc', 'printf "__PATH__%s__END__" "$PATH"'], { timeout: 5000 }, (_err, stdout) => {
      const m = String(stdout ?? '').match(/__PATH__(.*)__END__/)
      done(m?.[1] || process.env.PATH || '/usr/bin:/bin:/usr/sbin:/sbin')
    })
  })
  return shellPath
}

/** Behält Anfang und Ende – Fehlermeldungen stehen meist am Schluss. */
function clipMiddle(text: string, max = MAX_OUTPUT_CHARS): string {
  if (text.length <= max) return text
  const half = Math.floor(max / 2)
  return `${text.slice(0, half)}\n… (${text.length - max} Zeichen ausgelassen) …\n${text.slice(-half)}`
}

export async function runCommand(
  root: string,
  command: string,
  timeoutSec: number,
  signal: AbortSignal
): Promise<{ output: string; exitCode: number | null; timedOut: boolean }> {
  const cwd = await realpath(root)
  const PATH = await userPath()
  return new Promise((done) => {
    const shell = defaultShell()
    // Eigene Prozessgruppe, damit beim Abbrechen auch Kindprozesse beendet werden
    const child = spawn(shell, ['-c', command], {
      cwd,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PATH, CI: '1', GIT_TERMINAL_PROMPT: '0', FORCE_COLOR: '0', NO_COLOR: '1', PAGER: 'cat', GIT_PAGER: 'cat' }
    })
    let output = ''
    const collect = (b: Buffer): void => {
      output += b.toString('utf8')
      // Speicher begrenzen, Ende behalten
      if (output.length > 200_000) output = output.slice(-100_000)
    }
    child.stdout.on('data', collect)
    child.stderr.on('data', collect)

    let timedOut = false
    const kill = (): void => {
      try {
        if (child.pid) process.kill(-child.pid, 'SIGTERM')
      } catch {
        child.kill('SIGTERM')
      }
    }
    const timer = setTimeout(() => {
      timedOut = true
      kill()
    }, Math.max(5, timeoutSec) * 1000)
    signal.addEventListener('abort', kill, { once: true })

    child.on('close', (code) => {
      clearTimeout(timer)
      signal.removeEventListener('abort', kill)
      // ANSI-Farbcodes entfernen
      const clean = output.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').trim()
      done({ output: clipMiddle(clean), exitCode: code, timedOut })
    })
    child.on('error', (err) => {
      clearTimeout(timer)
      done({ output: err.message, exitCode: null, timedOut: false })
    })
  })
}
