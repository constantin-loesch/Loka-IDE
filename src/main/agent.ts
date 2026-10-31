// Werkzeuge des Modells und die Freigabe-Regeln für alles, was etwas verändert.
import { randomUUID } from 'node:crypto'
import type { AgentOpenFile, ApprovalAnswer, ApprovalRequest, ChatMode } from '../shared/types'
import { rm, writeFile } from 'node:fs/promises'
import * as tools from './agentTools'
import { getSettings } from './settings'

/** Alles, was ein Werkzeug von außen braucht. */
export interface AgentContext {
  root: string
  requestId: string
  signal: AbortSignal
  /** Fortschritt in der Oberfläche anzeigen */
  report: (label: string) => void
  /** Ausgabe zum letzten Schritt anzeigen (z. B. Terminal-Ausgabe) */
  reportResult: (text: string) => void
  openFile: (f: AgentOpenFile) => void
  /** Nach dem Schreiben – damit der Editor die Datei neu lädt */
  fileChanged: (path: string) => void
  /** Fragt den Nutzer und wartet auf seine Antwort */
  askUser: (req: ApprovalRequest) => void
}

type Params = Record<string, any>

interface Tool {
  /** Ab welchem Modus das Werkzeug verfügbar ist */
  mode: 'read' | 'agent'
  description: string
  params: Record<string, { type: 'string' | 'integer'; description?: string }>
  /** Werte für fehlende Parameter – kleine Modelle lassen gern welche weg */
  defaults: Params
  label: (p: Params) => string
  run: (ctx: AgentContext, p: Params) => Promise<string>
}

// ---------- Freigaben ----------

const pending = new Map<string, { resolve: (a: ApprovalAnswer) => void; signal: AbortSignal }>()
/** Für diesen Chat dauerhaft erlaubte Arten von Aktionen */
const allowedForChat = new Set<'files' | 'commands'>()

export function answerApproval(a: ApprovalAnswer): void {
  pending.get(a.id)?.resolve(a)
  pending.delete(a.id)
}

/** Neuer Chat: dauerhafte Erlaubnisse verfallen. */
export function resetApprovals(): void {
  allowedForChat.clear()
  for (const [id, p] of pending) p.resolve({ id, approved: false, reason: 'Chat wurde zurückgesetzt.' })
  pending.clear()
}

/**
 * Entscheidet, ob eine Aktion ohne Nachfrage laufen darf, und fragt sonst den Nutzer.
 * Gefährliche Befehle werden immer nachgefragt.
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
    ctx.signal.addEventListener('abort', () => answerApproval({ id, approved: false, reason: 'Abgebrochen.' }), { once: true })
    ctx.askUser({ ...req, id, requestId: ctx.requestId })
  })
  if (answer.approved && answer.always && !req.danger) allowedForChat.add(kind)
  return answer
}

// ---------- Sicherungen für „Rückgängig“ ----------

/** Pro Chat-Anfrage der ursprüngliche Inhalt jeder geänderten Datei (null = Datei war neu). */
const backups = new Map<string, Map<string, string | null>>()

function rememberOriginal(requestId: string, abs: string, before: string, isNew: boolean): void {
  let files = backups.get(requestId)
  if (!files) {
    files = new Map()
    backups.set(requestId, files)
    // Nur die letzten 30 Antworten aufheben
    if (backups.size > 30) backups.delete(backups.keys().next().value!)
  }
  // Nur den Stand VOR der ersten Änderung merken
  if (!files.has(abs)) files.set(abs, isNew ? null : before)
}

/** Stellt alle Dateien wieder her, die eine Antwort geändert hat. Liefert die Pfade. */
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

/** Namen von Funktionen, Klassen, Konstanten und Exporten – um versehentlich Gelöschtes zu erkennen. */
function definedNames(code: string): Set<string> {
  const names = new Set<string>()
  const re = /\b(?:function\s*\*?|def|class|const|let|var|fn|func)\s+([A-Za-z_$][\w$]*)|\b(module\.exports|export\s+default)\b/g
  for (const m of code.matchAll(re)) names.add(m[1] ?? m[2].replace(/\s+/, ' '))
  return names
}

/** Schreibt eine freigegebene Änderung, sichert den alten Stand und prüft die Syntax. */
async function commitWrite(ctx: AgentContext, plan: tools.PlannedWrite, done: string): Promise<string> {
  rememberOriginal(ctx.requestId, plan.abs, plan.before, plan.isNew)
  await tools.applyWrite(plan)
  ctx.fileChanged(plan.abs)
  // Kleine Modelle schreiben Dateien gern neu und vergessen dabei Teile
  if (!plan.isNew) {
    const after = definedNames(plan.after)
    const lost = [...definedNames(plan.before)].filter((n) => !after.has(n))
    if (lost.length) done += `\n⚠ Achtung: Diese Definitionen gab es vorher, jetzt fehlen sie: ${lost.join(', ')}. Falls das nicht gewollt war, stelle sie wieder her.`
  }
  const syntax = await tools.syntaxCheck(plan.abs)
  if (syntax) {
    ctx.reportResult(`Syntaxfehler in ${plan.rel}:\n${syntax}`)
    return `${done}\n⚠ SYNTAXFEHLER in ${plan.rel} – bitte sofort beheben:\n${syntax}`
  }
  return `${done} Syntaxprüfung: OK.`
}

const rejected = (a: ApprovalAnswer): string =>
  `Der Nutzer hat das abgelehnt${a.reason ? `: ${a.reason}` : '.'} Mach nichts davon eigenmächtig weiter – frag nach oder schlag eine Alternative vor.`

// ---------- Werkzeuge ----------

export const TOOLS: Record<string, Tool> = {
  list_files: {
    mode: 'read',
    description: 'Listet Dateien und Unterordner eines Ordners im Projekt auf. "." ist der Projektordner.',
    params: {
      path: { type: 'string', description: 'Ordner relativ zum Projekt, z. B. "." oder "src"' },
      depth: { type: 'integer', description: 'Wie viele Ebenen tief (1–4)' }
    },
    defaults: { path: '.', depth: 2 },
    label: (p) => `📂 Ordner ${p.path}`,
    run: (ctx, p) => tools.listFiles(ctx.root, String(p.path), Number(p.depth))
  },
  find_files: {
    mode: 'read',
    description: 'Sucht Dateien nach Namen. Unterstützt * und ? als Platzhalter, sonst Teilstring-Suche im Pfad.',
    params: { pattern: { type: 'string', description: 'z. B. "*.ts" oder "config"' } },
    defaults: { pattern: '' },
    label: (p) => `🔎 Dateien „${p.pattern}“`,
    run: (ctx, p) => tools.findFiles(ctx.root, String(p.pattern))
  },
  search_code: {
    mode: 'read',
    description: 'Durchsucht den Inhalt aller Dateien (Groß-/Kleinschreibung egal, Regex erlaubt). Liefert Datei:Zeile: Text.',
    params: {
      query: { type: 'string', description: 'Suchbegriff oder regulärer Ausdruck' },
      path: { type: 'string', description: 'Ordner oder Datei, in dem gesucht wird; "." für alles' }
    },
    defaults: { query: '', path: '.' },
    label: (p) => `🔍 Suche „${p.query}“${p.path !== '.' ? ` in ${p.path}` : ''}`,
    run: (ctx, p) => tools.searchCode(ctx.root, String(p.query), String(p.path))
  },
  read_file: {
    mode: 'read',
    description: 'Liest eine Textdatei mit Zeilennummern. endLine 0 bedeutet bis zum Ende.',
    params: {
      path: { type: 'string', description: 'Datei relativ zum Projekt' },
      startLine: { type: 'integer' },
      endLine: { type: 'integer' }
    },
    defaults: { path: '', startLine: 1, endLine: 0 },
    label: (p) => `📄 Liest ${p.path}${p.startLine > 1 || p.endLine > 0 ? ` (Zeile ${p.startLine}–${p.endLine || 'Ende'})` : ''}`,
    run: (ctx, p) => tools.readFileLines(ctx.root, String(p.path), Number(p.startLine), Number(p.endLine))
  },
  open_file: {
    mode: 'read',
    description: 'Öffnet eine Datei im Editor des Nutzers und springt zu einer Zeile, um ihm eine Stelle zu zeigen.',
    params: {
      path: { type: 'string', description: 'Datei relativ zum Projekt' },
      line: { type: 'integer', description: 'Zeilennummer (1 = Anfang)' }
    },
    defaults: { path: '', line: 1 },
    label: (p) => `↗ Öffnet ${p.path}${p.line > 1 ? `:${p.line}` : ''}`,
    run: async (ctx, p) => {
      const path = await tools.resolveForOpen(ctx.root, String(p.path))
      ctx.openFile({ path, line: Math.max(1, Number(p.line) || 1) })
      return `${p.path} wurde im Editor geöffnet.`
    }
  },

  edit_file: {
    mode: 'agent',
    description:
      'Ändert eine bestehende Datei: Ersetzt old_text (muss exakt und genau einmal vorkommen, ohne Zeilennummern) durch new_text. Lies die Datei vorher mit read_file.',
    params: {
      path: { type: 'string', description: 'Datei relativ zum Projekt' },
      old_text: { type: 'string', description: 'Exakter bisheriger Text inkl. Einrückung' },
      new_text: { type: 'string', description: 'Neuer Text' }
    },
    defaults: { path: '', old_text: '', new_text: '' },
    label: (p) => `✏️ Ändert ${p.path}`,
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
      return commitWrite(ctx, plan, `${plan.rel} wurde geändert.`)
    }
  },
  replace_lines: {
    mode: 'agent',
    description:
      'Ersetzt in einer bestehenden Datei die Zeilen start_line bis end_line (laut read_file, inklusive) durch new_text. ' +
      'Oft einfacher als edit_file. Leerer new_text löscht die Zeilen. Zum Einfügen ohne Löschen: end_line = start_line - 1.',
    params: {
      path: { type: 'string', description: 'Datei relativ zum Projekt' },
      start_line: { type: 'integer' },
      end_line: { type: 'integer' },
      new_text: { type: 'string', description: 'Neuer Text für diese Zeilen' }
    },
    defaults: { path: '', start_line: 0, end_line: 0, new_text: '' },
    label: (p) => `✏️ Ändert ${p.path} (Zeile ${p.start_line}–${p.end_line})`,
    run: async (ctx, p) => {
      const plan = await tools.planReplaceLines(ctx.root, String(p.path), Number(p.start_line), Number(p.end_line), String(p.new_text))
      const a = await approve(ctx, { kind: 'edit', path: plan.abs, relPath: plan.rel, before: plan.snippetBefore, after: plan.snippetAfter })
      if (!a.approved) return rejected(a)
      return commitWrite(ctx, plan, `${plan.rel}: Zeilen ${p.start_line}–${p.end_line} ersetzt.`)
    }
  },
  write_file: {
    mode: 'agent',
    description: 'Legt eine neue Datei an oder überschreibt eine Datei komplett mit content. Für kleine Änderungen lieber edit_file benutzen.',
    params: {
      path: { type: 'string', description: 'Datei relativ zum Projekt' },
      content: { type: 'string', description: 'Vollständiger neuer Inhalt' }
    },
    defaults: { path: '', content: '' },
    label: (p) => `📝 Schreibt ${p.path}`,
    run: async (ctx, p) => {
      const plan = await tools.planWrite(ctx.root, String(p.path), String(p.content))
      if (!plan.isNew && plan.before === plan.after) return `${plan.rel} ist bereits auf diesem Stand.`
      const a = await approve(ctx, {
        kind: 'write',
        path: plan.abs,
        relPath: plan.rel,
        before: plan.before,
        after: plan.after,
        isNew: plan.isNew
      })
      if (!a.approved) return rejected(a)
      return commitWrite(ctx, plan, plan.isNew ? `${plan.rel} wurde angelegt.` : `${plan.rel} wurde überschrieben.`)
    }
  },
  run_command: {
    mode: 'agent',
    description:
      'Führt einen Terminal-Befehl im Projektordner aus (z. B. Tests, Build, Linter, git status, npm install) und liefert die Ausgabe. ' +
      'Keine interaktiven Befehle und keine dauerhaft laufenden Prozesse wie Dev-Server.',
    params: { command: { type: 'string', description: 'Shell-Befehl, z. B. "npm test"' } },
    defaults: { command: '' },
    label: (p) => `$ ${p.command}`,
    run: async (ctx, p) => {
      const command = String(p.command).trim()
      if (!command) return 'Fehler: Kein Befehl angegeben.'
      const a = await approve(ctx, { kind: 'command', command, danger: tools.dangerOf(command) })
      if (!a.approved) return rejected(a)
      const { output, exitCode, timedOut } = await tools.runCommand(ctx.root, command, getSettings().commandTimeout, ctx.signal)
      const status = timedOut
        ? `Abgebrochen nach ${getSettings().commandTimeout} s (Zeitlimit).`
        : exitCode === 0
          ? 'Erfolgreich (Exit-Code 0).'
          : `Fehlgeschlagen (Exit-Code ${exitCode}).`
      ctx.reportResult(`${output || '(keine Ausgabe)'}\n\n${status}`)
      return `${status}\nAusgabe:\n${output || '(keine Ausgabe)'}`
    }
  }
}

export function toolsFor(mode: ChatMode): Record<string, Tool> {
  if (mode === 'chat') return {}
  return Object.fromEntries(Object.entries(TOOLS).filter(([, t]) => mode === 'agent' || t.mode === 'read'))
}

/** Führt Werkzeuge aus, zählt die Aufrufe und meldet sie der Oberfläche. */
const rejectedByUser = (result: string): boolean => result.startsWith('Der Nutzer hat das abgelehnt')

/** Hat ein Werkzeug-Aufruf nicht geklappt (Fehler oder vom Nutzer abgelehnt)? */
export const failed = (result: string): boolean => result.startsWith('Fehler') || rejectedByUser(result)

export function makeRunner(ctx: AgentContext, available: Record<string, Tool>) {
  const limit = getSettings().maxToolCalls
  let calls = 0
  /** Zählt Dateiänderungen – danach dürfen Lesen und Befehle sinnvoll wiederholt werden */
  let version = 0
  /** Tatsächlich geschriebene Dateien (relativ zum Projekt) */
  const changed = new Set<string>()
  /** Erfolgreiche Aufrufe, um sinnlose Wiederholungen zu erkennen */
  const done = new Set<string>()
  /** Fehlgeschlagene Aufrufe mit ihrer Fehlermeldung – identisch wiederholen bringt nichts */
  const failedCalls = new Map<string, string>()
  /** Was wirklich passiert ist – für eine ehrliche Zusammenfassung */
  const log: string[] = []
  let userRejected = false
  /** Ist der zuletzt ausgeführte Befehl fehlgeschlagen? */
  let lastCommandFailed = false
  let commandsRun = 0
  /** Dateien, in denen die letzte Schreibaktion einen Syntaxfehler hinterlassen hat */
  const syntaxErrors = new Set<string>()

  const withDefaults = (tool: Tool, raw: Params): Params => {
    // Fehlende oder leere Parameter mit Standardwerten auffüllen
    const p: Params = { ...tool.defaults }
    for (const [k, v] of Object.entries(raw ?? {})) if (v !== null && v !== undefined && v !== '') p[k] = v
    // Windows-Pfade (".\\a\\b.py") und "./" am Anfang vereinheitlichen
    if (typeof p.path === 'string') p.path = p.path.replace(/\\/g, '/').replace(/^(\.\/)+(?=.)/, '') || '.'
    return p
  }
  const signature = (name: string, p: Params): string =>
    // Schreiben mit gleichem Inhalt ist immer sinnlos, Lesen/Befehle erst nach einer Änderung wieder
    name === 'write_file' || name === 'edit_file' || name === 'replace_lines' ? `${name}:${JSON.stringify(p)}` : `${name}:${version}:${JSON.stringify(p)}`

  return {
    get exhausted() {
      return calls >= limit
    },
    changed,
    log,
    /** Hat der Nutzer eine Aktion abgelehnt? Dann soll der Agent nicht eigenmächtig weitermachen. */
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
    /** Wurde genau dieser Aufruf schon erfolgreich ausgeführt (ohne dass sich seitdem etwas geändert hat)? */
    seen(name: string, raw: Params): boolean {
      const tool = available[name]
      return !!tool && done.has(signature(name, withDefaults(tool, raw)))
    },
    /** Fehlermeldung, falls genau dieser Aufruf schon einmal gescheitert ist */
    failedBefore(name: string, raw: Params): string | undefined {
      const tool = available[name]
      return tool ? failedCalls.get(signature(name, withDefaults(tool, raw))) : undefined
    },
    async call(name: string, raw: Params): Promise<string> {
      const tool = available[name]
      if (!tool) return `Fehler: Unbekanntes Werkzeug „${name}“. Verfügbar: ${Object.keys(available).join(', ')}`
      if (++calls > limit) return `Werkzeug-Limit (${limit}) erreicht. Antworte jetzt mit dem, was du bereits weißt.`
      const p = withDefaults(tool, raw)
      ctx.report(tool.label(p))
      try {
        const result = await tool.run(ctx, p)
        if (failed(result)) failedCalls.set(signature(name, p), result)
        else {
          done.add(signature(name, p))
          if (name === 'write_file' || name === 'edit_file' || name === 'replace_lines') {
            if (result.includes('SYNTAXFEHLER')) syntaxErrors.add(String(p.path))
            else syntaxErrors.delete(String(p.path))
            changed.add(String(p.path))
            version++
            log.push(result)
          }
        }
        const what = name === 'run_command' ? `\`${p.command}\`` : `${name} ${p.path ?? ''}`.trim()
        if (rejectedByUser(result)) {
          log.push(`${what}: von dir abgelehnt`)
          userRejected = true
        } else if (name === 'run_command') {
          log.push(`${what}: ${result.split('\n')[0]}`)
          lastCommandFailed = !result.startsWith('Erfolgreich')
          commandsRun++
        }
        else if (failed(result)) log.push(`${what}: ${result.split('\n')[0].replace(/^Fehler: /, 'fehlgeschlagen – ')}`)
        return result
      } catch (err) {
        const result = `Fehler: ${err instanceof Error ? err.message : String(err)}`
        failedCalls.set(signature(name, p), result)
        log.push(`${name} ${p.path ?? ''}: fehlgeschlagen – ${result.slice(8).split('\n')[0]}`)
        return result
      }
    },
    /** Zusammenfassung aus dem, was tatsächlich passiert ist – falls das Modell keine liefert */
    summary(): string {
      if (log.length === 0) return 'Es wurde nichts geändert und kein Befehl ausgeführt.'
      return `Das wurde tatsächlich gemacht:\n${log.map((l) => `- ${l}`).join('\n')}`
    }
  }
}

// ---------- Werkzeug-Aufrufe im Text erkennen ----------
//
// Kleine Modelle schreiben Werkzeug-Aufrufe oft als normalen Text statt im Format ihres
// Chat-Templates – und das selten als sauberes JSON. Typisch:
//   ```json
//   { "name": "write_file", "arguments": { "path": "a.js", "content": `
//   function a() { … }
//   ` } }
//   ```
// Deshalb ein toleranter Parser: erlaubt Backtick- und einfache Anführungszeichen, rohe
// Zeilenumbrüche in Strings, Schlüssel ohne Anführungszeichen und Kommas am Ende.

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
      // Kommentare überspringen
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
    if (!lit) throw new Error('Wert erwartet')
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
        if (!id) throw new Error('Schlüssel erwartet')
        key = id[0]
        this.i += key.length
      }
      this.ws()
      if (this.s[this.i++] !== ':') throw new Error(': erwartet')
      out[key] = this.value()
      this.ws()
      if (this.s[this.i] === ',') this.i++
      else if (this.s[this.i] !== '}') throw new Error(', oder } erwartet')
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
      else if (this.s[this.i] !== ']') throw new Error(', oder ] erwartet')
    }
  }

  private string(q: string): string {
    this.i++ // öffnendes Zeichen
    let out = ''
    while (this.i < this.s.length) {
      const c = this.s[this.i++]
      if (c === q) {
        // Bei Backticks steht der Code meist ab der nächsten Zeile – führenden Umbruch weglassen
        return q === '`' && out.startsWith('\n') ? out.slice(1) : out
      }
      if (c !== '\\') {
        out += c
        continue
      }
      const n = this.s[this.i++]
      if (q === '`') {
        // In Backticks steht Code: Backslashes so lassen, wie sie sind
        out += n === '`' ? '`' : '\\' + n
        continue
      }
      const map: Record<string, string> = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', '0': '\0' }
      if (n === 'u') {
        out += String.fromCharCode(parseInt(this.s.slice(this.i, this.i + 4), 16))
        this.i += 4
      } else out += map[n] ?? n
    }
    throw new Error('String nicht beendet')
  }
}

/**
 * Schreibt das Modell nach seinen Werkzeug-Aufrufen schon weiter – meist erfundene „Ergebnisse“?
 * Dann sollte die Generierung gestoppt und erst einmal wirklich ausgeführt werden.
 */
export function continuesAfterCalls(text: string, available: Record<string, Tool>): boolean {
  const calls = parseToolCalls(text, available)
  if (!calls.length) return false
  const rest = text.slice(calls[calls.length - 1].end)
  // Erlaubt: Code-Zaun, </tool_call>, Leerraum – und der Anfang eines weiteren Aufrufs
  const cleaned = rest.replace(/```\w*|<\/?tool_call>|\s/g, '')
  if (!cleaned || cleaned.startsWith('{')) return false
  return cleaned.length > 3
}

/** Eine Werkzeug-Beschreibung (Schema) statt eines Aufrufs? */
function isDefinition(obj: Record<string, any>): boolean {
  if (obj.type === 'function' && typeof obj.function === 'object') return true
  const params = obj.parameters ?? obj.arguments
  return typeof obj.description === 'string' && !!params && typeof params === 'object' && ('properties' in params || params.type === 'object')
}

/** Alle Werkzeug-Aufrufe in einer Antwort, in der Reihenfolge, in der sie dort stehen. */
export function parseToolCalls(text: string, available: Record<string, Tool>): { name: string; args: Params; end: number }[] {
  const calls: { name: string; args: Params; end: number }[] = []
  // Manche Modelle kopieren die Werkzeug-Beschreibungen aus ihrer Anleitung in die Antwort – die sind keine Aufrufe
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
