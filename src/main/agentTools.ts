// Tools the model uses to work on its own in the project folder.
// Everything is restricted to the project folder; writing and commands only after approval (see agent.ts).
import { execFile, spawn } from 'node:child_process'
import { mkdir, open, readdir, readFile, realpath, stat, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { HIDDEN } from './files'
import { t as tr } from './i18n'

/** So that tool results don't blow up the model's context – adjusted to the context size. */
let MAX_OUTPUT_CHARS = 8000

/** About 15 % of the context per tool result (≈ 4 characters per token). */
export function setContextBudget(contextTokens: number): void {
  MAX_OUTPUT_CHARS = Math.round(Math.min(16000, Math.max(2500, contextTokens * 4 * 0.15)))
}
const MAX_SEARCH_FILE_BYTES = 1024 * 1024

function clip(text: string): string {
  if (text.length <= MAX_OUTPUT_CHARS) return text
  return text.slice(0, MAX_OUTPUT_CHARS) + '\n… (truncated – ask more specifically, e.g. with a line range)'
}

/** Resolves a path relative to the project folder and prevents access outside of it. */
async function inside(root: string, path: string): Promise<string> {
  const realRoot = await realpath(root)
  const target = resolve(realRoot, path.replace(/^\/+/, '') || '.')
  const real = await realpath(target).catch(() => {
    throw new Error(`Not found: ${path}. Find the right path with find_files or search_code.`)
  })
  if (real !== realRoot && !real.startsWith(realRoot + sep)) throw new Error('Access outside the project folder is not allowed.')
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

/** All files below dir, without hidden build/dependency folders. */
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
        lines.push('… (more entries omitted)')
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
  return clip(`Contents of ${rel(await realpath(root), start)}:\n${lines.join('\n') || '(empty)'}`)
}

export async function readFileLines(root: string, path: string, startLine: number, endLine: number): Promise<string> {
  const file = await inside(root, path)
  if ((await stat(file)).isDirectory()) return `${path} is a folder – use list_files.`
  if (await isBinary(file)) return `${path} is a binary file and cannot be read.`
  const all = (await readFile(file, 'utf8')).split('\n')
  const from = Math.max(1, startLine || 1)
  const to = Math.min(all.length, endLine > 0 ? endLine : all.length)
  const width = String(to).length
  const body = all
    .slice(from - 1, to)
    .map((l, i) => `${String(from + i).padStart(width)}| ${l}`)
    .join('\n')
  return clip(`${rel(await realpath(root), file)} (lines ${from}–${to} of ${all.length}):\n${body}`)
}

export async function searchCode(root: string, query: string, path: string): Promise<string> {
  if (!query.trim()) return 'Empty search term.'
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
      // skip unreadable file
    }
  }
  if (hits.length === 0) return `No matches for “${query}”.`
  return clip(`${hits.length}${hits.length >= 60 ? '+' : ''} matches for “${query}”:\n${hits.join('\n')}`)
}

export async function findFiles(root: string, pattern: string): Promise<string> {
  // Simple wildcards: * and ?; otherwise substring in the path
  const p = pattern.trim().toLowerCase()
  if (!p) return 'Empty search pattern.'
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
  return found.length ? clip(`${found.length} file(s):\n${found.join('\n')}`) : `No file matches “${pattern}”.`
}

/** Only checks that the file exists – the UI does the opening. */
export async function resolveForOpen(root: string, path: string): Promise<string> {
  const file = await inside(root, path)
  if ((await stat(file)).isDirectory()) throw new Error(`${path} is a folder.`)
  return file
}

// ---------- Writing tools (only after approval) ----------

const MAX_WRITE_BYTES = 1024 * 1024

/** Target path for writes – also for files that don't exist yet. */
async function writableTarget(root: string, path: string): Promise<{ abs: string; rel: string; exists: boolean }> {
  const realRoot = await realpath(root)
  const clean = path.replace(/^\/+/, '')
  if (!clean) throw new Error('No file path given.')
  const abs = resolve(realRoot, clean)
  if (!abs.startsWith(realRoot + sep)) throw new Error('Writing outside the project folder is not allowed.')
  const relPath = relative(realRoot, abs)
  if (relPath.split(sep).includes('.git')) throw new Error('The .git folder must not be changed.')

  // Existing intermediate folders must not point outside via symlink
  let probe = abs
  while (probe !== realRoot) {
    const real = await realpath(probe).catch(() => null)
    if (real) {
      if (real !== realRoot && !real.startsWith(realRoot + sep)) throw new Error('Path points outside the project folder.')
      break
    }
    probe = resolve(probe, '..')
  }
  const s = await stat(abs).catch(() => null)
  if (s?.isDirectory()) throw new Error(`${path} is a folder.`)
  return { abs, rel: relPath, exists: !!s }
}

export interface PlannedWrite {
  abs: string
  rel: string
  before: string
  after: string
  isNew: boolean
}

/** Checks write_file and returns old/new content for the approval – doesn't write anything yet. */
export async function planWrite(root: string, path: string, content: string): Promise<PlannedWrite> {
  if (Buffer.byteLength(content) > MAX_WRITE_BYTES) throw new Error('Content is too large (max. 1 MB).')
  const t = await writableTarget(root, path)
  const before = t.exists ? await readFile(t.abs, 'utf8') : ''
  if (t.exists && (await isBinary(t.abs))) throw new Error(`${path} is a binary file.`)
  return { abs: t.abs, rel: t.rel, before, after: content, isNew: !t.exists }
}

/** Checks edit_file: the old text must occur exactly once. */
export async function planEdit(root: string, path: string, oldText: string, newText: string): Promise<PlannedWrite & { snippetBefore: string; snippetAfter: string }> {
  const t = await writableTarget(root, path)
  if (!t.exists) throw new Error(`Not found: ${path}. Create new files with write_file.`)
  if (!oldText) throw new Error('old_text is empty. Give the exact text that should be replaced.')
  const before = await readFile(t.abs, 'utf8')
  const count = before.split(oldText).length - 1
  if (count > 1) throw new Error(`old_text occurs ${count} times in ${path}. Include more surrounding lines so the location is unique.`)
  if (count === 1) {
    const after = before.replace(oldText, () => newText)
    return { abs: t.abs, rel: t.rel, before, after, isNew: false, snippetBefore: oldText, snippetAfter: newText }
  }

  // Small models rarely reproduce the old text exactly (different indentation, merged lines,
  // semicolons). So compare without whitespace and semicolons – but only for a unique match.
  const range = looseFind(before, oldText)
  if (range === 'multiple') throw new Error(`old_text matches several places in ${path}. Include more surrounding lines.`)
  if (!range) {
    throw new Error(
      `old_text does not occur in ${path}. Copy the text exactly from the current content below (without line numbers) ` +
        `or rewrite the file completely with write_file.\n\nCurrent content of ${t.rel}:\n${numbered(before)}`
    )
  }
  const [start, end] = range
  const after = before.slice(0, start) + newText + before.slice(end)
  return { abs: t.abs, rel: t.rel, before, after, isNew: false, snippetBefore: before.slice(start, end), snippetAfter: newText }
}

const IGNORED = /[\s;]/

/** Finds `needle` in `text`, ignoring whitespace and semicolons. Returns the position in the original. */
function looseFind(text: string, needle: string): [number, number] | 'multiple' | null {
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
  if (norm.indexOf(n, first + 1) >= 0) return 'multiple'
  let start = map[first]
  let end = map[first + n.length - 1] + 1
  // Replace whole lines if the match starts at the beginning of a line, so the indentation is right
  const lineStart = text.lastIndexOf('\n', start - 1) + 1
  if (/^[ \t]*$/.test(text.slice(lineStart, start))) start = lineStart
  // A semicolon directly following still belongs to it
  if (text[end] === ';') end++
  return [start, end]
}

function numbered(text: string, max = 120): string {
  const lines = text.split('\n')
  const shown = lines.slice(0, max).map((l, i) => `${String(i + 1).padStart(String(Math.min(lines.length, max)).length)}| ${l}`)
  return shown.join('\n') + (lines.length > max ? `\n… (${lines.length - max} more lines)` : '')
}

/** Replaces lines start–end (1-based, inclusive) – easier for small models than exact text. */
export async function planReplaceLines(root: string, path: string, start: number, end: number, newText: string): Promise<PlannedWrite & { snippetBefore: string; snippetAfter: string }> {
  const t = await writableTarget(root, path)
  if (!t.exists) throw new Error(`Not found: ${path}. Create new files with write_file.`)
  const before = await readFile(t.abs, 'utf8')
  const lines = before.split('\n')
  if (!Number.isInteger(start) || start < 1 || start > lines.length + 1) {
    throw new Error(`start_line ${start} is outside the file (1–${lines.length}).\n\nCurrent content of ${t.rel}:\n${numbered(before)}`)
  }
  const last = Math.min(Math.max(end || start, start - 1), lines.length)
  const removed = lines.slice(start - 1, last)
  // Don't double a trailing line break
  const inserted = newText === '' ? [] : newText.replace(/\n$/, '').split('\n')
  const after = [...lines.slice(0, start - 1), ...inserted, ...lines.slice(last)].join('\n')
  return { abs: t.abs, rel: t.rel, before, after, isNew: false, snippetBefore: removed.join('\n'), snippetAfter: inserted.join('\n') }
}

export async function applyWrite(plan: PlannedWrite): Promise<void> {
  await mkdir(dirname(plan.abs), { recursive: true })
  await writeFile(plan.abs, plan.after, 'utf8')
}

// ---------- Terminal ----------

/** Commands that are always asked for – even in automatic mode. Reasons are shown to the user. */
const DANGEROUS: [RegExp, string][] = [
  [/\bsudo\b/, 'Administrator-Rechte (sudo)'],
  [/\brm\s+(-\w*[rRf]|--recursive|--force)/, 'Recursive/forced deletion'],
  [/(^|[;&|]\s*)(rm|rmdir|unlink)\s/, 'Deletes files'],
  [/\bgit\s+push\b/, 'Uploads to a remote (git push)'],
  [/\bgit\s+(reset\s+--hard|clean\s+-\w*f|checkout\s+--\s|restore\b)/, 'Discards changes in Git'],
  [/--force\b|\s-f\b.*\bpush\b/, 'Forced action (--force)'],
  [/\b(curl|wget)\b[^|]*\|\s*(sh|bash|zsh|python\d?|node)\b/, 'Downloads a script and runs it'],
  [/\b(mkfs|dd\s+if=|diskutil|shutdown|reboot|halt)\b/, 'System/disk command'],
  [/\bchmod\s+-R|\bchown\b/, 'Changes permissions/owner'],
  [/\b(npm|yarn|pnpm)\s+publish\b/, 'Publishes a package'],
  [/\b(kill|killall|pkill)\b/, 'Terminates processes'],
  [/(^|[^<])>\s*\/(?!dev\/null)/, 'Writes to a file outside the project'],
  [/~\/|\$HOME|\.\.\/|\bcd\s+(\.\.|\/|~)/, 'Accesses paths outside the project']
]

// ---------- Syntax check after writing ----------

function runCheck(cmd: string, args: string[], env: NodeJS.ProcessEnv = process.env): Promise<string | null> {
  return new Promise((done) => {
    execFile(cmd, args, { timeout: 15000, env }, (err, _out, stderr) => {
      if (!err) return done(null)
      // Program not installed → no statement possible
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return done(null)
      done(String(stderr || err.message).trim().split('\n').slice(0, 12).join('\n'))
    })
  })
}

/**
 * Quick syntax check depending on the file type. Returns an error message or null.
 * Small models often make bracket or indentation errors – this way they notice right away.
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
    // Electron can behave like Node – then no installed Node is needed
    return runCheck(process.execPath, ['--check', abs], { ...process.env, ELECTRON_RUN_AS_NODE: '1', PATH })
  }
  if (ext === 'py') return runCheck('python3', ['-m', 'py_compile', abs], { ...process.env, PATH })
  if (ext === 'sh' || ext === 'bash') return runCheck('bash', ['-n', abs], { ...process.env, PATH })
  return null
}

/** Which command runs this project's tests? For the project overview. */
export async function detectTestCommand(root: string): Promise<string | null> {
  const has = async (f: string): Promise<boolean> => !!(await stat(join(root, f)).catch(() => null))
  try {
    const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
    if (pkg.scripts?.test && !/no test specified/.test(pkg.scripts.test)) return 'npm test'
  } catch {
    /* not a Node project */
  }
  if ((await has('pytest.ini')) || (await has('pyproject.toml')) || (await has('tests'))) return 'python3 -m pytest'
  if (await has('Cargo.toml')) return 'cargo test'
  if (await has('go.mod')) return 'go test ./...'
  if (await has('Makefile')) return 'make test'
  return null
}

export function dangerOf(command: string): string | undefined {
  const reason = DANGEROUS.find(([re]) => re.test(command))?.[1]
  return reason ? tr(reason) : undefined
}

/**
 * Apps started from the Finder only get a minimal PATH (without Homebrew, nvm …).
 * So determine the PATH of the user's login shell once.
 */
let shellPath: Promise<string> | null = null
/** The user's login shell – macOS uses zsh by default, Linux mostly bash */
export const defaultShell = (): string => process.env.SHELL || (process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash')
export function userPath(): Promise<string> {
  shellPath ??= new Promise((done) => {
    const shell = defaultShell()
    execFile(shell, ['-ilc', 'printf "__PATH__%s__END__" "$PATH"'], { timeout: 5000 }, (_err, stdout) => {
      const m = String(stdout ?? '').match(/__PATH__(.*)__END__/)
      done(m?.[1] || process.env.PATH || '/usr/bin:/bin:/usr/sbin:/sbin')
    })
  })
  return shellPath
}

/** Keeps start and end – error messages are usually at the end. */
function clipMiddle(text: string, max = MAX_OUTPUT_CHARS): string {
  if (text.length <= max) return text
  const half = Math.floor(max / 2)
  return `${text.slice(0, half)}\n… (${text.length - max} characters omitted) …\n${text.slice(-half)}`
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
    // Own process group so child processes are terminated on abort too
    const child = spawn(shell, ['-c', command], {
      cwd,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PATH, CI: '1', GIT_TERMINAL_PROMPT: '0', FORCE_COLOR: '0', NO_COLOR: '1', PAGER: 'cat', GIT_PAGER: 'cat' }
    })
    let output = ''
    const collect = (b: Buffer): void => {
      output += b.toString('utf8')
      // Limit memory, keep the end
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
      // Remove ANSI color codes
      const clean = output.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').trim()
      done({ output: clipMiddle(clean), exitCode: code, timedOut })
    })
    child.on('error', (err) => {
      clearTimeout(timer)
      done({ output: err.message, exitCode: null, timedOut: false })
    })
  })
}
