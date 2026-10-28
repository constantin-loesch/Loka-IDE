import { basename } from 'node:path'
import type { Llama, LlamaChatSession, LlamaContext, LlamaModel } from 'node-llama-cpp'
import type { ChatChunk, ChatRequest, EngineStatus } from '../shared/types'

/**
 * Die Inferenz-Engine. Läuft im Main-Prozess und nutzt llama.cpp über node-llama-cpp.
 * Auf Apple Silicon wird automatisch die GPU (Metal) verwendet.
 */

const SYSTEM_PROMPT = `Du bist ein hilfreicher Programmier-Assistent in einer lokalen IDE.
Antworte präzise und in der Sprache des Nutzers. Setze Code immer in Markdown-Codeblöcke mit Sprachangabe.
Wenn der Nutzer Code aus seinem Editor mitschickt, beziehe dich konkret darauf.`

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

    model = await llama.loadModel({
      modelPath,
      onLoadProgress: (progress) => setStatus({ state: 'loading', modelPath, progress })
    })
    // Kontext begrenzen, damit der Speicher auf kleinen Rechnern reicht
    context = await model.createContext({ contextSize: { max: 8192 } })
    session = new LlamaChatSession({ contextSequence: context.getSequence(), systemPrompt: SYSTEM_PROMPT })

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
  context = null
  model = null
  setStatus({ state: 'idle' })
}

export async function chat(req: ChatRequest, onChunk: (c: ChatChunk) => void): Promise<void> {
  if (!session) throw new Error('Kein Modell geladen')
  currentAbort = new AbortController()
  try {
    await session.prompt(req.prompt, {
      signal: currentAbort.signal,
      stopOnAbortSignal: true,
      temperature: req.temperature ?? 0.4,
      onResponseChunk: (chunk) => {
        const kind = chunk.type === 'segment' && chunk.segmentType === 'thought' ? 'thought' : 'text'
        if (chunk.text) onChunk({ requestId: req.requestId, kind, text: chunk.text })
      }
    })
  } finally {
    currentAbort = null
  }
}

export function stopChat(): void {
  currentAbort?.abort()
}

export function resetChat(): void {
  session?.resetChatHistory()
}
