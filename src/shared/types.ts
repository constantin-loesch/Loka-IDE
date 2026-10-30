// Typen, die Main-Prozess, Preload und Oberfläche gemeinsam nutzen.

export interface CatalogModel {
  id: string
  name: string
  description: string
  /** Parameter in Milliarden, nur zur Anzeige */
  params: string
  url: string
  fileName: string
  sizeBytes: number
  tags: string[]
}

export type Fit = 'gut' | 'knapp' | 'zu-gross'

export interface CatalogEntry extends CatalogModel {
  fit: Fit
  installed: boolean
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
}

export const LOAD_SETTINGS: (keyof ModelSettings)[] = ['contextSize', 'gpuLayers', 'flashAttention']

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
