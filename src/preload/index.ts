import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type {
  CatalogEntry,
  ChatChunk,
  ChatRequest,
  DirEntry,
  DownloadProgress,
  EngineStatus,
  InstalledModel,
  SystemInfo
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
    readFile: (path: string): Promise<string> => ipcRenderer.invoke('fs:readFile', path),
    writeFile: (path: string, content: string): Promise<void> => ipcRenderer.invoke('fs:writeFile', path, content)
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
  chat: {
    send: (req: ChatRequest): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke('chat:send', req),
    stop: (): Promise<void> => ipcRenderer.invoke('chat:stop'),
    reset: (): Promise<void> => ipcRenderer.invoke('chat:reset'),
    onChunk: (cb: (c: ChatChunk) => void) => on('chat:chunk', cb)
  }
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)
