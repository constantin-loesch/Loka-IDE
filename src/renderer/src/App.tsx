import { useCallback, useEffect, useRef, useState } from 'react'
import { editor as monacoEditor, type editor } from 'monaco-editor'
import type { DevcontainerStatus, EngineStatus, OpenedFile, PortInfo, TerminalInfo, TerminalTarget } from '../../shared/types'
import { modelUri } from './fileLanguage'
import FileTree, { type FileTreeHandle } from './components/FileTree'
import BottomPanel, { type PanelTab } from './components/BottomPanel'
import ContainerPanel from './components/ContainerPanel'
import { disposeTerminal, focusTerminal } from './components/TerminalView'
import { useUpdates } from './components/UpdateNotice'
import EditorArea, { type Tab } from './components/EditorArea'
import ChatPanel, { type EditorContext } from './components/ChatPanel'
import ModelManager from './components/ModelManager'
import GitPanel from './components/GitPanel'
import { Icon } from './components/Icon'
import { locale, t } from './i18n'

const MODELS_TAB = '__models__'

function fileTab(path: string, f: OpenedFile): Tab {
  const base = { id: path, path, title: path.split('/').pop() ?? path }
  switch (f.kind) {
    case 'text':
      return { ...base, kind: 'file', content: f.content, encoding: f.encoding, dirty: false }
    case 'media':
      return { ...base, kind: 'media', media: f.media, url: f.url, size: f.size }
    case 'binary':
      return { ...base, kind: 'binary', reason: f.reason, size: f.size }
  }
}

/** What gets restored on the next start. */
interface SavedSession {
  root: string | null
  /** Paths of the open file tabs in their order */
  files: string[]
  active: string | null
  modelsTab: boolean
}

async function loadSession(): Promise<SavedSession | null> {
  const s = (await window.api.session.get().catch(() => null)) as SavedSession | null
  return s && Array.isArray(s.files) ? s : null
}

function saveSession(s: SavedSession): void {
  // Saving is only a convenience – ignore errors
  window.api.session.set(s).catch(() => undefined)
}

export default function App(): React.JSX.Element {
  const [root, setRoot] = useState<string | null>(null)
  const [tabs, setTabs] = useState<Tab[]>([{ id: MODELS_TAB, title: t('Models'), kind: 'models' }])
  const [activeId, setActiveId] = useState<string>(MODELS_TAB)
  const [sidebar, setSidebar] = useState<'explorer' | 'git' | 'container' | null>('explorer')
  const treeRef = useRef<FileTreeHandle>(null)

  // Bottom panel: terminal, ports, output
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelTab, setPanelTab] = useState<PanelTab>('terminal')
  const [panelHeight, setPanelHeight] = useState(() => Number(localStorage.getItem('panelHeight')) || 260)
  const [terminals, setTerminals] = useState<TerminalInfo[]>([])
  const [activeTerminal, setActiveTerminal] = useState<string | null>(null)
  const [ports, setPorts] = useState<PortInfo[]>([])
  const [dcStatus, setDcStatus] = useState<DevcontainerStatus | null>(null)
  const [output, setOutput] = useState('')
  const updates = useUpdates()
  const [chatOpen, setChatOpen] = useState(true)
  const [status, setStatus] = useState<EngineStatus>({ state: 'idle' })
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  // Only save once the last session is restored – otherwise it would be overwritten
  const [restored, setRestored] = useState(false)

  useEffect(() => {
    window.api.engine.status().then(setStatus)
    return window.api.engine.onStatus(setStatus)
  }, [])

  // Ports: the list comes from the main process whenever something changes
  useEffect(() => {
    void window.api.ports.list().then(setPorts)
    return window.api.ports.onChanged(setPorts)
  }, [])

  // Dev container state of the opened project
  const refreshDc = useCallback(() => {
    if (!root) {
      setDcStatus(null)
      void window.api.ports.setProject(null)
      return
    }
    window.api.devcontainer.status(root).then(setDcStatus, () => setDcStatus(null))
  }, [root])
  useEffect(refreshDc, [refreshDc])
  useEffect(() => window.api.devcontainer.onChanged(() => refreshDc()), [refreshDc])
  useEffect(
    () =>
      window.api.devcontainer.onLog((l) => {
        // Remove the CLI's color codes, limit the length
        setOutput((prev) => (prev + l.text.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')).slice(-200_000))
      }),
    []
  )

  // Terminal ended (e.g. with “exit”): take it off the list
  useEffect(
    () =>
      window.api.terminal.onExit(({ id }) => {
        setTerminals((prev) => prev.filter((t) => t.id !== id))
        setTimeout(() => disposeTerminal(id), 0)
      }),
    []
  )
  useEffect(() => {
    if (activeTerminal && !terminals.some((t) => t.id === activeTerminal)) setActiveTerminal(terminals[terminals.length - 1]?.id ?? null)
  }, [terminals, activeTerminal])

  // Window title (visible in the window frame on Linux)
  useEffect(() => {
    document.title = root ? `${root.split('/').pop()} – Lokal IDE` : 'Lokal IDE'
  }, [root])

  // On start: restore the last opened folder and files
  useEffect(() => {
    void (async () => {
      const saved = await loadSession()
      if (!saved) {
        setRestored(true)
        return
      }
      if (saved.root) {
        // Only restore if the folder still exists
        const exists = await window.api.fs.readDir(saved.root).then(() => true, () => false)
        if (exists) setRoot(saved.root)
      }
      const reopened: Tab[] = []
      for (const path of saved.files) {
        // Silently skip deleted or moved files
        const opened = await window.api.fs.openFile(path).catch(() => null)
        if (opened) reopened.push(fileTab(path, opened))
      }
      const next: Tab[] = [...(saved.modelsTab ? [{ id: MODELS_TAB, title: t('Models'), kind: 'models' as const }] : []), ...reopened]
      setTabs(next)
      const active = next.find((t) => t.id === saved.active) ?? next[next.length - 1]
      setActiveId(active?.id ?? '')
      setRestored(true)
    })()
  }, [])

  // Remember open tabs whenever something changes
  useEffect(() => {
    if (!restored) return
    saveSession({
      root,
      files: tabs.flatMap((t) => ('path' in t ? [t.path] : [])),
      active: activeId || null,
      modelsTab: tabs.some((t) => t.kind === 'models')
    })
  }, [restored, root, tabs, activeId])

  const openFolder = async (): Promise<void> => {
    const dir = await window.api.fs.openFolder()
    if (dir) {
      setRoot(dir)
      setSidebar((v) => v ?? 'explorer')
    }
  }

  const openFile = async (path: string): Promise<void> => {
    if (!tabs.some((t) => t.id === path)) {
      try {
        const opened = await window.api.fs.openFile(path)
        // A double click can open twice – only create one tab
        setTabs((prev) => (prev.some((t) => t.id === path) ? prev : [...prev, fileTab(path, opened)]))
      } catch (err) {
        alert(`${t('The file could not be opened:')}\n${err}`)
        return
      }
    }
    setActiveId(path)
  }

  const newTerminal = async (target: TerminalTarget, opts: { command?: string; title?: string; cwd?: string } = {}): Promise<void> => {
    if (!root) return
    try {
      const info = await window.api.terminal.create({
        // In the container always from the project folder – that's where the CLI looks for devcontainer.json
        cwd: target === 'container' ? root : (opts.cwd ?? root),
        target,
        command: opts.command,
        title: opts.title
      })
      setTerminals((prev) => [...prev, info])
      setActiveTerminal(info.id)
      setPanelTab('terminal')
      setPanelOpen(true)
    } catch (err) {
      alert(`${t('The terminal could not be started:')}\n${String(err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')}`)
    }
  }

  const killTerminal = (id: string): void => {
    void window.api.terminal.kill(id)
    setTerminals((prev) => prev.filter((t) => t.id !== id))
    setTimeout(() => disposeTerminal(id), 0)
  }

  const togglePanel = (): void => {
    // Start a terminal right away on first open
    if (!panelOpen && terminals.length === 0 && root && panelTab === 'terminal') void newTerminal('local')
    setPanelOpen(!panelOpen)
  }

  /** The explorer renamed/moved something: switch open tabs to the new path. */
  const handleRenamed = (from: string, to: string): void => {
    const moved = (p: string): string | null => (p === from ? to : p.startsWith(from + '/') ? to + p.slice(from.length) : null)
    setTabs((prev) =>
      prev.map((t) => {
        if (!('path' in t)) return t
        const next = moved(t.path)
        if (!next) return t
        if (t.kind === 'file') {
          // Take unsaved content over from the old Monaco model
          const model = monacoEditor.getModel(modelUri(t.path))
          const content = t.dirty && model ? model.getValue() : t.content
          model?.dispose()
          return { ...t, id: next, path: next, title: next.split('/').pop() ?? next, content }
        }
        return { ...t, id: next, path: next, title: next.split('/').pop() ?? next }
      })
    )
    setActiveId((id) => moved(id) ?? id)
  }

  /** The explorer moved something to the trash: close its tabs (unsaved ones stay open). */
  const handleDeleted = (path: string): void => {
    const gone = (p: string): boolean => p === path || p.startsWith(path + '/')
    setTabs((prev) =>
      prev.filter((t) => {
        if (!('path' in t) || !gone(t.path)) return true
        if (t.kind === 'file' && t.dirty) return true
        if (t.kind === 'file') monacoEditor.getModel(modelUri(t.path))?.dispose()
        return false
      })
    )
  }

  const startResize = (e: React.MouseEvent): void => {
    e.preventDefault()
    const startY = e.clientY
    const startH = panelHeight
    let h = startH
    const move = (ev: MouseEvent): void => {
      h = Math.min(Math.max(startY - ev.clientY + startH, 100), window.innerHeight - 180)
      setPanelHeight(h)
    }
    const up = (): void => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      document.body.classList.remove('resizing')
      localStorage.setItem('panelHeight', String(Math.round(h)))
    }
    document.body.classList.add('resizing')
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  const openModels = (): void => {
    if (!tabs.some((t) => t.id === MODELS_TAB)) {
      setTabs((prev) => [...prev, { id: MODELS_TAB, title: t('Models'), kind: 'models' }])
    }
    setActiveId(MODELS_TAB)
  }

  const closeTab = (id: string): void => {
    const tab = tabs.find((t) => t.id === id)
    if (tab?.kind === 'file' && tab.dirty && !confirm(t('“{name}” has unsaved changes. Close anyway?', { name: tab.title }))) {
      return
    }
    // Release the Monaco model, otherwise discarded changes reappear when reopening
    if (tab?.kind === 'file') monacoEditor.getModel(modelUri(tab.path))?.dispose()
    const idx = tabs.findIndex((t) => t.id === id)
    const next = tabs.filter((t) => t.id !== id)
    setTabs(next)
    if (activeId === id) setActiveId(next[Math.max(0, idx - 1)]?.id ?? '')
  }

  /** Opens a binary or media file as text in the same tab. */
  const openAsText = async (id: string): Promise<void> => {
    const tab = tabs.find((t) => t.id === id)
    if (!tab || !('path' in tab)) return
    try {
      const opened = await window.api.fs.openFile(tab.path, true)
      setTabs((prev) => prev.map((t) => (t.id === id ? fileTab(tab.path, opened) : t)))
    } catch (err) {
      alert(`${t('The file could not be opened:')}\n${err}`)
    }
  }

  // In agent mode the model can open files and jump to a line
  const openFileRef = useRef(openFile)
  openFileRef.current = openFile
  useEffect(
    () =>
      window.api.agent.onOpenFile(async ({ path, line }) => {
        await openFileRef.current(path)
        // Wait until the editor shows the file's model
        setTimeout(() => {
          const ed = editorRef.current
          if (!ed) return
          ed.revealLineInCenter(line)
          ed.setPosition({ lineNumber: line, column: 1 })
        }, 150)
      }),
    []
  )

  // The agent changed a file: update the open tab (can be undone with Cmd+Z)
  const tabsRef = useRef(tabs)
  tabsRef.current = tabs
  useEffect(
    () =>
      window.api.agent.onFileChanged(async (path) => {
        const tab = tabsRef.current.find((t) => t.id === path)
        if (!tab || tab.kind !== 'file' || tab.dirty) return
        const opened = await window.api.fs.openFile(path).catch(() => null)
        if (!opened || opened.kind !== 'text') return
        const model = monacoEditor.getModel(modelUri(path))
        if (model && model.getValue() !== opened.content) {
          model.pushStackElement()
          model.pushEditOperations([], [{ range: model.getFullModelRange(), text: opened.content }], () => null)
          model.pushStackElement()
        }
        // Content matches the file on disk again
        setTabs((prev) => prev.map((t) => (t.id === path && t.kind === 'file' ? { ...t, content: opened.content, dirty: false } : t)))
      }),
    []
  )

  // Cmd+W from the app menu closes the active tab
  const closeActiveRef = useRef<() => void>(() => {})
  closeActiveRef.current = () => {
    if (tabs.some((t) => t.id === activeId)) closeTab(activeId)
  }
  useEffect(() => window.api.menu.onCloseTab(() => closeActiveRef.current()), [])

  // Terminal menu: Ctrl+` toggles, Ctrl+Shift+` opens a new terminal
  const menuRef = useRef({ toggle: togglePanel, create: () => void newTerminal('local') })
  menuRef.current = { toggle: togglePanel, create: () => void newTerminal('local') }
  useEffect(() => {
    const a = window.api.menu.onToggleTerminal(() => menuRef.current.toggle())
    const b = window.api.menu.onNewTerminal(() => menuRef.current.create())
    return () => {
      a()
      b()
    }
  }, [])
  useEffect(() => {
    if (panelOpen && panelTab === 'terminal' && activeTerminal) focusTerminal(activeTerminal)
  }, [panelOpen, panelTab, activeTerminal])

  const updateTab = useCallback((id: string, patch: Partial<Tab>) => {
    setTabs((prev) => prev.map((t) => (t.id === id ? ({ ...t, ...patch } as Tab) : t)))
  }, [])

  const activeTab = tabs.find((t) => t.id === activeId)

  /** Gives the chat panel the current file and selection context. */
  const getEditorContext = (): EditorContext | null => {
    const ed = editorRef.current
    if (!ed || activeTab?.kind !== 'file') return null
    const model = ed.getModel()
    const sel = ed.getSelection()
    if (!model) return null
    return {
      fileName: activeTab.title,
      language: model.getLanguageId(),
      content: model.getValue(),
      selection: sel && !sel.isEmpty() ? model.getValueInRange(sel) : ''
    }
  }

  /** Inserts code from the chat at the cursor (or replaces the selection). */
  const insertIntoEditor = (code: string): void => {
    const ed = editorRef.current
    if (!ed || activeTab?.kind !== 'file') {
      alert(t('Open a file first to insert code.'))
      return
    }
    const sel = ed.getSelection()
    if (!sel) return
    ed.executeEdits('ki-chat', [{ range: sel, text: code, forceMoveMarkers: true }])
    ed.focus()
  }

  return (
    <div className="app">
      {/* Own title bar only on the Mac – on Linux the normal window frame shows the title */}
      {window.api.platform === 'darwin' && (
        <div className="titlebar">
          <span className="titlebar-name">{root ? root.split('/').pop() : 'Lokal IDE'}</span>
        </div>
      )}

      <div className="workbench">
        <nav className="activitybar">
          <button
            className={sidebar === 'explorer' ? 'active' : ''}
            title="Explorer"
            onClick={() => setSidebar((v) => (v === 'explorer' ? null : 'explorer'))}
          >
            <Icon name="files" />
          </button>
          <button
            className={sidebar === 'git' ? 'active' : ''}
            title={t('Source Control (Git)')}
            onClick={() => setSidebar((v) => (v === 'git' ? null : 'git'))}
          >
            <Icon name="git" />
          </button>
          <button
            className={sidebar === 'container' ? 'active' : ''}
            title={t('Dev Container & Build')}
            onClick={() => setSidebar((v) => (v === 'container' ? null : 'container'))}
          >
            <Icon name="container" />
          </button>
          <button className={panelOpen ? 'active' : ''} title={t('Terminal (⌃`)')} onClick={togglePanel}>
            <Icon name="terminal" />
          </button>
          <button className={activeTab?.kind === 'models' ? 'active' : ''} title={t('Models')} onClick={openModels}>
            <Icon name="chip" />
          </button>
          <button className={chatOpen ? 'active' : ''} title={t('AI Chat')} onClick={() => setChatOpen((v) => !v)}>
            <Icon name="chat" />
          </button>
        </nav>

        {sidebar === 'git' && (
          <aside className="sidebar">
            <div className="panel-header">
              <span>{t('Source Control')}</span>
            </div>
            <GitPanel root={root} onOpenFolder={openFolder} onOpenFile={openFile} />
          </aside>
        )}

        {sidebar === 'container' && (
          <aside className="sidebar">
            <div className="panel-header">
              <span>{t('Container & Build')}</span>
            </div>
            <ContainerPanel
              root={root}
              status={dcStatus}
              onRefreshStatus={refreshDc}
              onOpenFolder={openFolder}
              onOpenFile={openFile}
              onRun={(command, target, title) => void newTerminal(target, { command, title })}
              onNewTerminal={(target) => void newTerminal(target)}
              onShowOutput={() => {
                setPanelTab('output')
                setPanelOpen(true)
              }}
            />
          </aside>
        )}

        {sidebar === 'explorer' && (
          <aside className="sidebar">
            <div className="panel-header">
              <span>Explorer</span>
              <div className="header-actions">
                {root && (
                  <>
                    <button className="icon-btn" title={t('New File …')} onClick={() => treeRef.current?.newFile()}>
                      <Icon name="new-file" size={16} />
                    </button>
                    <button className="icon-btn" title={t('New Folder …')} onClick={() => treeRef.current?.newFolder()}>
                      <Icon name="new-folder" size={16} />
                    </button>
                    <button className="icon-btn" title={t('Refresh Explorer')} onClick={() => treeRef.current?.refresh()}>
                      <Icon name="refresh" size={15} />
                    </button>
                    <button className="icon-btn" title={t('Collapse All')} onClick={() => treeRef.current?.collapseAll()}>
                      <Icon name="collapse" size={15} />
                    </button>
                  </>
                )}
                <button className="icon-btn" title={t('Open Folder')} onClick={openFolder}>
                  <Icon name="folder-open" size={16} />
                </button>
              </div>
            </div>
            {root ? (
              <FileTree
                key={root}
                ref={treeRef}
                root={root}
                activePath={activeTab && 'path' in activeTab ? activeTab.path : undefined}
                onOpen={openFile}
                onRenamed={handleRenamed}
                onDeleted={handleDeleted}
                onOpenTerminal={(dir) => void newTerminal('local', { cwd: dir })}
              />
            ) : (
              <div className="empty-hint">
                <p>{t('No folder open.')}</p>
                <button className="btn primary" onClick={openFolder}>
                  {t('Open Folder')}
                </button>
              </div>
            )}
          </aside>
        )}

        <main className="editor-column">
          <EditorArea
            tabs={tabs}
            activeId={activeId}
            onSelect={setActiveId}
            onClose={closeTab}
            onUpdate={updateTab}
            onOpenAsText={openAsText}
            editorRef={editorRef}
            renderModels={() => <ModelManager status={status} />}
          />
          {/* Stays mounted so terminals keep running while hidden */}
          <div className="bottom-wrap" style={{ height: panelHeight, display: panelOpen ? 'flex' : 'none' }}>
            <div className="panel-resizer" onMouseDown={startResize} />
            <BottomPanel
              tab={panelTab}
              onTab={setPanelTab}
              terminals={terminals}
              activeTerminal={activeTerminal}
              onSelectTerminal={setActiveTerminal}
              onNewTerminal={(t) => void newTerminal(t)}
              onKillTerminal={killTerminal}
              containerRunning={dcStatus?.state === 'running'}
              ports={ports}
              output={output}
              onClearOutput={() => setOutput('')}
              onClose={() => setPanelOpen(false)}
              hasRoot={!!root}
              visible={panelOpen}
            />
          </div>
        </main>

        {chatOpen && (
          <ChatPanel
            status={status}
            root={root}
            isDirty={(path) => tabs.some((t) => t.kind === 'file' && t.path === path && t.dirty)}
            getEditorContext={getEditorContext}
            onInsert={insertIntoEditor}
            onOpenModels={openModels}
          />
        )}
      </div>

      <footer className="statusbar">
        <StatusText status={status} onClick={openModels} />
        {dcStatus?.configPath && (
          <button className={`status-item ${dcStatus.state}`} onClick={() => setSidebar('container')} title={t('Dev container')}>
            <Icon name="container" size={13} />
            {dcStatus.state === 'running' ? t('Container running') : dcStatus.state === 'starting' ? t('Container starting …') : t('Container off')}
          </button>
        )}
        <button
          className="status-item"
          onClick={() => {
            setPanelTab('ports')
            setPanelOpen(true)
          }}
          title={t('Forwarded and detected ports')}
        >
          <Icon name="plug" size={13} /> {ports.length === 1 ? t('1 port') : t('{count} ports', { count: ports.length })}
        </button>
        <span className="spacer" />
        {updates.statusItem}
        {activeTab?.kind === 'file' && <span>{activeTab.dirty ? '● ' + t('Unsaved') : t('Saved')}</span>}
      </footer>
      {updates.notice}
    </div>
  )
}

function StatusText({ status, onClick }: { status: EngineStatus; onClick: () => void }): React.JSX.Element {
  let text: string
  let cls = ''
  switch (status.state) {
    case 'idle':
      text = t('No model loaded')
      break
    case 'loading':
      text = t('Loading model … {percent} %', { percent: Math.round(status.progress * 100) })
      cls = 'busy'
      break
    case 'ready':
      text = `${status.modelName} · ${status.gpu.toUpperCase()} · ${t('{count} tokens', { count: status.contextSize.toLocaleString(locale) })}`
      cls = 'ok'
      break
    case 'error':
      text = t('Error: {message}', { message: status.message })
      cls = 'err'
      break
  }
  return (
    <button className={`status-model ${cls}`} onClick={onClick} title={t('Manage models')}>
      <span className="dot" /> {text}
    </button>
  )
}
