import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type {
  AgentOpenFile,
  ApprovalAnswer,
  ApprovalRequest,
  CatalogEntry,
  ChatChunk,
  ChatRequest,
  BuildTask,
  DevcontainerLog,
  DevcontainerStatus,
  DevcontainerTemplate,
  DirEntry,
  DownloadProgress,
  GitHubAccount,
  GitStatus,
  HardwareInfo,
  EngineStatus,
  InstalledModel,
  ModelSettings,
  OpenedFile,
  PortInfo,
  SystemInfo,
  TerminalCreateOptions,
  TerminalInfo,
  TextEncoding,
  UpdateInfo,
  UpdateState
} from '../shared/types'

/** Abonniert ein Event und gibt eine Funktion zum Abmelden zurück. */
function on<T>(channel: string, cb: (payload: T) => void): () => void {
  const handler = (_e: IpcRendererEvent, payload: T): void => cb(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api = {
  /** 'darwin', 'linux' oder 'win32' */
  platform: process.platform,
  system: {
    info: (): Promise<SystemInfo> => ipcRenderer.invoke('system:info'),
    hardware: (): Promise<HardwareInfo> => ipcRenderer.invoke('system:hardware'),
    revealModels: (): Promise<void> => ipcRenderer.invoke('system:revealModels')
  },
  fs: {
    openFolder: (): Promise<string | null> => ipcRenderer.invoke('fs:openFolder'),
    readDir: (dir: string): Promise<DirEntry[]> => ipcRenderer.invoke('fs:readDir', dir),
    openFile: (path: string, forceText = false): Promise<OpenedFile> => ipcRenderer.invoke('fs:openFile', path, forceText),
    writeFile: (path: string, content: string, encoding?: TextEncoding): Promise<void> =>
      ipcRenderer.invoke('fs:writeFile', path, content, encoding),
    openExternal: (path: string): Promise<void> => ipcRenderer.invoke('fs:openExternal', path),
    createFile: (path: string): Promise<void> => ipcRenderer.invoke('fs:createFile', path),
    createDir: (path: string): Promise<void> => ipcRenderer.invoke('fs:createDir', path),
    rename: (from: string, to: string): Promise<void> => ipcRenderer.invoke('fs:rename', from, to),
    /** In den Papierkorb verschieben */
    trash: (path: string): Promise<void> => ipcRenderer.invoke('fs:trash', path),
    reveal: (path: string): Promise<void> => ipcRenderer.invoke('fs:reveal', path),
    /** Diese Ordner auf Änderungen beobachten (ersetzt die bisherige Liste) */
    watch: (dirs: string[]): Promise<void> => ipcRenderer.invoke('fs:watch', dirs),
    onChanged: (cb: (dir: string) => void) => on('fs:changed', cb)
  },
  terminal: {
    create: (opts: TerminalCreateOptions): Promise<TerminalInfo> => ipcRenderer.invoke('terminal:create', opts),
    write: (id: string, data: string): Promise<void> => ipcRenderer.invoke('terminal:write', id, data),
    resize: (id: string, cols: number, rows: number): Promise<void> => ipcRenderer.invoke('terminal:resize', id, cols, rows),
    kill: (id: string): Promise<void> => ipcRenderer.invoke('terminal:kill', id),
    list: (): Promise<TerminalInfo[]> => ipcRenderer.invoke('terminal:list'),
    onData: (cb: (d: { id: string; data: string }) => void) => on('terminal:data', cb),
    onExit: (cb: (d: { id: string; code: number }) => void) => on('terminal:exit', cb)
  },
  ports: {
    list: (): Promise<PortInfo[]> => ipcRenderer.invoke('ports:list'),
    /** Liefert den lokalen Port, unter dem der Dienst erreichbar ist */
    forward: (port: number): Promise<number> => ipcRenderer.invoke('ports:forward', port),
    unforward: (port: number): Promise<void> => ipcRenderer.invoke('ports:unforward', port),
    setProject: (dir: string | null): Promise<void> => ipcRenderer.invoke('ports:setProject', dir),
    onChanged: (cb: (list: PortInfo[]) => void) => on('ports:changed', cb)
  },
  devcontainer: {
    status: (root: string): Promise<DevcontainerStatus> => ipcRenderer.invoke('devcontainer:status', root),
    options: (): Promise<{
      images: Record<string, { label: string; image: string }>
      features: Record<string, { label: string; id: string }>
    }> => ipcRenderer.invoke('devcontainer:options'),
    suggest: (root: string): Promise<DevcontainerTemplate> => ipcRenderer.invoke('devcontainer:suggest', root),
    preview: (t: DevcontainerTemplate): Promise<string> => ipcRenderer.invoke('devcontainer:preview', t),
    create: (root: string, t: DevcontainerTemplate): Promise<string> => ipcRenderer.invoke('devcontainer:create', root, t),
    up: (root: string, rebuild = false): Promise<{ containerId: string }> => ipcRenderer.invoke('devcontainer:up', root, rebuild),
    cancel: (): Promise<void> => ipcRenderer.invoke('devcontainer:cancel'),
    stop: (root: string): Promise<void> => ipcRenderer.invoke('devcontainer:stop', root),
    remove: (root: string): Promise<void> => ipcRenderer.invoke('devcontainer:remove', root),
    onLog: (cb: (l: DevcontainerLog) => void) => on('devcontainer:log', cb),
    onChanged: (cb: (root: string) => void) => on('devcontainer:changed', cb)
  },
  update: {
    info: (): Promise<UpdateInfo> => ipcRenderer.invoke('update:info'),
    state: (): Promise<UpdateState> => ipcRenderer.invoke('update:state'),
    check: (): Promise<UpdateState> => ipcRenderer.invoke('update:check'),
    /** Neue Version holen und bauen (Fortschritt über onState/onLog) */
    install: (): Promise<void> => ipcRenderer.invoke('update:install'),
    /** Alte App gegen die neue tauschen und neu starten */
    restart: (): Promise<void> => ipcRenderer.invoke('update:restart'),
    onState: (cb: (s: UpdateState) => void) => on('update:state', cb),
    onLog: (cb: (text: string) => void) => on('update:log', cb)
  },
  tasks: {
    detect: (root: string): Promise<BuildTask[]> => ipcRenderer.invoke('tasks:detect', root)
  },
  models: {
    catalog: (): Promise<CatalogEntry[]> => ipcRenderer.invoke('models:catalog'),
    installed: (): Promise<InstalledModel[]> => ipcRenderer.invoke('models:installed'),
    download: (id: string): Promise<void> => ipcRenderer.invoke('models:download', id),
    cancelDownload: (id: string): Promise<void> => ipcRenderer.invoke('models:cancelDownload', id),
    remove: (path: string): Promise<void> => ipcRenderer.invoke('models:remove', path),
    import: (): Promise<boolean> => ipcRenderer.invoke('models:import'),
    onProgress: (cb: (p: DownloadProgress) => void) => on('models:progress', cb)
  },
  engine: {
    status: (): Promise<EngineStatus> => ipcRenderer.invoke('engine:status'),
    load: (path: string): Promise<void> => ipcRenderer.invoke('engine:load', path),
    unload: (): Promise<void> => ipcRenderer.invoke('engine:unload'),
    onStatus: (cb: (s: EngineStatus) => void) => on('engine:status', cb)
  },
  git: {
    status: (dir: string): Promise<GitStatus> => ipcRenderer.invoke('git:status', dir),
    init: (dir: string): Promise<void> => ipcRenderer.invoke('git:init', dir),
    commit: (dir: string, message: string, paths: string[]): Promise<void> =>
      ipcRenderer.invoke('git:commit', dir, message, paths),
    push: (dir: string): Promise<void> => ipcRenderer.invoke('git:push', dir),
    pull: (dir: string): Promise<void> => ipcRenderer.invoke('git:pull', dir),
    setRemote: (dir: string, url: string): Promise<void> => ipcRenderer.invoke('git:setRemote', dir, url),
    setIdentity: (dir: string, name: string, email: string): Promise<void> =>
      ipcRenderer.invoke('git:setIdentity', dir, name, email)
  },
  github: {
    account: (): Promise<GitHubAccount | null> => ipcRenderer.invoke('github:account'),
    connect: (token: string): Promise<GitHubAccount> => ipcRenderer.invoke('github:connect', token),
    disconnect: (): Promise<void> => ipcRenderer.invoke('github:disconnect'),
    /** Wo der Token gespeichert wird (Schlüsselbund, Datei …) */
    storage: (): Promise<string> => ipcRenderer.invoke('github:storage'),
    publish: (dir: string, name: string, isPrivate: boolean): Promise<string> =>
      ipcRenderer.invoke('github:publish', dir, name, isPrivate)
  },
  openUrl: (url: string): Promise<void> => ipcRenderer.invoke('shell:openUrl', url),
  /** Text in die Zwischenablage */
  copy: (text: string): Promise<void> => ipcRenderer.invoke('clipboard:write', text),
  settings: {
    get: (): Promise<ModelSettings> => ipcRenderer.invoke('settings:get'),
    defaults: (): Promise<ModelSettings> => ipcRenderer.invoke('settings:defaults'),
    update: (patch: Partial<ModelSettings>): Promise<ModelSettings> => ipcRenderer.invoke('settings:update', patch)
  },
  agent: {
    onOpenFile: (cb: (f: AgentOpenFile) => void) => on('agent:openFile', cb),
    onFileChanged: (cb: (path: string) => void) => on('agent:fileChanged', cb),
    onApproval: (cb: (req: ApprovalRequest) => void) => on('agent:approval', cb),
    answer: (a: ApprovalAnswer): Promise<void> => ipcRenderer.invoke('agent:answer', a),
    /** Alle Dateiänderungen einer Antwort zurücknehmen; liefert die Anzahl der Dateien */
    revert: (requestId: string): Promise<number> => ipcRenderer.invoke('agent:revert', requestId)
  },
  session: {
    get: (): Promise<unknown> => ipcRenderer.invoke('session:get'),
    set: (data: unknown): Promise<void> => ipcRenderer.invoke('session:set', data)
  },
  menu: {
    onCloseTab: (cb: () => void) => on('menu:closeTab', cb),
    onNewTerminal: (cb: () => void) => on('menu:newTerminal', cb),
    onToggleTerminal: (cb: () => void) => on('menu:toggleTerminal', cb),
    onCheckUpdates: (cb: () => void) => on('menu:checkUpdates', cb)
  },
  chat: {
    send: (req: ChatRequest): Promise<{ ok: boolean; error?: string; changed?: string[] }> => ipcRenderer.invoke('chat:send', req),
    stop: (): Promise<void> => ipcRenderer.invoke('chat:stop'),
    reset: (): Promise<void> => ipcRenderer.invoke('chat:reset'),
    onChunk: (cb: (c: ChatChunk) => void) => on('chat:chunk', cb)
  }
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)
