import { existsSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { ChatSessionModelFunctions, Llama, LlamaChatSession, LlamaContext, LlamaModel } from 'node-llama-cpp'
import type { AgentOpenFile, ApprovalRequest, ChatChunk, ChatRequest, EngineStatus, GpuBackend, HardwareInfo } from '../shared/types'
import { describeHardware } from './hardware'
import * as agent from './agent'
import * as tools from './agentTools'
import { getSettings } from './settings'

/**
 * Die Inferenz-Engine. Läuft im Main-Prozess und nutzt llama.cpp über node-llama-cpp.
 * Auf Apple Silicon wird automatisch die GPU (Metal) verwendet.
 */

/** Wird an den System-Prompt angehängt, damit das Modell die Werkzeuge sinnvoll nutzt. */
const AGENT_HINT = `

Wenn dir Werkzeuge zur Verfügung stehen, arbeitest du selbstständig im Projektordner des Nutzers.
Erkenne selbst, was gewollt ist:
- Allgemeine Frage oder Smalltalk → einfach antworten, keine Werkzeuge nötig.
- Frage zum Projekt → nachlesen (list_files, search_code, read_file) und dann antworten, nichts ändern.
- Auftrag etwas zu erstellen, zu ändern oder zu beheben → als Coding-Agent handeln (siehe unten).
- Verschaffe dir mit list_files, find_files oder search_code einen Überblick und lies die relevanten Stellen
  mit read_file, bevor du antwortest oder etwas änderst. Rate keine Dateiinhalte – schau nach.
- Pfade sind immer relativ zum Projektordner. Mit open_file zeigst du dem Nutzer eine Stelle im Editor.
Als Coding-Agent (wenn edit_file, write_file und run_command verfügbar sind):
- Ändere nur, was für die Aufgabe nötig ist. Für Änderungen replace_lines (mit Zeilennummern aus read_file) oder edit_file, für neue Dateien write_file.
- Nach jedem Schreiben wird die Syntax geprüft. Meldet das Ergebnis einen SYNTAXFEHLER, behebe ihn sofort.
- Prüfe deine Änderungen, z. B. mit Tests, Build oder Linter über run_command, und behebe Fehler.
- Jede Änderung und jeder Befehl wird dem Nutzer zur Freigabe gezeigt. Lehnt er ab, respektiere das.
- Führe nichts Destruktives aus (löschen, git push, Abhängigkeiten global installieren), außer der Nutzer bittet ausdrücklich darum.
- Fasse am Ende kurz zusammen, was du geändert hast.
So rufst du ein Werkzeug auf: ein JSON-Objekt {"name": "<werkzeug>", "arguments": {...}}. Mehrere Aufrufe in einer
Antwort sind erlaubt und werden der Reihe nach ausgeführt. Die Ergebnisse bekommst du erst danach – schreib also
nie, dass etwas erledigt ist, bevor du das Ergebnis gesehen hast. Code, der in eine Datei gehört, kommt in
write_file/edit_file und nicht nur als Codeblock in deine Antwort. Lege Dateien genau dort an, wo der Nutzer es sagt.`

/** Token-Obergrenze pro Modell-Antwort im Agent-Modus, falls keine eigene Grenze eingestellt ist */
const AGENT_STEP_TOKENS = 3000

const systemPrompt = (): string => getSettings().systemPrompt + AGENT_HINT

// node-llama-cpp ist ein reines ES-Modul, deshalb wird es dynamisch geladen.
type NodeLlamaCpp = typeof import('node-llama-cpp')
let lib: NodeLlamaCpp | null = null
const loadLib = async (): Promise<NodeLlamaCpp> => (lib ??= await import('node-llama-cpp'))

let llama: Llama | null = null
let model: LlamaModel | null = null
let context: LlamaContext | null = null
let session: LlamaChatSession | null = null
let status: EngineStatus = { state: 'idle' }
let currentAbort: AbortController | null = null
/** Projektordner, dessen Übersicht das Modell in diesem Chat schon bekommen hat */
let overviewSentFor: string | null = null

type StatusListener = (s: EngineStatus) => void
const listeners = new Set<StatusListener>()

function setStatus(s: EngineStatus): void {
  status = s
  listeners.forEach((l) => l(s))
}

export const getStatus = (): EngineStatus => status
export const onStatus = (l: StatusListener): (() => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** Mit welchem Backend die aktuelle llama-Instanz erzeugt wurde */
let llamaBackend: GpuBackend | null = null

/**
 * llama.cpp mit dem eingestellten Backend starten. „auto“ nimmt das beste verfügbare:
 * Metal auf dem Mac, sonst CUDA (NVIDIA) oder Vulkan, notfalls CPU.
 */
async function ensureLlama(): Promise<Llama> {
  const wanted = getSettings().gpuBackend ?? 'auto'
  if (llama && llamaBackend === wanted) return llama
  if (llama) {
    await unloadModel()
    await llama.dispose()
    llama = null
  }
  const { getLlama } = await loadLib()
  try {
    llama = await getLlama(wanted === 'auto' ? undefined : { gpu: wanted === 'cpu' ? false : wanted })
  } catch (err) {
    if (wanted === 'auto') throw err
    // Gewünschtes Backend nicht verfügbar (z. B. kein CUDA installiert) – lieber automatisch als gar nicht
    console.warn(`Backend ${wanted} nicht verfügbar, nehme automatische Auswahl:`, err)
    llama = await getLlama()
  }
  llamaBackend = wanted
  return llama
}

/** Erkannte Hardware (startet dafür llama.cpp, falls nötig). */
export async function getHardware(): Promise<HardwareInfo> {
  const l = await ensureLlama()
  const gpu = l.gpu === false ? 'cpu' : (l.gpu as HardwareInfo['gpu'])
  const [names, vram] = await Promise.all([l.getGpuDeviceNames().catch(() => []), l.getVramState().catch(() => null)])
  const unified = process.platform === 'darwin' || (vram?.unifiedSize ?? 0) > 0
  return describeHardware(gpu, names, vram?.total ?? 0, unified)
}

export async function loadModel(modelPath: string): Promise<void> {
  await unloadModel()
  setStatus({ state: 'loading', modelPath, progress: 0 })
  try {
    const { LlamaChatSession } = await loadLib()
    const llama = await ensureLlama()

    const s = getSettings()
    model = await llama.loadModel({
      modelPath,
      gpuLayers: s.gpuLayers,
      onLoadProgress: (progress) => setStatus({ state: 'loading', modelPath, progress })
    })
    // Kontext begrenzen, damit der Speicher auf kleinen Rechnern reicht (0 = so groß wie möglich)
    context = await model.createContext({
      contextSize: s.contextSize > 0 ? { max: s.contextSize } : 'auto',
      flashAttention: s.flashAttention
    })
    session = new LlamaChatSession({ contextSequence: context.getSequence(), systemPrompt: systemPrompt() })
    tools.setContextBudget(context.contextSize)

    setStatus({
      state: 'ready',
      modelPath,
      modelName: basename(modelPath).replace(/\.gguf$/i, ''),
      gpu: llama.gpu === false ? 'CPU' : llama.gpu,
      contextSize: context.contextSize
    })
  } catch (err) {
    await unloadModel()
    setStatus({ state: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}

export async function unloadModel(): Promise<void> {
  currentAbort?.abort()
  session?.dispose()
  await context?.dispose()
  await model?.dispose()
  session = null
  overviewSentFor = null
  context = null
  model = null
  setStatus({ state: 'idle' })
}

/** Native Funktionsaufrufe für Modelle, die das Format ihres Chat-Templates beherrschen. */
async function nativeFunctions(
  run: ReturnType<typeof agent.makeRunner>,
  available: ReturnType<typeof agent.toolsFor>
): Promise<ChatSessionModelFunctions> {
  const { defineChatSessionFunction } = await loadLib()
  const fns: Record<string, ChatSessionModelFunctions[string]> = {}
  for (const [name, tool] of Object.entries(available)) {
    fns[name] = defineChatSessionFunction({
      description: tool.description,
      params: { type: 'object', properties: tool.params },
      handler: (p: Record<string, unknown>) => run.call(name, p)
    })
  }
  return fns
}

/** Will der Task etwas verändern (anlegen, beheben, ändern …)? */
const CHANGE_WORDS =
  /(?<!\p{L})(erstell|anleg|leg\p{L}* (?:\p{L}+ ){0,4}an\b|schreib|beheb|fix|reparier|änder|aender|füg|fueg|ergänz|implementier|refaktor|umbenenn|lösch|entfern|aktualisier)/iu
const CHANGE_REQUEST = { test: (t: string): boolean => CHANGE_WORDS.test(t) || /^\s*(please\s+)?(add|create|write|change|remove|rename|update|fix|implement|refactor)\b/i.test(t) }

/** Dateinamen, die in der Aufgabe vorkommen, z. B. "rechner.js" oder "src/app.py" */
const FILE_NAME = /(?:^|[\s"'`„(])((?:[\w.-]+\/)*[\w-]+\.(?:js|mjs|cjs|ts|tsx|jsx|py|json|md|html|css|scss|txt|sh|yml|yaml|toml|java|kt|go|rs|rb|php|c|cpp|h|swift|vue|svelte|sql))(?=$|[\s"'`“),.;:!?])/gi
/** Verlangt die Aufgabe, etwas auszuführen? */
const RUN_REQUEST = /\b(führ\w*|fuehr\w*|starte|lass\w*)\b[^.]*\b(aus|laufen)\b|\b(npm|yarn|pnpm)\s+(test|run)\b|\bpytest\b|\brun the\b/i

/** Grund, warum die Aufgabe noch nicht fertig ist – oder null, wenn das Modell aufhören darf. */
function unfinished(
  answer: string,
  task: string,
  runner: ReturnType<typeof agent.makeRunner>,
  root: string
): { label: string; prompt: string } | null {
  if (runner.syntaxErrors.size) {
    return {
      label: `Syntaxfehler in ${[...runner.syntaxErrors].join(', ')} – Modell soll ihn beheben`,
      prompt: `In ${[...runner.syntaxErrors].join(', ')} ist noch ein Syntaxfehler. Lies die Datei mit read_file und behebe ihn mit replace_lines oder write_file.`
    }
  }
  if (runner.lastCommandFailed) {
    return {
      label: 'Letzter Befehl ist fehlgeschlagen – Modell soll das Problem beheben',
      prompt: 'Der letzte Befehl ist fehlgeschlagen, die Aufgabe ist also noch nicht erledigt. Behebe die Ursache (z. B. mit edit_file oder write_file) und führe den Befehl danach erneut aus.'
    }
  }
  if (runner.changed.size === 0 && CHANGE_REQUEST.test(task)) {
    const codeOnly = /```[\w-]*\n(?:.*\n){2,}?```/.test(answer)
    return {
      label: 'Noch keine Datei geändert – Modell soll die Änderung wirklich ausführen',
      prompt:
        (codeOnly ? 'Du hast Code nur als Text ausgegeben. ' : 'Du hast das Problem beschrieben, ') +
        'aber es wurde noch KEINE Datei angelegt oder geändert. Führe die Änderung jetzt mit write_file (neue Datei) oder edit_file (bestehende Datei) aus und prüfe sie danach.'
    }
  }
  // In der Aufgabe genannte Dateien, die (nirgends im Projekt) existieren – nur wenn etwas angelegt werden soll
  if (/(?<!\p{L})(erstell|anleg|schreib|neue)|^\s*(create|write)\b/iu.test(task)) {
    const named = [...new Set([...task.matchAll(FILE_NAME)].map((m) => m[1]))]
    const missing = named.filter((f) => ![...runner.changed].some((c) => c === f || c.endsWith('/' + f)) && !existsSync(join(root, f)))
    if (missing.length) {
      return {
        label: `${missing.join(', ')} fehlt noch – Modell soll weitermachen`,
        prompt: `Die Aufgabe ist noch nicht vollständig: ${missing.join(', ')} wurde noch nicht angelegt. Leg die fehlende(n) Datei(en) jetzt mit write_file an.`
      }
    }
  }
  if (RUN_REQUEST.test(task) && runner.commandsRun === 0) {
    return {
      label: 'Verlangter Befehl wurde noch nicht ausgeführt',
      prompt: 'Die Aufgabe verlangt, etwas auszuführen (z. B. Tests). Das ist noch nicht passiert. Führe den Befehl jetzt mit run_command aus.'
    }
  }
  return null
}

export interface ChatCallbacks {
  onChunk: (c: ChatChunk) => void
  onOpenFile: (f: AgentOpenFile) => void
  onFileChanged: (path: string) => void
  onApproval: (req: ApprovalRequest) => void
}

export async function chat(req: ChatRequest, cb: ChatCallbacks): Promise<{ changed: string[] }> {
  if (!session) throw new Error('Kein Modell geladen')
  const s = getSettings()
  const abort = new AbortController()
  currentAbort = abort
  const emit = (kind: ChatChunk['kind'], text: string): void => cb.onChunk({ requestId: req.requestId, kind, text })

  const mode = req.root ? req.mode : 'chat'
  const available = agent.toolsFor(mode)
  const runner =
    mode !== 'chat' && req.root
      ? agent.makeRunner(
          {
            root: req.root,
            requestId: req.requestId,
            signal: abort.signal,
            report: (t) => emit('tool', t),
            reportResult: (t) => emit('tool-result', t),
            openFile: cb.onOpenFile,
            fileChanged: cb.onFileChanged,
            askUser: cb.onApproval
          },
          available
        )
      : null
  const functions = runner ? await nativeFunctions(runner, available) : undefined

  const announced = new Set<string>()
  // Pro Modell-Antwort eigener Abbruch: stoppt, sobald das Modell nach einem Werkzeug-Aufruf weiterfantasiert
  let turn = new AbortController()
  let turnText = ''
  const options = {
    get signal() {
      return AbortSignal.any([abort.signal, turn.signal])
    },
    stopOnAbortSignal: true,
    temperature: s.temperature,
    topP: s.topP,
    topK: s.topK,
    minP: s.minP,
    seed: s.seed ?? undefined,
    // Im Agent-Modus nie unbegrenzt: Ein Modell, das sich in einem Werkzeug-Parameter verrennt, hängt sonst ewig
    maxTokens: s.maxTokens > 0 ? s.maxTokens : runner ? AGENT_STEP_TOKENS : undefined,
    repeatPenalty: s.repeatPenalty > 1 ? { penalty: s.repeatPenalty, lastTokens: s.repeatLastTokens } : (false as const),
    budgets: s.thoughtTokens !== null ? { thoughtTokens: s.thoughtTokens } : undefined,
    functions,
    // Werkzeug-Aufrufe im nativen Format werden nicht als Text gestreamt – Fortschritt trotzdem zeigen
    onFunctionCallParamsChunk: (c: { callIndex: number; functionName: string }) => {
      const key = `${c.callIndex}`
      if (announced.has(key)) return
      announced.add(key)
      emit('tool', `⏳ bereitet ${c.functionName} vor …`)
    },
    onResponseChunk: (chunk: { type?: string; segmentType?: string; text: string }) => {
      const kind = chunk.type === 'segment' && chunk.segmentType === 'thought' ? 'thought' : 'text'
      if (!chunk.text) return
      emit(kind, chunk.text)
      if (kind === 'text' && runner && !turn.signal.aborted) {
        turnText += chunk.text
        if (agent.continuesAfterCalls(turnText, available)) turn.abort()
      }
    }
  }

  try {
    let prompt = req.prompt
    if (mode === 'read') {
      prompt = `[Nur lesen – du darfst nichts ändern und keine Befehle ausführen.]\n${prompt}`
    }
    if (runner && req.root && overviewSentFor !== req.root) {
      overviewSentFor = req.root
      // Eine Übersicht vorab spart Suchschritte und verhindert, dass kleine Modelle Pfade raten
      const overview = await tools.listFiles(req.root, '.', 2).catch(() => '')
      const testCmd = await tools.detectTestCommand(req.root)
      if (overview) {
        emit('tool', '📂 Projektübersicht')
        prompt =
          `Projektstruktur (Auszug):\n${overview.slice(0, 3000)}\n` +
          (testCmd ? `Tests dieses Projekts laufen mit: ${testCmd}\n` : '') +
          `\n${prompt}`
      }
    }
    // Schleife für Modelle, die Werkzeuge als Text aufrufen (siehe parseToolCalls)
    let nudges = 0
    let askedForSummary = false
    let repeatedFailures = 0
    for (;;) {
      announced.clear()
      turn = new AbortController()
      turnText = ''
      let answer: string
      try {
        answer = await session.prompt(prompt, { ...options, signal: options.signal })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (!/context/i.test(msg)) throw err
        // Kontext voll – verständlich melden statt abzustürzen
        emit('text', '\n\n⚠ Der Kontext des Modells ist voll. Starte einen neuen Chat (+ oben) oder erhöhe die Kontextgröße in den Modell-Einstellungen.')
        if (runner?.log.length) emit('text', `\n\n${runner.summary()}`)
        break
      }
      if (!runner || abort.signal.aborted) break
      const calls = agent.parseToolCalls(answer, available)

      if (calls.length === 0) {
        // Das Modell will aufhören. Prüfen, ob die Aufgabe wirklich erledigt ist, und sonst (begrenzt oft) weitermachen lassen.
        const reason = mode === 'agent' && !runner.exhausted && !runner.userRejected && nudges < 5 ? unfinished(answer, req.prompt, runner, req.root!) : null
        if (reason) {
          nudges++
          emit('retract', '')
          emit('tool', `↻ ${reason.label}`)
          prompt = reason.prompt + ' Antworte nur mit den nötigen Werkzeug-Aufrufen als JSON.'
          continue
        }
        break
      }

      // Der Text mit den Aufrufen (und vorweggenommenen Erfolgsmeldungen) ist keine echte Antwort
      emit('retract', '')

      // Nach einer Ablehnung nichts mehr eigenmächtig ausführen
      if (runner.userRejected) {
        emit('text', `${runner.summary()}\n\nIch habe danach nichts weiter unternommen. Sag mir, wie ich es stattdessen machen soll.`)
        break
      }

      const fresh = calls.filter((c) => !runner.seen(c.name, c.args))
      // Identische Aufrufe, die schon gescheitert sind, nicht erneut ausführen – stattdessen deutlich darauf hinweisen
      const repeatedFailure = fresh.find((c) => runner.failedBefore(c.name, c.args))
      if (repeatedFailure) {
        repeatedFailures++
        if (repeatedFailures > 2) {
          emit('text', runner.summary() + '\n\nDas Modell kam an dieser Stelle nicht weiter. Formuliere die Aufgabe genauer oder probier ein größeres Modell.')
          break
        }
        prompt =
          `Du hast ${repeatedFailure.name} genau so schon aufgerufen und es ist gescheitert:\n` +
          `${runner.failedBefore(repeatedFailure.name, repeatedFailure.args)}\n\n` +
          'Wiederhole diesen Aufruf NICHT. Mach etwas anderes: Lies die Datei mit read_file und kopiere old_text exakt, ' +
          'oder schreib die ganze Datei mit write_file neu.'
        continue
      }
      if (fresh.length === 0 || runner.exhausted) {
        // Nur noch Wiederholungen oder Limit erreicht: einmal um Zusammenfassung bitten, dann selbst beenden
        if (!askedForSummary && !runner.exhausted) {
          askedForSummary = true
          prompt =
            'Diese Aufrufe wurden alle bereits erfolgreich ausgeführt – es gibt nichts mehr zu tun. ' +
            'Antworte jetzt NUR mit einer kurzen Zusammenfassung für den Nutzer, ohne Werkzeug-Aufrufe.'
          continue
        }
        emit('text', runner.summary() + (runner.exhausted ? '\n\n(Werkzeug-Limit erreicht – bei Bedarf in den Einstellungen erhöhen.)' : ''))
        break
      }

      const report: string[] = []
      for (let k = 0; k < fresh.length; k++) {
        const { name, args } = fresh[k]
        const result = await runner.call(name, args)
        report.push(`### ${k + 1}. ${name}\n${result}`)
        if (abort.signal.aborted) break
        if (runner.userRejected) {
          if (k < fresh.length - 1) report.push(`Die übrigen ${fresh.length - k - 1} Aufrufe wurden NICHT ausgeführt.`)
          break
        }
        // Spätere Schritte bauen meist auf früheren auf – nach einem Fehler nicht blind weitermachen
        if (agent.failed(result) && k < fresh.length - 1) {
          report.push(`Die übrigen ${fresh.length - k - 1} Aufrufe wurden NICHT ausgeführt, weil dieser Schritt nicht geklappt hat.`)
          break
        }
        if (runner.exhausted) break
      }
      if (abort.signal.aborted) break
      const skipped = calls.length - fresh.length

      const changedList = [...runner.changed]
      prompt =
        `Ergebnisse deiner Werkzeug-Aufrufe:\n\n${report.join('\n\n')}\n\n` +
        (skipped ? `${skipped} Aufruf(e) waren Wiederholungen von bereits Erledigtem und wurden übersprungen.\n` : '') +
        `Bisher tatsächlich geschriebene Dateien: ${changedList.length ? changedList.join(', ') : 'keine'}.\n` +
        `Zur Erinnerung, die Aufgabe des Nutzers: „${req.prompt.slice(0, 600)}“ – prüfe, ob wirklich jeder Teil davon erledigt ist.\n` +
        'Behaupte nur, was in diesen Ergebnissen steht. Wiederhole keine erledigten Schritte. ' +
        (runner.userRejected
          ? 'Der Nutzer hat abgelehnt. Ruf KEINE Werkzeuge mehr auf. Antworte kurz: was du vorhattest und frag, was er stattdessen möchte.'
          : runner.exhausted
          ? 'Das Werkzeug-Limit ist erreicht. Fasse jetzt ehrlich zusammen, was erledigt ist und was noch offen ist.'
          : report.some((r) => agent.failed(r.split('\n').slice(1).join('\n')))
            ? 'Mindestens ein Schritt ist fehlgeschlagen. Lies die Meldung, korrigiere das Problem und mach dann weiter.'
            : 'Wenn die Aufgabe damit erledigt ist, antworte nur mit einer kurzen Zusammenfassung ohne Werkzeug-Aufrufe. Sonst ruf die nächsten Werkzeuge auf.')
    }
  } finally {
    if (currentAbort === abort) currentAbort = null
  }
  return { changed: runner ? [...runner.changed] : [] }
}

export function stopChat(): void {
  currentAbort?.abort()
}

/** Neuer Chat – übernimmt dabei einen geänderten System-Prompt. */
export function resetChat(): void {
  agent.resetApprovals()
  overviewSentFor = null
  session?.setChatHistory([{ type: 'system', text: systemPrompt() }])
}
