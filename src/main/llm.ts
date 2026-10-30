import { basename } from 'node:path'
import type { ChatSessionModelFunctions, Llama, LlamaChatSession, LlamaContext, LlamaModel } from 'node-llama-cpp'
import type { AgentOpenFile, ApprovalRequest, ChatChunk, ChatRequest, EngineStatus } from '../shared/types'
import * as agent from './agent'
import * as tools from './agentTools'
import { getSettings } from './settings'

/**
 * Die Inferenz-Engine. Läuft im Main-Prozess und nutzt llama.cpp über node-llama-cpp.
 * Auf Apple Silicon wird automatisch die GPU (Metal) verwendet.
 */

/** Wird an den System-Prompt angehängt, damit das Modell die Werkzeuge sinnvoll nutzt. */
const AGENT_HINT = `

Wenn dir Werkzeuge zur Verfügung stehen, arbeitest du selbstständig im Projektordner des Nutzers:
- Verschaffe dir mit list_files, find_files oder search_code einen Überblick und lies die relevanten Stellen
  mit read_file, bevor du antwortest oder etwas änderst. Rate keine Dateiinhalte – schau nach.
- Pfade sind immer relativ zum Projektordner. Mit open_file zeigst du dem Nutzer eine Stelle im Editor.
Als Coding-Agent (wenn edit_file, write_file und run_command verfügbar sind):
- Ändere nur, was für die Aufgabe nötig ist. Für kleine Änderungen edit_file, für neue Dateien write_file.
- Prüfe deine Änderungen, z. B. mit Tests, Build oder Linter über run_command, und behebe Fehler.
- Jede Änderung und jeder Befehl wird dem Nutzer zur Freigabe gezeigt. Lehnt er ab, respektiere das.
- Führe nichts Destruktives aus (löschen, git push, Abhängigkeiten global installieren), außer der Nutzer bittet ausdrücklich darum.
- Fasse am Ende kurz zusammen, was du geändert hast.`

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

export async function loadModel(modelPath: string): Promise<void> {
  await unloadModel()
  setStatus({ state: 'loading', modelPath, progress: 0 })
  try {
    const { getLlama, LlamaChatSession } = await loadLib()
    llama ??= await getLlama()

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

export interface ChatCallbacks {
  onChunk: (c: ChatChunk) => void
  onOpenFile: (f: AgentOpenFile) => void
  onFileChanged: (path: string) => void
  onApproval: (req: ApprovalRequest) => void
}

export async function chat(req: ChatRequest, cb: ChatCallbacks): Promise<void> {
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
  const options = {
    signal: abort.signal,
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
      if (chunk.text) emit(kind, chunk.text)
    }
  }

  try {
    let prompt = req.prompt
    if (mode === 'agent') {
      prompt = `[Modus: Coding-Agent – du darfst Dateien ändern und Befehle ausführen; der Nutzer gibt jede Aktion frei.]\n${prompt}`
    } else if (mode === 'read') {
      prompt = `[Modus: Nur lesen – du darfst nichts ändern und keine Befehle ausführen.]\n${prompt}`
    }
    if (runner && req.root && overviewSentFor !== req.root) {
      overviewSentFor = req.root
      // Eine Übersicht vorab spart Suchschritte und verhindert, dass kleine Modelle Pfade raten
      const overview = await tools.listFiles(req.root, '.', 2).catch(() => '')
      if (overview) {
        emit('tool', '📂 Projektübersicht')
        prompt = `Projektstruktur (Auszug):\n${overview.slice(0, 3000)}\n\n${prompt}`
      }
    }
    // Schleife für Modelle, die Werkzeuge als Text aufrufen (siehe parseToolCall)
    for (;;) {
      announced.clear()
      const answer = await session.prompt(prompt, options)
      if (!runner || abort.signal.aborted) break
      const call = agent.parseToolCall(answer, available)
      if (!call) break
      // Der JSON-Text war kein Teil der Antwort – in der Oberfläche wieder entfernen
      emit('retract', '')
      const result = await runner.call(call.name, call.args)
      if (abort.signal.aborted) break
      prompt =
        `Ergebnis von ${call.name}:\n${result}\n\n` +
        (runner.exhausted
          ? 'Das Werkzeug-Limit ist erreicht. Fasse jetzt zusammen, was du getan hast und was noch offen ist.'
          : result.startsWith('Fehler')
            ? 'Das hat nicht geklappt. Lies die Fehlermeldung, korrigiere den Aufruf oder versuche ein anderes Werkzeug, statt aufzugeben.'
            : 'Mach mit dem nächsten Schritt weiter oder fasse zusammen, wenn die Aufgabe erledigt ist.')
    }
  } finally {
    if (currentAbort === abort) currentAbort = null
  }
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
