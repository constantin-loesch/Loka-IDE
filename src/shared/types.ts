// Typen, die Main-Prozess, Preload und Oberfläche gemeinsam nutzen.

/** Eine Datei eines Modells – große Modelle bestehen aus mehreren Teilen (…-00001-of-00006.gguf). */
export interface ModelFile {
  url: string
  fileName: string
  sizeBytes: number
}

/** Eine Quantisierung eines Modells, z. B. 4-Bit (Q4_K_M) oder das unquantisierte Original (BF16). */
export interface ModelVariant {
  id: string
  quant: string
  label: string
  sizeBytes: number
  files: ModelFile[]
}

export type SizeClass = 'klein' | 'mittel' | 'groß' | 'riesig'

export interface CatalogModel {
  id: string
  name: string
  description: string
  /** Hugging-Face-Repository der GGUF-Dateien */
  repo: string
  sizeClass: SizeClass
  /** Parameter insgesamt (Milliarden) */
  totalParamsB: number
  /** Pro Token gerechnete Parameter – bei MoE-Modellen viel kleiner, deshalb schneller */
  activeParamsB: number
  tags: string[]
  /** Lizenz des Modells – nicht jedes Modell darf kommerziell genutzt werden */
  license: ModelLicense
  recommendedVariant: string
  variants: ModelVariant[]
}

export interface ModelLicense {
  name: string
  url: string
  /** Kommerzielle Nutzung erlaubt? */
  commercial: boolean
  /** Wichtige Auflagen, kurz */
  note?: string
}

export type Fit = 'gut' | 'knapp' | 'zu-gross'

export interface VariantEntry extends ModelVariant {
  fit: Fit
  installed: boolean
  /** Grobe Schätzung für diesen Rechner, null wenn das Modell nicht in den Speicher passt */
  tokensPerSec: number | null
  /** Zusätzlicher Hinweis, z. B. „läuft teilweise auf der CPU“ */
  fitNote?: string
}

export interface CatalogEntry extends Omit<CatalogModel, 'variants'> {
  variants: VariantEntry[]
}

export interface InstalledModel {
  /** Absoluter Pfad zur .gguf-Datei, dient auch als ID */
  path: string
  name: string
  sizeBytes: number
  /** true, wenn die Datei importiert wurde und außerhalb des Modell-Ordners liegt */
  external: boolean
}

export interface DownloadProgress {
  id: string
  received: number
  total: number
  done: boolean
  error?: string
}

/** Erkannte Hardware – bestimmt, welche Modelle passen und wie schnell sie laufen. */
export interface HardwareInfo {
  platform: string
  cpu: string
  ramBytes: number
  /** Womit llama.cpp rechnet */
  gpu: 'metal' | 'cuda' | 'vulkan' | 'cpu'
  gpuNames: string[]
  /** Grafikspeicher (bei Apple Silicon: gemeinsamer Speicher) */
  vramBytes: number
  /** Apple Silicon: CPU und GPU teilen sich den Arbeitsspeicher */
  unifiedMemory: boolean
  /** Speicherbandbreite des Rechenwerks in GB/s */
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
   * 'tool' = das Modell benutzt ein Werkzeug, 'tool-result' = Ausgabe dazu (z. B. Terminal),
   * 'retract' = letzten Textabschnitt verwerfen
   */
  kind: 'text' | 'thought' | 'tool' | 'tool-result' | 'retract'
  text: string
}

export interface ChatRequest {
  requestId: string
  prompt: string
  /** Projektordner, in dem das Modell arbeiten darf */
  root?: string | null
  mode: ChatMode
}

/**
 * chat  = nur Unterhaltung
 * read  = darf im Projekt suchen und lesen
 * agent = darf zusätzlich Dateien schreiben und Terminal-Befehle ausführen (mit Freigabe)
 */
export type ChatMode = 'chat' | 'read' | 'agent'

/** Wann der Agent ohne Nachfrage handeln darf. Gefährliche Befehle fragen immer. */
export type ApprovalMode = 'ask' | 'auto-edits' | 'auto-all'

/** Der Agent möchte etwas verändern und wartet auf die Freigabe des Nutzers. */
export interface ApprovalRequest {
  id: string
  requestId: string
  kind: 'write' | 'edit' | 'command'
  /** Absoluter Pfad bei Dateiänderungen */
  path?: string
  /** Pfad relativ zum Projekt, zur Anzeige */
  relPath?: string
  command?: string
  /** Bisheriger und neuer Text (bei edit nur der ersetzte Abschnitt) */
  before?: string
  after?: string
  /** Neue Datei? */
  isNew?: boolean
  /** Gefährlicher Befehl – wird auch im Automatik-Modus nachgefragt */
  danger?: string
}

export interface ApprovalAnswer {
  id: string
  approved: boolean
  /** Für den Rest dieses Chats gleichartige Aktionen ohne Nachfrage erlauben */
  always?: boolean
  /** Begründung bei Ablehnung – wird dem Modell mitgeteilt */
  reason?: string
}

/** Vom Modell angefordert: Datei im Editor öffnen und zur Zeile springen. */
export interface AgentOpenFile {
  path: string
  line: number
}

/** Einstellbare Modell-Parameter. Werden in userData/settings.json gespeichert. */
export interface ModelSettings {
  // Beim Generieren – gelten sofort
  temperature: number
  topP: number
  topK: number
  minP: number
  repeatPenalty: number
  repeatLastTokens: number
  /** 0 = unbegrenzt */
  maxTokens: number
  /** null = zufällig */
  seed: number | null
  /** null = Standard der Bibliothek, 0 = Nachdenken aus */
  thoughtTokens: number | null
  systemPrompt: string
  /** Wie oft das Modell pro Antwort Werkzeuge benutzen darf */
  maxToolCalls: number
  approvalMode: ApprovalMode
  /** Sekunden, nach denen ein Terminal-Befehl abgebrochen wird */
  commandTimeout: number
  // Beim Laden – gelten erst nach Neuladen des Modells
  /** 0 = automatisch so groß wie möglich */
  contextSize: number
  gpuLayers: 'auto' | 'max' | number
  flashAttention: boolean
  /** Rechen-Backend von llama.cpp: Metal (Mac), CUDA (NVIDIA), Vulkan (AMD/Intel/NVIDIA) oder nur CPU */
  gpuBackend: GpuBackend
}

export const LOAD_SETTINGS: (keyof ModelSettings)[] = ['contextSize', 'gpuLayers', 'flashAttention', 'gpuBackend']

export interface DirEntry {
  name: string
  path: string
  isDir: boolean
}

/** Zeichenkodierung einer Textdatei – wird beim Speichern beibehalten. */
export type TextEncoding = 'utf8' | 'utf8bom' | 'utf16le' | 'latin1'

export type MediaKind = 'image' | 'pdf' | 'audio' | 'video'

/** Ergebnis von fs:openFile – je nach Dateityp Text, Vorschau oder Hinweis. */
export type OpenedFile =
  | { kind: 'text'; content: string; encoding: TextEncoding }
  | { kind: 'media'; media: MediaKind; url: string; size: number }
  | { kind: 'binary'; reason: 'binary' | 'too-large'; size: number }

export type GitFileStatus = 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'conflict'

export interface GitFile {
  /** Absoluter Pfad */
  path: string
  /** Pfad relativ zum Repository, zur Anzeige */
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

/** Wo ein Terminal läuft: auf dem Rechner oder im Devcontainer des Projekts. */
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
  /** Wird nach dem Start ausgeführt (z. B. eine Build-Aufgabe) */
  command?: string
  title?: string
}

// ---------- Ports ----------

export interface PortInfo {
  /** Port, auf dem der Dienst lauscht (im Container bzw. auf dem Rechner) */
  port: number
  /** 'local' = Prozess aus einem Terminal der IDE, 'container' = im Devcontainer */
  source: 'local' | 'container'
  /** Prozessname, falls bekannt */
  process?: string
  /** Lokaler Port, über den ein Container-Port erreichbar ist */
  localPort?: number
  /** Weiterleitung manuell angelegt oder aus forwardPorts der devcontainer.json */
  forwarded: boolean
  /** Adresse zum Öffnen im Browser */
  url: string
}

// ---------- Devcontainer ----------

export type ContainerState = 'none' | 'stopped' | 'running' | 'starting'

export interface DevcontainerStatus {
  /** Gibt es eine devcontainer.json im Projekt? */
  configPath: string | null
  name: string | null
  /** Ist Docker installiert und läuft? */
  docker: 'ok' | 'missing' | 'not-running'
  dockerMessage?: string
  state: ContainerState
  containerId: string | null
  image: string | null
  remoteWorkspaceFolder: string | null
  forwardPorts: number[]
}

/** Auswahl im Dialog „Devcontainer anlegen“. */
export interface DevcontainerTemplate {
  name: string
  /** Schlüssel aus BASE_IMAGES */
  image: string
  /** Schlüssel aus FEATURES */
  features: string[]
  forwardPorts: number[]
  postCreateCommand: string
}

export interface DevcontainerLog {
  text: string
  /** true, wenn ein Vorgang (Start, Neuaufbau) beendet ist */
  done?: boolean
  error?: boolean
}

// ---------- Build-Aufgaben ----------

export interface BuildTask {
  /** z. B. „npm“, „make“, „cargo“ */
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
  /** Neue Version ist gebaut – fehlt nur noch der Neustart */
  | { state: 'ready'; dev: boolean; /** Wohin die neue Version installiert wird */ installTo?: string }
  | { state: 'error'; message: string }

export interface UpdateInfo {
  /** Git-Commit, aus dem diese App gebaut wurde */
  commit: string
  buildDate: string
  sourceDir: string
  repo: string
}
