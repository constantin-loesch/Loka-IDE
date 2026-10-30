import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type {
  CatalogEntry,
  ChatChunk,
  ChatRequest,
  DirEntry,
  DownloadProgress,
  GitHubAccount,
  GitStatus,
  EngineStatus,
  InstalledModel,
  OpenedFile,
  SystemInfo,
  TextEncoding
} from '../shared/types'

/** Abonniert ein Event und gibt eine Funktion zum Abmelden zurück. */
function on<T>(channel: string, cb: (payload: T) => void): () => void {
  const handler = (_e: IpcRendererEvent, payload: T): void => cb(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api = {
  system: {
    info: (): Promise<SystemInfo> => ipcRenderer.invoke('system:info'),
    revealModels: (): Promise<void> => ipcRenderer.invoke('system:revealModels')
  },
  fs: {
    openFolder: (): Promise<string | null> => ipcRenderer.invoke('fs:openFolder'),
    readDir: (dir: string): Promise<DirEntry[]> => ipcRenderer.invoke('fs:readDir', dir),
    openFile: (path: string, forceText = false): Promise<OpenedFile> => ipcRenderer.invoke('fs:openFile', path, forceText),
    writeFile: (path: string, content: string, encoding?: TextEncoding): Promise<void> =>
      ipcRenderer.invoke('fs:writeFile', path, content, encoding),
    openExternal: (path: string): Promise<void> => ipcRenderer.invoke('fs:openExternal', path)
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
    publish: (dir: string, name: string, isPrivate: boolean): Promise<string> =>
      ipcRenderer.invoke('github:publish', dir, name, isPrivate)
  },
  openUrl: (url: string): Promise<void> => ipcRenderer.invoke('shell:openUrl', url),
  menu: {
    onCloseTab: (cb: () => void) => on('menu:closeTab', cb)
  },
  chat: {
    send: (req: ChatRequest): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke('chat:send', req),
    stop: (): Promise<void> => ipcRenderer.invoke('chat:stop'),
    reset: (): Promise<void> => ipcRenderer.invoke('chat:reset'),
    onChunk: (cb: (c: ChatChunk) => void) => on('chat:chunk', cb)
  }
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)
