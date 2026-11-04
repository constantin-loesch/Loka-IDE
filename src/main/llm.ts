import { app } from 'electron'
import { existsSync } from 'node:fs'
import { basename, join } from 'node:path'
import type { ChatSessionModelFunctions, Llama, LlamaChatSession, LlamaContext, LlamaModel } from 'node-llama-cpp'
import type { AgentOpenFile, ApprovalRequest, ChatChunk, ChatRequest, EngineStatus, GpuBackend, HardwareInfo } from '../shared/types'
import { describeHardware } from './hardware'
import * as agent from './agent'
import * as tools from './agentTools'
import { getSettings } from './settings'
import { t } from './i18n'

/**
 * The inference engine. Runs in the main process and uses llama.cpp via node-llama-cpp.
 * On Apple Silicon the GPU (Metal) is used automatically.
 */

/** Appended to the system prompt so the model uses the tools sensibly. */
const AGENT_HINT = `

When tools are available to you, you work on your own in the user's project folder.
Figure out yourself what is wanted:
- General question or small talk → just answer, no tools needed.
- Question about the project → look it up (list_files, search_code, read_file) and then answer, change nothing.
- Request to create, change or fix something → act as a coding agent (see below).
- Get an overview with list_files, find_files or search_code and read the relevant parts
  with read_file before you answer or change anything. Don't guess file contents – look them up.
- Paths are always relative to the project folder. With open_file you show the user a location in the editor.
As a coding agent (when edit_file, write_file and run_command are available):
- Only change what the task needs. For changes use replace_lines (with line numbers from read_file) or edit_file, for new files write_file.
- After every write the syntax is checked. If the result reports a SYNTAX ERROR, fix it right away.
- Check your changes, e.g. with tests, build or linter via run_command, and fix errors.
- Every change and every command is shown to the user for approval. If they decline, respect that.
- Don't do anything destructive (deleting, git push, installing dependencies globally) unless the user explicitly asks for it.
- At the end, briefly summarize what you changed.
How to call a tool: a JSON object {"name": "<tool>", "arguments": {...}}. Several calls in one
answer are allowed and are executed in order. You only get the results afterwards – so never
write that something is done before you have seen the result. Code that belongs in a file goes into
write_file/edit_file and not just as a code block in your answer. Create files exactly where the user says.`

/** Token limit per model answer in agent mode, unless a limit is set */
const AGENT_STEP_TOKENS = 3000

const systemPrompt = (): string => getSettings().systemPrompt + AGENT_HINT

// node-llama-cpp is a pure ES module, so it is loaded dynamically.
type NodeLlamaCpp = typeof import('node-llama-cpp')
let lib: NodeLlamaCpp | null = null
const loadLib = async (): Promise<NodeLlamaCpp> => (lib ??= await import('node-llama-cpp'))

let llama: Llama | null = null
let model: LlamaModel | null = null
let context: LlamaContext | null = null
let session: LlamaChatSession | null = null
let status: EngineStatus = { state: 'idle' }
let currentAbort: AbortController | null = null
/** Project folder whose overview the model already got in this chat */
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

/** Is there a llama.cpp built with scripts/build-llama-cuda.sh? (Linux only) */
function hasLocalCudaBuild(): boolean {
  if (process.platform !== 'linux') return false
  const dir = join(app.getAppPath(), 'node_modules', 'node-llama-cpp', 'llama').replace('app.asar', 'app.asar.unpacked')
  return existsSync(join(dir, 'lastBuild.json')) && existsSync(join(dir, 'localBuilds'))
}

/** Which backend the current llama instance was created with */
let llamaBackend: GpuBackend | null = null

/**
 * Start llama.cpp with the configured backend. “auto” takes the best available one:
 * Metal on the Mac, otherwise CUDA (NVIDIA) or Vulkan, CPU as a last resort.
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
  // Prefer a self-built llama.cpp with CUDA (Jetson, DGX Spark – see scripts/build-llama-cuda.sh)
  if ((wanted === 'auto' || wanted === 'cuda') && hasLocalCudaBuild()) {
    try {
      const local = await getLlama('lastBuild')
      if (local.gpu === 'cuda') {
        llama = local
        llamaBackend = wanted
        return local
      }
      await local.dispose()
    } catch (err) {
      console.warn('Local CUDA build cannot be loaded, using the prebuilt binaries:', err)
    }
  }
  try {
    llama = await getLlama(wanted === 'auto' ? undefined : { gpu: wanted === 'cpu' ? false : wanted })
  } catch (err) {
    if (wanted === 'auto') throw err
    // Requested backend not available (e.g. CUDA not installed) – better automatic than nothing
    console.warn(`Backend ${wanted} not available, using automatic selection:`, err)
    llama = await getLlama()
  }
  llamaBackend = wanted
  return llama
}

/** Detected hardware (starts llama.cpp for that, if needed). */
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
    // Limit the context so memory suffices on small machines (0 = as large as possible)
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

/** Native function calls for models that master the format of their chat template. */
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

/** Does the task want to change something (create, fix, change …)? German and English verbs. */
const CHANGE_WORDS =
  /(?<!\p{L})(erstell|anleg|leg\p{L}* (?:\p{L}+ ){0,4}an\b|schreib|beheb|fix|reparier|änder|aender|füg|fueg|ergänz|implementier|refaktor|umbenenn|lösch|entfern|aktualisier)/iu
const CHANGE_REQUEST = { test: (t: string): boolean => CHANGE_WORDS.test(t) || /^\s*(please\s+)?(add|create|write|change|remove|rename|update|fix|implement|refactor)\b/i.test(t) }

/** File names mentioned in the task, e.g. "calc.js" or "src/app.py" */
const FILE_NAME = /(?:^|[\s"'`„(])((?:[\w.-]+\/)*[\w-]+\.(?:js|mjs|cjs|ts|tsx|jsx|py|json|md|html|css|scss|txt|sh|yml|yaml|toml|java|kt|go|rs|rb|php|c|cpp|h|swift|vue|svelte|sql))(?=$|[\s"'`“),.;:!?])/gi
/** Does the task ask to run something? */
const RUN_REQUEST = /\b(führ\w*|fuehr\w*|starte|lass\w*)\b[^.]*\b(aus|laufen)\b|\b(npm|yarn|pnpm)\s+(test|run)\b|\bpytest\b|\brun the\b/i

/** Reason why the task isn't finished yet – or null if the model may stop. */
function unfinished(
  answer: string,
  task: string,
  runner: ReturnType<typeof agent.makeRunner>,
  root: string
): { label: string; prompt: string } | null {
  if (runner.syntaxErrors.size) {
    return {
      label: t('Syntax error in {files} – the model should fix it', { files: [...runner.syntaxErrors].join(', ') }),
      prompt: `There is still a syntax error in ${[...runner.syntaxErrors].join(', ')}. Read the file with read_file and fix it with replace_lines or write_file.`
    }
  }
  if (runner.lastCommandFailed) {
    return {
      label: t('Last command failed – the model should fix the problem'),
      prompt: 'The last command failed, so the task is not done yet. Fix the cause (e.g. with edit_file or write_file) and then run the command again.'
    }
  }
  if (runner.changed.size === 0 && CHANGE_REQUEST.test(task)) {
    const codeOnly = /```[\w-]*\n(?:.*\n){2,}?```/.test(answer)
    return {
      label: t('No file changed yet – the model should actually make the change'),
      prompt:
        (codeOnly ? 'You only output code as text. ' : 'You described the problem, ') +
        'but NO file has been created or changed yet. Make the change now with write_file (new file) or edit_file (existing file) and check it afterwards.'
    }
  }
  // Files named in the task that don't exist (anywhere in the project) – only if something should be created
  if (/(?<!\p{L})(erstell|anleg|schreib|neue)|^\s*(create|write)\b/iu.test(task)) {
    const named = [...new Set([...task.matchAll(FILE_NAME)].map((m) => m[1]))]
    const missing = named.filter((f) => ![...runner.changed].some((c) => c === f || c.endsWith('/' + f)) && !existsSync(join(root, f)))
    if (missing.length) {
      return {
        label: t('{files} still missing – the model should continue', { files: missing.join(', ') }),
        prompt: `The task is not complete yet: ${missing.join(', ')} has not been created. Create the missing file(s) now with write_file.`
      }
    }
  }
  if (RUN_REQUEST.test(task) && runner.commandsRun === 0) {
    return {
      label: t('Requested command has not been run yet'),
      prompt: 'The task asks to run something (e.g. tests). That has not happened yet. Run the command now with run_command.'
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
  if (!session) throw new Error(t('No model loaded'))
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
  // Own abort per model answer: stops as soon as the model keeps fantasizing after a tool call
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
    // Never unlimited in agent mode: a model that gets lost in a tool parameter would otherwise hang forever
    maxTokens: s.maxTokens > 0 ? s.maxTokens : runner ? AGENT_STEP_TOKENS : undefined,
    repeatPenalty: s.repeatPenalty > 1 ? { penalty: s.repeatPenalty, lastTokens: s.repeatLastTokens } : (false as const),
    budgets: s.thoughtTokens !== null ? { thoughtTokens: s.thoughtTokens } : undefined,
    functions,
    // Tool calls in native format are not streamed as text – still show progress
    onFunctionCallParamsChunk: (c: { callIndex: number; functionName: string }) => {
      const key = `${c.callIndex}`
      if (announced.has(key)) return
      announced.add(key)
      emit('tool', t('⏳ preparing {name} …', { name: c.functionName }))
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
      prompt = `[Read only – you may not change anything or run commands.]\n${prompt}`
    }
    if (runner && req.root && overviewSentFor !== req.root) {
      overviewSentFor = req.root
      // An overview up front saves search steps and keeps small models from guessing paths
      const overview = await tools.listFiles(req.root, '.', 2).catch(() => '')
      const testCmd = await tools.detectTestCommand(req.root)
      if (overview) {
        emit('tool', t('📂 Project overview'))
        prompt =
          `Project structure (excerpt):\n${overview.slice(0, 3000)}\n` +
          (testCmd ? `Tests of this project run with: ${testCmd}\n` : '') +
          `\n${prompt}`
      }
    }
    // Loop for models that call tools as text (see parseToolCalls)
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
        // Context full – report it clearly instead of crashing
        emit('text', '\n\n⚠ ' + t('The model\'s context is full. Start a new chat (+ at the top) or increase the context size in the model settings.'))
        if (runner?.log.length) emit('text', `\n\n${runner.summary()}`)
        break
      }
      if (!runner || abort.signal.aborted) break
      const calls = agent.parseToolCalls(answer, available)

      if (calls.length === 0) {
        // The model wants to stop. Check whether the task is really done, otherwise let it continue (a limited number of times).
        const reason = mode === 'agent' && !runner.exhausted && !runner.userRejected && nudges < 5 ? unfinished(answer, req.prompt, runner, req.root!) : null
        if (reason) {
          nudges++
          emit('retract', '')
          emit('tool', `↻ ${reason.label}`)
          prompt = reason.prompt + ' Answer only with the necessary tool calls as JSON.'
          continue
        }
        break
      }

      // The text with the calls (and anticipated success messages) is not a real answer
      emit('retract', '')

      // After a decline, don't do anything else on its own
      if (runner.userRejected) {
        emit('text', `${runner.summary()}\n\n${t('I did not do anything else after that. Tell me how I should do it instead.')}`)
        break
      }

      const fresh = calls.filter((c) => !runner.seen(c.name, c.args))
      // Don't repeat identical calls that already failed – point that out clearly instead
      const repeatedFailure = fresh.find((c) => runner.failedBefore(c.name, c.args))
      if (repeatedFailure) {
        repeatedFailures++
        if (repeatedFailures > 2) {
          emit('text', runner.summary() + '\n\n' + t('The model got stuck at this point. Describe the task more precisely or try a larger model.'))
          break
        }
        prompt =
          `You already called ${repeatedFailure.name} exactly like this and it failed:\n` +
          `${runner.failedBefore(repeatedFailure.name, repeatedFailure.args)}\n\n` +
          'Do NOT repeat this call. Do something else: read the file with read_file and copy old_text exactly, ' +
          'or rewrite the whole file with write_file.'
        continue
      }
      if (fresh.length === 0 || runner.exhausted) {
        // Only repetitions left or limit reached: ask for a summary once, then finish on our own
        if (!askedForSummary && !runner.exhausted) {
          askedForSummary = true
          prompt =
            'All these calls were already executed successfully – there is nothing left to do. ' +
            'Now answer ONLY with a short summary for the user, without tool calls.'
          continue
        }
        emit('text', runner.summary() + (runner.exhausted ? '\n\n' + t('(Tool limit reached – increase it in the settings if needed.)') : ''))
        break
      }

      const report: string[] = []
      for (let k = 0; k < fresh.length; k++) {
        const { name, args } = fresh[k]
        const result = await runner.call(name, args)
        report.push(`### ${k + 1}. ${name}\n${result}`)
        if (abort.signal.aborted) break
        if (runner.userRejected) {
          if (k < fresh.length - 1) report.push(`The remaining ${fresh.length - k - 1} calls were NOT executed.`)
          break
        }
        // Later steps usually build on earlier ones – don't continue blindly after an error
        if (agent.failed(result) && k < fresh.length - 1) {
          report.push(`The remaining ${fresh.length - k - 1} calls were NOT executed because this step did not work.`)
          break
        }
        if (runner.exhausted) break
      }
      if (abort.signal.aborted) break
      const skipped = calls.length - fresh.length

      const changedList = [...runner.changed]
      prompt =
        `Results of your tool calls:\n\n${report.join('\n\n')}\n\n` +
        (skipped ? `${skipped} call(s) were repetitions of things already done and were skipped.\n` : '') +
        `Files actually written so far: ${changedList.length ? changedList.join(', ') : 'none'}.\n` +
        `As a reminder, the user's task: “${req.prompt.slice(0, 600)}” – check whether every part of it is really done.\n` +
        'Only claim what these results show. Don\'t repeat completed steps. ' +
        (runner.userRejected
          ? 'The user declined. Do NOT call any more tools. Answer briefly: what you intended and ask what they want instead.'
          : runner.exhausted
          ? 'The tool limit is reached. Now honestly summarize what is done and what is still open.'
          : report.some((r) => agent.failed(r.split('\n').slice(1).join('\n')))
            ? 'At least one step failed. Read the message, fix the problem and then continue.'
            : 'If the task is done with this, answer only with a short summary without tool calls. Otherwise call the next tools.')
    }
  } finally {
    if (currentAbort === abort) currentAbort = null
  }
  return { changed: runner ? [...runner.changed] : [] }
}

export function stopChat(): void {
  currentAbort?.abort()
}

/** New chat – also applies a changed system prompt. */
export function resetChat(): void {
  agent.resetApprovals()
  overviewSentFor = null
  session?.setChatHistory([{ type: 'system', text: systemPrompt() }])
}
