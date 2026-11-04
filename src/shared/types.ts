import type { LangSetting } from './i18n'

// Types shared by the main process, preload and UI.

/** One file of a model – large models consist of several parts (…-00001-of-00006.gguf). */
export interface ModelFile {
  url: string
  fileName: string
  sizeBytes: number
}

/** One quantization of a model, e.g. 4-bit (Q4_K_M) or the unquantized original (BF16). */
export interface ModelVariant {
  id: string
  quant: string
  label: string
  sizeBytes: number
  files: ModelFile[]
}

export type SizeClass = 'small' | 'medium' | 'large' | 'huge'

export interface CatalogModel {
  id: string
  name: string
  description: string
  /** Hugging Face repository of the GGUF files */
  repo: string
  sizeClass: SizeClass
  /** Total parameters (billions) */
  totalParamsB: number
  /** Parameters computed per token – much smaller for MoE models, hence faster */
  activeParamsB: number
  tags: string[]
  /** Model license – not every model may be used commercially */
  license: ModelLicense
  recommendedVariant: string
  variants: ModelVariant[]
}

export interface ModelLicense {
  name: string
  url: string
  /** Commercial use allowed? */
  commercial: boolean
  /** Important conditions, short */
  note?: string
}

export type Fit = 'good' | 'tight' | 'too-large'

export interface VariantEntry extends ModelVariant {
  fit: Fit
  installed: boolean
  /** Rough estimate for this machine, null if the model doesn't fit into memory */
  tokensPerSec: number | null
  /** Extra hint, e.g. “runs partly on the CPU” */
  fitNote?: string
}

export interface CatalogEntry extends Omit<CatalogModel, 'variants'> {
  variants: VariantEntry[]
}

export interface InstalledModel {
  /** Absolute path to the .gguf file, also used as ID */
  path: string
  name: string
  sizeBytes: number
  /** true if the file was imported and lives outside the models folder */
  external: boolean
}

export interface DownloadProgress {
  id: string
  received: number
  total: number
  done: boolean
  error?: string
}

/** Detected hardware – decides which models fit and how fast they run. */
export interface HardwareInfo {
  platform: string
  cpu: string
  ramBytes: number
  /** What llama.cpp computes with */
  gpu: 'metal' | 'cuda' | 'vulkan' | 'cpu'
  gpuNames: string[]
  /** Graphics memory (Apple Silicon: shared memory) */
  vramBytes: number
  /** Apple Silicon / Jetson: CPU and GPU share the main memory */
  unifiedMemory: boolean
  /** Memory bandwidth of the compute device in GB/s */
  bandwidthGBs: number
  ramBandwidthGBs: number
}

export type GpuBackend = 'auto' | 'metal' | 'cuda' | 'vulkan' | 'cpu'

export interface SystemInfo {
  totalMemBytes: number
  cpu: string
  platform: string
  modelsDir: string
}

export type EngineStatus =
  | { state: 'idle' }
  | { state: 'loading'; modelPath: string; progress: number }
  | { state: 'ready'; modelPath: string; modelName: string; gpu: string; contextSize: number }
  | { state: 'error'; message: string }

export interface ChatChunk {
  requestId: string
  /**
   * 'tool' = the model uses a tool, 'tool-result' = its output (e.g. terminal),
   * 'retract' = discard the last text section
   */
  kind: 'text' | 'thought' | 'tool' | 'tool-result' | 'retract'
  text: string
}

export interface ChatRequest {
  requestId: string
  prompt: string
  /** Project folder the model may work in */
  root?: string | null
  mode: ChatMode
}

/**
 * chat  = conversation only
 * read  = may search and read the project
 * agent = may also write files and run terminal commands (with approval)
 */
export type ChatMode = 'chat' | 'read' | 'agent'

/** When the agent may act without asking. Dangerous commands always ask. */
export type ApprovalMode = 'ask' | 'auto-edits' | 'auto-all'

/** The agent wants to change something and waits for the user's approval. */
export interface ApprovalRequest {
  id: string
  requestId: string
  kind: 'write' | 'edit' | 'command'
  /** Absolute path for file changes */
  path?: string
  /** Path relative to the project, for display */
  relPath?: string
  command?: string
  /** Previous and new text (for edit only the replaced section) */
  before?: string
  after?: string
  /** New file? */
  isNew?: boolean
  /** Dangerous command – asked even in automatic mode */
  danger?: string
}

export interface ApprovalAnswer {
  id: string
  approved: boolean
  /** Allow similar actions without asking for the rest of this chat */
  always?: boolean
  /** Reason when declining – passed on to the model */
  reason?: string
}

/** Requested by the model: open a file in the editor and jump to the line. */
export interface AgentOpenFile {
  path: string
  line: number
}

/** Adjustable model parameters. Stored in userData/settings.json. */
export interface ModelSettings {
  // While generating – apply immediately
  temperature: number
  topP: number
  topK: number
  minP: number
  repeatPenalty: number
  repeatLastTokens: number
  /** 0 = unlimited */
  maxTokens: number
  /** null = random */
  seed: number | null
  /** null = library default, 0 = thinking off */
  thoughtTokens: number | null
  systemPrompt: string
  /** How often the model may use tools per answer */
  maxToolCalls: number
  approvalMode: ApprovalMode
  /** Seconds after which a terminal command is aborted */
  commandTimeout: number
  // When loading – apply only after reloading the model
  /** 0 = automatically as large as possible */
  contextSize: number
  gpuLayers: 'auto' | 'max' | number
  flashAttention: boolean
  /** Compute backend of llama.cpp: Metal (Mac), CUDA (NVIDIA), Vulkan (AMD/Intel/NVIDIA) or CPU only */
  gpuBackend: GpuBackend
  /** UI language – 'auto' follows the system language */
  language: LangSetting
}

export const LOAD_SETTINGS: (keyof ModelSettings)[] = ['contextSize', 'gpuLayers', 'flashAttention', 'gpuBackend']

export interface DirEntry {
  name: string
  path: string
  isDir: boolean
}

/** Character encoding of a text file – kept when saving. */
export type TextEncoding = 'utf8' | 'utf8bom' | 'utf16le' | 'latin1'

export type MediaKind = 'image' | 'pdf' | 'audio' | 'video'

/** Result of fs:openFile – text, preview or notice depending on the file type. */
export type OpenedFile =
  | { kind: 'text'; content: string; encoding: TextEncoding }
  | { kind: 'media'; media: MediaKind; url: string; size: number }
  | { kind: 'binary'; reason: 'binary' | 'too-large'; size: number }

export type GitFileStatus = 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'conflict'

export interface GitFile {
  /** Absolute path */
  path: string
  /** Path relative to the repository, for display */
  rel: string
  status: GitFileStatus
}

export type GitStatus =
  | { isRepo: false }
  | {
      isRepo: true
      root: string
      branch: string
      hasCommits: boolean
      upstream: string | null
      ahead: number
      behind: number
      remoteUrl: string | null
      files: GitFile[]
      identity: { name: string; email: string } | null
    }

export interface GitHubAccount {
  login: string
  name: string | null
  avatarUrl: string
}

// ---------- Terminal ----------

/** Where a terminal runs: on this machine or in the project's dev container. */
export type TerminalTarget = 'local' | 'container'

export interface TerminalInfo {
  id: string
  title: string
  target: TerminalTarget
  cwd: string
}

export interface TerminalCreateOptions {
  cwd: string
  target: TerminalTarget
  /** Runs after start (e.g. a build task) */
  command?: string
  title?: string
}

// ---------- Ports ----------

export interface PortInfo {
  /** Port the service listens on (in the container or on this machine) */
  port: number
  /** 'local' = process from an IDE terminal, 'container' = in the dev container */
  source: 'local' | 'container'
  /** Process name, if known */
  process?: string
  /** Local port through which a container port is reachable */
  localPort?: number
  /** Forwarding created manually or from forwardPorts in devcontainer.json */
  forwarded: boolean
  /** Address to open in the browser */
  url: string
}

// ---------- Dev container ----------

export type ContainerState = 'none' | 'stopped' | 'running' | 'starting'

export interface DevcontainerStatus {
  /** Is there a devcontainer.json in the project? */
  configPath: string | null
  name: string | null
  /** Is Docker installed and running? */
  docker: 'ok' | 'missing' | 'not-running'
  dockerMessage?: string
  state: ContainerState
  containerId: string | null
  image: string | null
  remoteWorkspaceFolder: string | null
  forwardPorts: number[]
}

/** Selection in the “Create dev container” dialog. */
export interface DevcontainerTemplate {
  name: string
  /** Key from BASE_IMAGES */
  image: string
  /** Key from FEATURES */
  features: string[]
  forwardPorts: number[]
  postCreateCommand: string
}

export interface DevcontainerLog {
  text: string
  /** true when an operation (start, rebuild) has finished */
  done?: boolean
  error?: boolean
}

// ---------- Build tasks ----------

export interface BuildTask {
  /** e.g. “npm”, “make”, “cargo” */
  group: string
  label: string
  command: string
}

// ---------- Updates ----------

export interface UpdateCommit {
  sha: string
  message: string
  date: string
}

export type UpdateState =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'up-to-date'; checkedAt: string }
  | { state: 'available'; behindBy: number; commits: UpdateCommit[]; latest: string }
  | { state: 'installing'; step: string }
  /** New version is built – only the restart is missing */
  | { state: 'ready'; dev: boolean; /** Where the new version gets installed */ installTo?: string }
  | { state: 'error'; message: string }

export interface UpdateInfo {
  /** Git commit this app was built from */
  commit: string
  buildDate: string
  sourceDir: string
  repo: string
}
