import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, shell } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { cpus, platform, totalmem } from 'node:os'
import { join } from 'node:path'
import type {
  ApprovalAnswer,
  ChatRequest,
  DevcontainerTemplate,
  DirEntry,
  ModelSettings,
  SystemInfo,
  TerminalCreateOptions,
  TextEncoding
} from '../shared/types'
import * as files from './files'
import * as agent from './agent'
import * as git from './git'
import * as settings from './settings'
import * as llm from './llm'
import * as models from './models'
import * as terminal from './terminal'
import * as ports from './ports'
import * as devcontainer from './devcontainer'
import * as tasks from './tasks'
import * as updater from './updater'

files.registerScheme()

let win: BrowserWindow | null = null

function createWindow(): void {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Lokal IDE',
    backgroundColor: '#1e1f22',
    // Auf dem Mac eigene Titelleiste mit den Ampel-Knöpfen, unter Linux/Windows der normale Fensterrahmen
    ...(process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset' as const } : { autoHideMenuBar: false }),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      // Für den eingebauten PDF-Viewer
      plugins: true
    }
  })

  // Externe Links im Standard-Browser öffnen statt in der App
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

const send = (channel: string, payload: unknown): void => {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload)
}

// ---------- System ----------
ipcMain.handle('system:info', (): SystemInfo => ({
  totalMemBytes: totalmem(),
  cpu: cpus()[0]?.model ?? 'unbekannt',
  platform: platform(),
  modelsDir: models.modelsDir()
}))
ipcMain.handle('system:hardware', () => llm.getHardware())
ipcMain.handle('system:revealModels', () => shell.openPath(models.modelsDir()))

// ---------- Dateisystem ----------

ipcMain.handle('fs:openFolder', async () => {
  const r = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
  return r.canceled ? null : r.filePaths[0]
})

ipcMain.handle('fs:readDir', async (_e, dir: string): Promise<DirEntry[]> => {
  const entries = await readdir(dir, { withFileTypes: true })
  return entries
    .filter((e) => !files.HIDDEN.has(e.name))
    .map((e) => ({ name: e.name, path: join(dir, e.name), isDir: e.isDirectory() }))
    .sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name))
})

ipcMain.handle('fs:openFile', (_e, path: string, forceText?: boolean) => files.openFile(path, forceText))
ipcMain.handle('fs:writeFile', (_e, path: string, content: string, encoding?: TextEncoding) =>
  files.saveFile(path, content, encoding)
)
ipcMain.handle('fs:openExternal', async (_e, path: string) => {
  const err = await shell.openPath(path)
  if (err) throw new Error(err)
})
ipcMain.handle('fs:createFile', (_e, path: string) => files.createFile(path))
ipcMain.handle('fs:createDir', (_e, path: string) => files.createDir(path))
ipcMain.handle('fs:rename', (_e, from: string, to: string) => files.rename(from, to))
// In den Papierkorb statt endgültig löschen
ipcMain.handle('fs:trash', (_e, path: string) => shell.trashItem(path))
ipcMain.handle('fs:reveal', (_e, path: string) => shell.showItemInFolder(path))
ipcMain.handle('fs:watch', (_e, dirs: string[]) => files.watchDirs(dirs, (dir) => send('fs:changed', dir)))

// ---------- Terminal ----------
ipcMain.handle('terminal:create', (_e, opts: TerminalCreateOptions) => terminal.create(opts, send))
ipcMain.handle('terminal:write', (_e, id: string, data: string) => terminal.write(id, data))
ipcMain.handle('terminal:resize', (_e, id: string, cols: number, rows: number) => terminal.resize(id, cols, rows))
ipcMain.handle('terminal:kill', (_e, id: string) => terminal.kill(id))
ipcMain.handle('terminal:list', () => terminal.list())

// ---------- Ports ----------
ipcMain.handle('ports:list', () => ports.refresh())
ipcMain.handle('ports:forward', (_e, port: number) => ports.forward(port, true))
ipcMain.handle('ports:unforward', (_e, port: number) => ports.unforward(port))
ipcMain.handle('ports:setProject', (_e, dir: string | null) => ports.setProject(dir))

// ---------- Devcontainer & Build ----------
ipcMain.handle('devcontainer:status', async (_e, root: string) => {
  const s = await devcontainer.status(root)
  // Weiterleitungen passend zum Container-Zustand halten
  void ports.setProject(root)
  return s
})
ipcMain.handle('devcontainer:options', () => ({ images: devcontainer.BASE_IMAGES, features: devcontainer.FEATURES }))
ipcMain.handle('devcontainer:suggest', (_e, root: string) => devcontainer.suggest(root))
ipcMain.handle('devcontainer:preview', (_e, t: DevcontainerTemplate) => JSON.stringify(devcontainer.templateFor(t), null, 2))
ipcMain.handle('devcontainer:create', (_e, root: string, t: DevcontainerTemplate) => devcontainer.create(root, t))
ipcMain.handle('devcontainer:up', async (_e, root: string, rebuild: boolean) => {
  send('devcontainer:changed', root)
  try {
    const r = await devcontainer.up(root, rebuild, (l) => send('devcontainer:log', l))
    await ports.containerStarted(root, r.containerId, r.forwardPorts)
    return r
  } finally {
    send('devcontainer:changed', root)
  }
})
ipcMain.handle('devcontainer:cancel', () => devcontainer.cancelUp())
ipcMain.handle('devcontainer:stop', async (_e, root: string) => {
  await devcontainer.stop(root)
  await ports.setProject(root)
  send('devcontainer:changed', root)
})
ipcMain.handle('devcontainer:remove', async (_e, root: string) => {
  await devcontainer.remove(root)
  await ports.setProject(root)
  send('devcontainer:changed', root)
})
// ---------- Updates ----------
ipcMain.handle('update:info', () => updater.info())
ipcMain.handle('update:state', () => updater.getState())
ipcMain.handle('update:check', () => updater.check(false))
ipcMain.handle('update:install', () => updater.install())
ipcMain.handle('update:restart', () => updater.restart())
ipcMain.handle('tasks:detect', (_e, root: string) => tasks.detect(root))

// ---------- Git / GitHub ----------
ipcMain.handle('git:status', (_e, dir: string) => git.status(dir))
ipcMain.handle('git:init', (_e, dir: string) => git.init(dir))
ipcMain.handle('git:commit', (_e, dir: string, message: string, paths: string[]) => git.commit(dir, message, paths))
ipcMain.handle('git:push', (_e, dir: string) => git.push(dir))
ipcMain.handle('git:pull', (_e, dir: string) => git.pull(dir))
ipcMain.handle('git:setRemote', (_e, dir: string, url: string) => git.setRemote(dir, url))
ipcMain.handle('git:setIdentity', (_e, dir: string, name: string, email: string) => git.setIdentity(dir, name, email))
ipcMain.handle('github:account', () => git.account())
ipcMain.handle('github:connect', (_e, token: string) => git.connect(token))
ipcMain.handle('github:disconnect', () => git.disconnect())
ipcMain.handle('github:storage', () => git.credentialStorage())
ipcMain.handle('github:publish', (_e, dir: string, name: string, isPrivate: boolean) => git.publish(dir, name, isPrivate))
ipcMain.handle('shell:openUrl', (_e, url: string) => {
  // Nur Web-Links öffnen – http nur für weitergeleitete Ports auf diesem Rechner
  if (/^https:\/\//.test(url) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(url)) return shell.openExternal(url)
})
ipcMain.handle('clipboard:write', (_e, text: string) => clipboard.writeText(text))

// ---------- Modelle ----------
ipcMain.handle('models:catalog', () => models.getCatalog())
ipcMain.handle('models:installed', () => models.listInstalled())
ipcMain.handle('models:download', (_e, id: string) => {
  // Nicht awaiten: Fortschritt kommt über Events
  void models.downloadModel(id, (p) => send('models:progress', p))
})
ipcMain.handle('models:cancelDownload', (_e, id: string) => models.cancelDownload(id))
ipcMain.handle('models:remove', async (_e, path: string) => {
  if (llm.getStatus().state === 'ready' && (llm.getStatus() as { modelPath: string }).modelPath === path) {
    await llm.unloadModel()
  }
  await models.removeModel(path)
})
ipcMain.handle('models:import', async () => {
  const r = await dialog.showOpenDialog({
    title: 'GGUF-Modell auswählen',
    properties: ['openFile'],
    filters: [{ name: 'GGUF-Modelle', extensions: ['gguf'] }]
  })
  if (r.canceled || !r.filePaths[0]) return false
  await models.importModel(r.filePaths[0])
  return true
})

// ---------- Sitzung (offener Ordner und Tabs) ----------
// Als Datei statt localStorage: wird sofort geschrieben und übersteht auch einen Absturz
const sessionFile = (): string => join(app.getPath('userData'), 'session.json')
ipcMain.handle('session:get', () => {
  try {
    return JSON.parse(readFileSync(sessionFile(), 'utf8'))
  } catch {
    return null
  }
})
ipcMain.handle('session:set', (_e, data: unknown) => {
  writeFileSync(sessionFile(), JSON.stringify(data, null, 2))
})

// ---------- Modell-Einstellungen ----------
ipcMain.handle('settings:get', () => settings.getSettings())
ipcMain.handle('settings:defaults', () => settings.DEFAULTS)
ipcMain.handle('settings:update', (_e, patch: Partial<ModelSettings>) => settings.updateSettings(patch))

// ---------- Engine ----------
ipcMain.handle('engine:status', () => llm.getStatus())
ipcMain.handle('engine:load', (_e, path: string) => {
  void llm.loadModel(path)
})
ipcMain.handle('engine:unload', () => llm.unloadModel())
ipcMain.handle('chat:send', async (_e, req: ChatRequest) => {
  try {
    const { changed } = await llm.chat(req, {
      onChunk: (chunk) => send('chat:chunk', chunk),
      onOpenFile: (file) => send('agent:openFile', file),
      onFileChanged: (path) => send('agent:fileChanged', path),
      onApproval: (approval) => send('agent:approval', approval)
    })
    return { ok: true, changed }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
})
ipcMain.handle('chat:stop', () => llm.stopChat())
ipcMain.handle('agent:answer', (_e, answer: ApprovalAnswer) => agent.answerApproval(answer))
ipcMain.handle('agent:revert', async (_e, requestId: string) => {
  const restored = await agent.revertRequest(requestId)
  for (const path of restored) send('agent:fileChanged', path)
  return restored.length
})
ipcMain.handle('chat:reset', () => llm.resetChat())

llm.onStatus((s) => send('engine:status', s))

// ---------- Menü ----------
// Eigenes Menü, damit Cmd+W den aktiven Tab schließt statt des ganzen Fensters
function buildMenu(): void {
  const mac = process.platform === 'darwin'
  const template: Electron.MenuItemConstructorOptions[] = [
    // Das App-Menü (Über, Beenden …) gibt es nur auf dem Mac; unter Linux steht „Beenden“ im Datei-Menü
    ...(mac ? [{ role: 'appMenu' as const }] : []),
    {
      label: 'Datei',
      submenu: [
        { label: 'Tab schließen', accelerator: 'CmdOrCtrl+W', click: () => send('menu:closeTab', null) },
        { label: 'Fenster schließen', accelerator: 'CmdOrCtrl+Shift+W', role: 'close' },
        ...(mac ? [] : [{ type: 'separator' as const }, { label: 'Beenden', accelerator: 'Ctrl+Q', role: 'quit' as const }])
      ]
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    {
      label: 'Terminal',
      submenu: [
        { label: 'Neues Terminal', accelerator: 'Ctrl+Shift+`', click: () => send('menu:newTerminal', null) },
        { label: 'Terminal ein-/ausblenden', accelerator: 'Ctrl+`', click: () => send('menu:toggleTerminal', null) }
      ]
    },
    {
      label: 'Fenster',
      role: 'window',
      submenu: mac ? [{ role: 'minimize' }, { role: 'zoom' }, { type: 'separator' }, { role: 'front' }] : [{ role: 'minimize' }, { role: 'togglefullscreen' }]
    },
    {
      label: 'Hilfe',
      role: 'help',
      submenu: [
        { label: 'Nach Updates suchen …', click: () => send('menu:checkUpdates', null) },
        { type: 'separator' },
        {
          label: 'Open-Source-Lizenzen',
          click: () => {
            // Im fertigen App-Bundle liegt die Datei in Resources, beim Entwickeln im Projektordner
            const file = app.isPackaged
              ? join(process.resourcesPath, 'THIRD_PARTY_LICENSES.txt')
              : join(app.getAppPath(), 'THIRD_PARTY_LICENSES.txt')
            void shell.openPath(file)
          }
        },
        { label: 'Quellcode von llama.cpp', click: () => void shell.openExternal('https://github.com/ggml-org/llama.cpp') },
        { label: 'Quellcode von node-llama-cpp', click: () => void shell.openExternal('https://github.com/withcatai/node-llama-cpp') }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(() => {
  files.handleScheme()
  buildMenu()
  createWindow()
  ports.start(send)
  updater.start(send)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  terminal.killAll()
  ports.stopPolling()
  void llm.unloadModel()
})
