// Werkzeuge des Modells und die Freigabe-Regeln für alles, was etwas verändert.
import { randomUUID } from 'node:crypto'
import type { AgentOpenFile, ApprovalAnswer, ApprovalRequest, ChatMode } from '../shared/types'
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
      await tools.applyWrite(plan)
      ctx.fileChanged(plan.abs)
      return `${plan.rel} wurde geändert.`
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
      await tools.applyWrite(plan)
      ctx.fileChanged(plan.abs)
      return plan.isNew ? `${plan.rel} wurde angelegt.` : `${plan.rel} wurde überschrieben.`
    }
  },
  run_command: {
    mode: 'agent',
    description:
      'Führt einen Terminal-Befehl im Projektordner aus (z. B. Tests, Build, Linter, git status, npm install) und liefert die Ausgabe. ' +
      'Keine interaktiven Befehle und keine dauerhaft laufenden Prozesse wie Dev-Server.',
    params: { command: { type: 'string', description: 'Shell-Befehl, z. B. "npm test"' } },
    defaults: { command: '' },
    label: (p) => `▶ ${p.command}`,
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
export function makeRunner(ctx: AgentContext, available: Record<string, Tool>) {
  const limit = getSettings().maxToolCalls
  let calls = 0
  return {
    get exhausted() {
      return calls >= limit
    },
    async call(name: string, raw: Params): Promise<string> {
      const tool = available[name]
      if (!tool) return `Fehler: Unbekanntes Werkzeug „${name}“. Verfügbar: ${Object.keys(available).join(', ')}`
      if (++calls > limit) return `Werkzeug-Limit (${limit}) erreicht. Antworte jetzt mit dem, was du bereits weißt.`
      // Fehlende oder leere Parameter mit Standardwerten auffüllen
      const p: Params = { ...tool.defaults }
      for (const [k, v] of Object.entries(raw ?? {})) if (v !== null && v !== undefined && v !== '') p[k] = v
      ctx.report(tool.label(p))
      try {
        return await tool.run(ctx, p)
      } catch (err) {
        return `Fehler: ${err instanceof Error ? err.message : String(err)}`
      }
    }
  }
}

/**
 * Kleine Modelle schreiben Werkzeug-Aufrufe oft als normalen JSON-Text statt im Format ihres
 * Chat-Templates, z. B. ```json {"name": "read_file", "arguments": {...}} ```. Das wird hier erkannt.
 */
export function parseToolCall(text: string, available: Record<string, Tool>): { name: string; args: Params } | null {
  const start = text.indexOf('{')
  if (start < 0) return null
  // Erstes vollständiges JSON-Objekt per Klammerzählung herauslösen
  let depth = 0
  let inString = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (inString) {
      if (c === '\\') i++
      else if (c === '"') inString = false
    } else if (c === '"') inString = true
    else if (c === '{') depth++
    else if (c === '}' && --depth === 0) {
      try {
        const obj = JSON.parse(text.slice(start, i + 1))
        const name = obj.name ?? obj.function ?? obj.tool
        if (typeof name !== 'string' || !available[name]) return null
        let args = obj.arguments ?? obj.parameters ?? obj.args ?? {}
        if (typeof args === 'string') args = JSON.parse(args)
        return { name, args }
      } catch {
        return null
      }
    }
  }
  return null
}
