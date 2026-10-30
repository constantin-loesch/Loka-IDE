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
  kind: 'text' | 'thought'
  text: string
}

export interface ChatRequest {
  requestId: string
  prompt: string
  temperature?: number
}

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
