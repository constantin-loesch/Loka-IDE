// The model's tools and the approval rules for everything that changes something.
// Texts for the model are English; texts shown in the chat go through t().
import { randomUUID } from 'node:crypto'
import type { AgentOpenFile, ApprovalAnswer, ApprovalRequest, ChatMode } from '../shared/types'
import { rm, writeFile } from 'node:fs/promises'
import * as tools from './agentTools'
import { getSettings } from './settings'
import { t } from './i18n'

/** Everything a tool needs from outside. */
export interface AgentContext {
  root: string
  requestId: string
  signal: AbortSignal
  /** Show progress in the UI */
  report: (label: string) => void
  /** Show output for the last step (e.g. terminal output) */
  reportResult: (text: string) => void
  openFile: (f: AgentOpenFile) => void
  /** After writing – so the editor reloads the file */
  fileChanged: (path: string) => void
  /** Asks the user and waits for the answer */
  askUser: (req: ApprovalRequest) => void
}

type Params = Record<string, any>

interface Tool {
  /** From which mode on the tool is available */
  mode: 'read' | 'agent'
  description: string
  params: Record<string, { type: 'string' | 'integer'; description?: string }>
  /** Values for missing parameters – small models like to leave some out */
  defaults: Params
  label: (p: Params) => string
  run: (ctx: AgentContext, p: Params) => Promise<string>
}

// ---------- Approvals ----------

const pending = new Map<string, { resolve: (a: ApprovalAnswer) => void; signal: AbortSignal }>()
/** Kinds of actions permanently allowed for this chat */
const allowedForChat = new Set<'files' | 'commands'>()

export function answerApproval(a: ApprovalAnswer): void {
  pending.get(a.id)?.resolve(a)
  pending.delete(a.id)
}

/** New chat: permanent permissions expire. */
export function resetApprovals(): void {
  allowedForChat.clear()
  for (const [id, p] of pending) p.resolve({ id, approved: false, reason: 'Chat was reset.' })
  pending.clear()
}

/**
 * Decides whether an action may run without asking, otherwise asks the user.
 * Dangerous commands are always asked.
 */
async function approve(ctx: AgentContext, req: Omit<ApprovalRequest, 'id' | 'requestId'>): Promise<ApprovalAnswer> {
  const id = randomUUID()
  const kind = req.kind === 'command' ? 'commands' : 'files'
  const mode = getSettings().approvalMode
  const auto =
    !req.danger &&
    (allowedForChat.has(kind) || mode === 'auto-all' || (mode === 'auto-edits' && kind === 'files'))
  if (auto) return { id, approved: true }

  const answer = await new Promise<ApprovalAnswer>((resolve) => {
    pending.set(id, { resolve, signal: ctx.signal })
    ctx.signal.addEventListener('abort', () => answerApproval({ id, approved: false, reason: 'Cancelled.' }), { once: true })
    ctx.askUser({ ...req, id, requestId: ctx.requestId })
  })
  if (answer.approved && answer.always && !req.danger) allowedForChat.add(kind)
  return answer
}

// ---------- Backups for “undo” ----------

/** Per chat request the original content of every changed file (null = file was new). */
const backups = new Map<string, Map<string, string | null>>()

function rememberOriginal(requestId: string, abs: string, before: string, isNew: boolean): void {
  let files = backups.get(requestId)
  if (!files) {
    files = new Map()
    backups.set(requestId, files)
    // Keep only the last 30 answers
    if (backups.size > 30) backups.delete(backups.keys().next().value!)
  }
  // Only remember the state BEFORE the first change
  if (!files.has(abs)) files.set(abs, isNew ? null : before)
}

/** Restores all files an answer changed. Returns the paths. */
export async function revertRequest(requestId: string): Promise<string[]> {
  const files = backups.get(requestId)
  if (!files) return []
  const restored: string[] = []
  for (const [abs, original] of files) {
    if (original === null) await rm(abs, { force: true })
    else await writeFile(abs, original, 'utf8')
    restored.push(abs)
  }
  backups.delete(requestId)
  return restored
}

/** Names of functions, classes, constants and exports – to detect accidentally deleted code. */
function definedNames(code: string): Set<string> {
  const names = new Set<string>()
  const re = /\b(?:function\s*\*?|def|class|const|let|var|fn|func)\s+([A-Za-z_$][\w$]*)|\b(module\.exports|export\s+default)\b/g
  for (const m of code.matchAll(re)) names.add(m[1] ?? m[2].replace(/\s+/, ' '))
  return names
}

/** Writes an approved change, backs up the old state and checks the syntax. */
async function commitWrite(ctx: AgentContext, plan: tools.PlannedWrite, done: string): Promise<string> {
  rememberOriginal(ctx.requestId, plan.abs, plan.before, plan.isNew)
  await tools.applyWrite(plan)
  ctx.fileChanged(plan.abs)
  // Small models like to rewrite files and forget parts of them
  if (!plan.isNew) {
    const after = definedNames(plan.after)
    const lost = [...definedNames(plan.before)].filter((n) => !after.has(n))
    if (lost.length) done += `\n⚠ Warning: these definitions existed before and are now missing: ${lost.join(', ')}. If that was not intended, restore them.`
  }
  const syntax = await tools.syntaxCheck(plan.abs)
  if (syntax) {
    ctx.reportResult(t('Syntax error in {file}:', { file: plan.rel }) + `\n${syntax}`)
    return `${done}\n⚠ SYNTAX ERROR in ${plan.rel} – fix it right away:\n${syntax}`
  }
  return `${done} Syntax check: OK.`
}

const rejected = (a: ApprovalAnswer): string =>
  `The user declined this${a.reason ? `: ${a.reason}` : '.'} Do not continue with it on your own – ask or suggest an alternative.`

// ---------- Tools ----------

export const TOOLS: Record<string, Tool> = {
  list_files: {
    mode: 'read',
    description: 'Lists files and subfolders of a folder in the project. "." is the project folder.',
    params: {
      path: { type: 'string', description: 'Folder relative to the project, e.g. "." or "src"' },
      depth: { type: 'integer', description: 'How many levels deep (1–4)' }
    },
    defaults: { path: '.', depth: 2 },
    label: (p) => t('📂 Folder {path}', { path: p.path }),
    run: (ctx, p) => tools.listFiles(ctx.root, String(p.path), Number(p.depth))
  },
  find_files: {
    mode: 'read',
    description: 'Finds files by name. Supports * and ? as wildcards, otherwise substring search in the path.',
    params: { pattern: { type: 'string', description: 'e.g. "*.ts" or "config"' } },
    defaults: { pattern: '' },
    label: (p) => t('🔎 Files “{pattern}”', { pattern: p.pattern }),
    run: (ctx, p) => tools.findFiles(ctx.root, String(p.pattern))
  },
  search_code: {
    mode: 'read',
    description: 'Searches the contents of all files (case-insensitive, regex allowed). Returns file:line: text.',
    params: {
      query: { type: 'string', description: 'Search term or regular expression' },
      path: { type: 'string', description: 'Folder or file to search in; "." for everything' }
    },
    defaults: { query: '', path: '.' },
    label: (p) => (p.path !== '.' ? t('🔍 Search “{query}” in {path}', { query: p.query, path: p.path }) : t('🔍 Search “{query}”', { query: p.query })),
    run: (ctx, p) => tools.searchCode(ctx.root, String(p.query), String(p.path))
  },
  read_file: {
    mode: 'read',
    description: 'Reads a text file with line numbers. endLine 0 means up to the end.',
    params: {
      path: { type: 'string', description: 'File relative to the project' },
      startLine: { type: 'integer' },
      endLine: { type: 'integer' }
    },
    defaults: { path: '', startLine: 1, endLine: 0 },
    label: (p) =>
      p.startLine > 1 || p.endLine > 0
        ? t('📄 Reading {path} (lines {from}–{to})', { path: p.path, from: p.startLine, to: p.endLine || t('end') })
        : t('📄 Reading {path}', { path: p.path }),
    run: (ctx, p) => tools.readFileLines(ctx.root, String(p.path), Number(p.startLine), Number(p.endLine))
  },
  open_file: {
    mode: 'read',
    description: 'Opens a file in the user\'s editor and jumps to a line to show them a location.',
    params: {
      path: { type: 'string', description: 'File relative to the project' },
      line: { type: 'integer', description: 'Line number (1 = start)' }
    },
    defaults: { path: '', line: 1 },
    label: (p) => t('↗ Opening {path}', { path: `${p.path}${p.line > 1 ? `:${p.line}` : ''}` }),
    run: async (ctx, p) => {
      const path = await tools.resolveForOpen(ctx.root, String(p.path))
      ctx.openFile({ path, line: Math.max(1, Number(p.line) || 1) })
      return `${p.path} was opened in the editor.`
    }
  },

  edit_file: {
    mode: 'agent',
    description:
      'Changes an existing file: replaces old_text (must occur exactly once, without line numbers) with new_text. Read the file with read_file first.',
    params: {
      path: { type: 'string', description: 'File relative to the project' },
      old_text: { type: 'string', description: 'Exact previous text including indentation' },
      new_text: { type: 'string', description: 'New text' }
    },
    defaults: { path: '', old_text: '', new_text: '' },
    label: (p) => t('✏️ Editing {path}', { path: p.path }),
    run: async (ctx, p) => {
      const plan = await tools.planEdit(ctx.root, String(p.path), String(p.old_text), String(p.new_text))
      const a = await approve(ctx, {
        kind: 'edit',
        path: plan.abs,
        relPath: plan.rel,
        before: plan.snippetBefore,
        after: plan.snippetAfter
      })
      if (!a.approved) return rejected(a)
      return commitWrite(ctx, plan, `${plan.rel} was changed.`)
    }
  },
  replace_lines: {
    mode: 'agent',
    description:
      'Replaces lines start_line to end_line (as shown by read_file, inclusive) of an existing file with new_text. ' +
      'Often easier than edit_file. An empty new_text deletes the lines. To insert without deleting: end_line = start_line - 1.',
    params: {
      path: { type: 'string', description: 'File relative to the project' },
      start_line: { type: 'integer' },
      end_line: { type: 'integer' },
      new_text: { type: 'string', description: 'New text for these lines' }
    },
    defaults: { path: '', start_line: 0, end_line: 0, new_text: '' },
    label: (p) => t('✏️ Editing {path} (lines {from}–{to})', { path: p.path, from: p.start_line, to: p.end_line }),
    run: async (ctx, p) => {
      const plan = await tools.planReplaceLines(ctx.root, String(p.path), Number(p.start_line), Number(p.end_line), String(p.new_text))
      const a = await approve(ctx, { kind: 'edit', path: plan.abs, relPath: plan.rel, before: plan.snippetBefore, after: plan.snippetAfter })
      if (!a.approved) return rejected(a)
      return commitWrite(ctx, plan, `${plan.rel}: lines ${p.start_line}–${p.end_line} replaced.`)
    }
  },
  write_file: {
    mode: 'agent',
    description: 'Creates a new file or completely overwrites a file with content. For small changes prefer edit_file.',
    params: {
      path: { type: 'string', description: 'File relative to the project' },
      content: { type: 'string', description: 'Complete new content' }
    },
    defaults: { path: '', content: '' },
    label: (p) => t('📝 Writing {path}', { path: p.path }),
    run: async (ctx, p) => {
      const plan = await tools.planWrite(ctx.root, String(p.path), String(p.content))
      if (!plan.isNew && plan.before === plan.after) return `${plan.rel} is already in this state.`
      const a = await approve(ctx, {
        kind: 'write',
        path: plan.abs,
        relPath: plan.rel,
        before: plan.before,
        after: plan.after,
        isNew: plan.isNew
      })
      if (!a.approved) return rejected(a)
      return commitWrite(ctx, plan, plan.isNew ? `${plan.rel} was created.` : `${plan.rel} was overwritten.`)
    }
  },
  run_command: {
    mode: 'agent',
    description:
      'Runs a terminal command in the project folder (e.g. tests, build, linter, git status, npm install) and returns the output. ' +
      'No interactive commands and no long-running processes like dev servers.',
    params: { command: { type: 'string', description: 'Shell command, e.g. "npm test"' } },
    defaults: { command: '' },
    label: (p) => `$ ${p.command}`,
    run: async (ctx, p) => {
      const command = String(p.command).trim()
      if (!command) return 'Error: no command given.'
      const a = await approve(ctx, { kind: 'command', command, danger: tools.dangerOf(command) })
      if (!a.approved) return rejected(a)
      const { output, exitCode, timedOut } = await tools.runCommand(ctx.root, command, getSettings().commandTimeout, ctx.signal)
      const status = timedOut
        ? `Aborted after ${getSettings().commandTimeout} s (time limit).`
        : exitCode === 0
          ? 'Succeeded (exit code 0).'
          : `Failed (exit code ${exitCode}).`
      const shown = timedOut
        ? t('Aborted after {seconds} s (time limit).', { seconds: getSettings().commandTimeout })
        : exitCode === 0
          ? t('Succeeded (exit code 0).')
          : t('Failed (exit code {code}).', { code: String(exitCode) })
      ctx.reportResult(`${output || t('(no output)')}\n\n${shown}`)
      return `${status}\nOutput:\n${output || '(no output)'}`
    }
  }
}

export function toolsFor(mode: ChatMode): Record<string, Tool> {
  if (mode === 'chat') return {}
  return Object.fromEntries(Object.entries(TOOLS).filter(([, t]) => mode === 'agent' || t.mode === 'read'))
}

/** Did the user decline the action? */
const rejectedByUser = (result: string): boolean => result.startsWith('The user declined')

/** Did a tool call not work (error or declined by the user)? */
export const failed = (result: string): boolean => result.startsWith('Error') || rejectedByUser(result)

/** Runs tools, counts the calls and reports them to the UI. */
export function makeRunner(ctx: AgentContext, available: Record<string, Tool>) {
  const limit = getSettings().maxToolCalls
  let calls = 0
  /** Counts file changes – after that, reading and commands may sensibly be repeated */
  let version = 0
  /** Files actually written (relative to the project) */
  const changed = new Set<string>()
  /** Successful calls, to detect pointless repetitions */
  const done = new Set<string>()
  /** Failed calls with their error message – repeating them identically is useless */
  const failedCalls = new Map<string, string>()
  /** What really happened – for an honest summary (shown to the user) */
  const log: string[] = []
  let userRejected = false
  /** Did the last executed command fail? */
  let lastCommandFailed = false
  let commandsRun = 0
  /** Files in which the last write left a syntax error */
  const syntaxErrors = new Set<string>()

  const withDefaults = (tool: Tool, raw: Params): Params => {
    // Fill missing or empty parameters with defaults
    const p: Params = { ...tool.defaults }
    for (const [k, v] of Object.entries(raw ?? {})) if (v !== null && v !== undefined && v !== '') p[k] = v
    // Normalize Windows paths (".\\a\\b.py") and a leading "./"
    if (typeof p.path === 'string') p.path = p.path.replace(/\\/g, '/').replace(/^(\.\/)+(?=.)/, '') || '.'
    return p
  }
  const signature = (name: string, p: Params): string =>
    // Writing the same content is always pointless, reading/commands only again after a change
    name === 'write_file' || name === 'edit_file' || name === 'replace_lines' ? `${name}:${JSON.stringify(p)}` : `${name}:${version}:${JSON.stringify(p)}`

  return {
    get exhausted() {
      return calls >= limit
    },
    changed,
    log,
    /** Did the user decline an action? Then the agent should not carry on by itself. */
    get userRejected() {
      return userRejected
    },
    get lastCommandFailed() {
      return lastCommandFailed
    },
    get commandsRun() {
      return commandsRun
    },
    syntaxErrors,
    /** Was exactly this call already executed successfully (with nothing changed since)? */
    seen(name: string, raw: Params): boolean {
      const tool = available[name]
      return !!tool && done.has(signature(name, withDefaults(tool, raw)))
    },
    /** Error message if exactly this call has failed before */
    failedBefore(name: string, raw: Params): string | undefined {
      const tool = available[name]
      return tool ? failedCalls.get(signature(name, withDefaults(tool, raw))) : undefined
    },
    async call(name: string, raw: Params): Promise<string> {
      const tool = available[name]
      if (!tool) return `Error: unknown tool “${name}”. Available: ${Object.keys(available).join(', ')}`
      if (++calls > limit) return `Tool limit (${limit}) reached. Answer now with what you already know.`
      const p = withDefaults(tool, raw)
      ctx.report(tool.label(p))
      try {
        const result = await tool.run(ctx, p)
        if (failed(result)) failedCalls.set(signature(name, p), result)
        else {
          done.add(signature(name, p))
          if (name === 'write_file' || name === 'edit_file' || name === 'replace_lines') {
            if (result.includes('SYNTAX ERROR')) syntaxErrors.add(String(p.path))
            else syntaxErrors.delete(String(p.path))
            changed.add(String(p.path))
            version++
            log.push(result.replace(/ Syntax check: OK\.$/, ''))
          }
        }
        const what = name === 'run_command' ? `\`${p.command}\`` : `${name} ${p.path ?? ''}`.trim()
        if (rejectedByUser(result)) {
          log.push(t('{what}: declined by you', { what }))
          userRejected = true
        } else if (name === 'run_command') {
          log.push(`${what}: ${result.split('\n')[0]}`)
          lastCommandFailed = !result.startsWith('Succeeded')
          commandsRun++
        }
        else if (failed(result)) log.push(t('{what}: failed – {reason}', { what, reason: result.split('\n')[0].replace(/^Error: /, '') }))
        return result
      } catch (err) {
        const result = `Error: ${err instanceof Error ? err.message : String(err)}`
        failedCalls.set(signature(name, p), result)
        log.push(t('{what}: failed – {reason}', { what: `${name} ${p.path ?? ''}`.trim(), reason: result.slice(7).split('\n')[0] }))
        return result
      }
    },
    /** Summary of what actually happened – in case the model doesn't provide one */
    summary(): string {
      if (log.length === 0) return t('Nothing was changed and no command was run.')
      return `${t('This is what was actually done:')}\n${log.map((l) => `- ${l}`).join('\n')}`
    }
  }
}

// ---------- Detecting tool calls in text ----------
//
// Small models often write tool calls as plain text instead of in the format of their
// chat template – and rarely as clean JSON. Typical:
//   ```json
//   { "name": "write_file", "arguments": { "path": "a.js", "content": `
//   function a() { … }
//   ` } }
//   ```
// Hence a lenient parser: allows backtick and single quotes, raw
// line breaks in strings, unquoted keys and trailing commas.

class Lenient {
  i = 0
  constructor(private s: string) {}

  static parseAt(s: string, start: number): { value: unknown; end: number } | null {
    const p = new Lenient(s)
    p.i = start
    try {
      const value = p.value()
      return { value, end: p.i }
    } catch {
      return null
    }
  }

  private ws(): void {
    for (;;) {
      while (this.i < this.s.length && /\s/.test(this.s[this.i])) this.i++
      // Skip comments
      if (this.s.startsWith('//', this.i)) {
        while (this.i < this.s.length && this.s[this.i] !== '\n') this.i++
      } else return
    }
  }

  private value(): unknown {
    this.ws()
    const c = this.s[this.i]
    if (c === '{') return this.object()
    if (c === '[') return this.array()
    if (c === '"' || c === "'" || c === '`') return this.string(c)
    const lit = /^(true|false|null|-?\d+(\.\d+)?([eE][+-]?\d+)?)/.exec(this.s.slice(this.i, this.i + 40))
    if (!lit) throw new Error('value expected')
    this.i += lit[0].length
    return lit[1] === 'true' ? true : lit[1] === 'false' ? false : lit[1] === 'null' ? null : Number(lit[0])
  }

  private object(): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    this.i++ // {
    for (;;) {
      this.ws()
      if (this.s[this.i] === '}') {
        this.i++
        return out
      }
      let key: string
      const c = this.s[this.i]
      if (c === '"' || c === "'" || c === '`') key = this.string(c)
      else {
        const id = /^[A-Za-z_$][\w$]*/.exec(this.s.slice(this.i, this.i + 100))
        if (!id) throw new Error('key expected')
        key = id[0]
        this.i += key.length
      }
      this.ws()
      if (this.s[this.i++] !== ':') throw new Error(': expected')
      out[key] = this.value()
      this.ws()
      if (this.s[this.i] === ',') this.i++
      else if (this.s[this.i] !== '}') throw new Error(', or } expected')
    }
  }

  private array(): unknown[] {
    const out: unknown[] = []
    this.i++ // [
    for (;;) {
      this.ws()
      if (this.s[this.i] === ']') {
        this.i++
        return out
      }
      out.push(this.value())
      this.ws()
      if (this.s[this.i] === ',') this.i++
      else if (this.s[this.i] !== ']') throw new Error(', or ] expected')
    }
  }

  private string(q: string): string {
    this.i++ // opening character
    let out = ''
    while (this.i < this.s.length) {
      const c = this.s[this.i++]
      if (c === q) {
        // With backticks the code usually starts on the next line – drop the leading line break
        return q === '`' && out.startsWith('\n') ? out.slice(1) : out
      }
      if (c !== '\\') {
        out += c
        continue
      }
      const n = this.s[this.i++]
      if (q === '`') {
        // Backticks contain code: leave backslashes as they are
        out += n === '`' ? '`' : '\\' + n
        continue
      }
      const map: Record<string, string> = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', '0': '\0' }
      if (n === 'u') {
        out += String.fromCharCode(parseInt(this.s.slice(this.i, this.i + 4), 16))
        this.i += 4
      } else out += map[n] ?? n
    }
    throw new Error('unterminated string')
  }
}

/**
 * Does the model keep writing after its tool calls – usually made-up “results”?
 * Then generation should stop and the calls should really be executed first.
 */
export function continuesAfterCalls(text: string, available: Record<string, Tool>): boolean {
  const calls = parseToolCalls(text, available)
  if (!calls.length) return false
  const rest = text.slice(calls[calls.length - 1].end)
  // Allowed: code fence, </tool_call>, whitespace – and the start of another call
  const cleaned = rest.replace(/```\w*|<\/?tool_call>|\s/g, '')
  if (!cleaned || cleaned.startsWith('{')) return false
  return cleaned.length > 3
}

/** A tool description (schema) instead of a call? */
function isDefinition(obj: Record<string, any>): boolean {
  if (obj.type === 'function' && typeof obj.function === 'object') return true
  const params = obj.parameters ?? obj.arguments
  return typeof obj.description === 'string' && !!params && typeof params === 'object' && ('properties' in params || params.type === 'object')
}

/** All tool calls in an answer, in the order they appear. */
export function parseToolCalls(text: string, available: Record<string, Tool>): { name: string; args: Params; end: number }[] {
  const calls: { name: string; args: Params; end: number }[] = []
  // Some models copy the tool descriptions from their instructions into the answer – those are not calls
  text = text.replace(/<tools>[\s\S]*?<\/tools>/g, (m) => ' '.repeat(m.length))
  let pos = 0
  while ((pos = text.indexOf('{', pos)) >= 0) {
    const parsed = Lenient.parseAt(text, pos)
    const obj = parsed?.value as Record<string, any> | undefined
    if (parsed && obj && typeof obj === 'object' && isDefinition(obj)) {
      pos = parsed.end
      continue
    }
    const name = obj && typeof obj === 'object' ? (obj.name ?? obj.function ?? obj.tool) : undefined
    if (parsed && typeof name === 'string' && available[name]) {
      let args = obj!.arguments ?? obj!.parameters ?? obj!.args ?? {}
      if (typeof args === 'string') args = (Lenient.parseAt(args, args.indexOf('{'))?.value as Params) ?? {}
      calls.push({ name, args, end: parsed.end })
      pos = parsed.end
    } else pos++
  }
  return calls
}
