import { useCallback, useEffect, useRef, useState } from 'react'
import { editor as monacoEditor, type editor } from 'monaco-editor'
import type { DevcontainerStatus, EngineStatus, OpenedFile, PortInfo, TerminalInfo, TerminalTarget } from '../../shared/types'
import { modelUri } from './fileLanguage'
import FileTree, { type FileTreeHandle } from './components/FileTree'
import BottomPanel, { type PanelTab } from './components/BottomPanel'
import ContainerPanel from './components/ContainerPanel'
import { disposeTerminal, focusTerminal } from './components/TerminalView'
import EditorArea, { type Tab } from './components/EditorArea'
import ChatPanel, { type EditorContext } from './components/ChatPanel'
import ModelManager from './components/ModelManager'
import GitPanel from './components/GitPanel'
import { Icon } from './components/Icon'

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

/** Was beim nächsten Start wiederhergestellt wird. */
interface SavedSession {
  root: string | null
  /** Pfade der offenen Datei-Tabs in ihrer Reihenfolge */
  files: string[]
  active: string | null
  modelsTab: boolean
}

async function loadSession(): Promise<SavedSession | null> {
  const s = (await window.api.session.get().catch(() => null)) as SavedSession | null
  return s && Array.isArray(s.files) ? s : null
}

function saveSession(s: SavedSession): void {
  // Speichern ist nur Komfort – Fehler ignorieren
  window.api.session.set(s).catch(() => undefined)
}

export default function App(): React.JSX.Element {
  const [root, setRoot] = useState<string | null>(null)
  const [tabs, setTabs] = useState<Tab[]>([{ id: MODELS_TAB, title: 'Modelle', kind: 'models' }])
  const [activeId, setActiveId] = useState<string>(MODELS_TAB)
  const [sidebar, setSidebar] = useState<'explorer' | 'git' | 'container' | null>('explorer')
  const treeRef = useRef<FileTreeHandle>(null)

  // Unterer Bereich: Terminal, Ports, Ausgabe
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelTab, setPanelTab] = useState<PanelTab>('terminal')
  const [panelHeight, setPanelHeight] = useState(() => Number(localStorage.getItem('panelHeight')) || 260)
  const [terminals, setTerminals] = useState<TerminalInfo[]>([])
  const [activeTerminal, setActiveTerminal] = useState<string | null>(null)
  const [ports, setPorts] = useState<PortInfo[]>([])
  const [dcStatus, setDcStatus] = useState<DevcontainerStatus | null>(null)
  const [output, setOutput] = useState('')
  const [chatOpen, setChatOpen] = useState(true)
  const [status, setStatus] = useState<EngineStatus>({ state: 'idle' })
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  // Erst speichern, wenn die letzte Sitzung wiederhergestellt ist – sonst würde sie überschrieben
  const [restored, setRestored] = useState(false)

  useEffect(() => {
    window.api.engine.status().then(setStatus)
    return window.api.engine.onStatus(setStatus)
  }, [])

  // Ports: Liste kommt vom Hauptprozess, sobald sich etwas ändert
  useEffect(() => {
    void window.api.ports.list().then(setPorts)
    return window.api.ports.onChanged(setPorts)
  }, [])

  // Devcontainer-Zustand des geöffneten Projekts
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
        // Farbcodes der CLI entfernen, Länge begrenzen
        setOutput((prev) => (prev + l.text.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')).slice(-200_000))
      }),
    []
  )

  // Terminal beendet (z. B. mit „exit“): aus der Liste nehmen
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

  // Fenstertitel (unter Linux im Fensterrahmen sichtbar)
  useEffect(() => {
    document.title = root ? `${root.split('/').pop()} – Lokal IDE` : 'Lokal IDE'
  }, [root])

  // Beim Start: zuletzt geöffneten Ordner und Dateien wiederherstellen
  useEffect(() => {
    void (async () => {
      const saved = await loadSession()
      if (!saved) {
        setRestored(true)
        return
      }
      if (saved.root) {
        // Nur wiederherstellen, wenn es den Ordner noch gibt
        const exists = await window.api.fs.readDir(saved.root).then(() => true, () => false)
        if (exists) setRoot(saved.root)
      }
      const reopened: Tab[] = []
      for (const path of saved.files) {
        // Gelöschte oder verschobene Dateien still überspringen
        const opened = await window.api.fs.openFile(path).catch(() => null)
        if (opened) reopened.push(fileTab(path, opened))
      }
      const next: Tab[] = [...(saved.modelsTab ? [{ id: MODELS_TAB, title: 'Modelle', kind: 'models' as const }] : []), ...reopened]
      setTabs(next)
      const active = next.find((t) => t.id === saved.active) ?? next[next.length - 1]
      setActiveId(active?.id ?? '')
      setRestored(true)
    })()
  }, [])

  // Offene Tabs merken, sobald sich etwas ändert
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
        // Doppelklick kann zweimal öffnen – nur einen Tab anlegen
        setTabs((prev) => (prev.some((t) => t.id === path) ? prev : [...prev, fileTab(path, opened)]))
      } catch (err) {
        alert(`Datei konnte nicht geöffnet werden:\n${err}`)
        return
      }
    }
    setActiveId(path)
  }

  const newTerminal = async (target: TerminalTarget, opts: { command?: string; title?: string; cwd?: string } = {}): Promise<void> => {
    if (!root) return
    try {
      const info = await window.api.terminal.create({
        // Im Container immer vom Projektordner aus – dort sucht die CLI die devcontainer.json
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
      alert(`Terminal konnte nicht gestartet werden:\n${String(err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')}`)
    }
  }

  const killTerminal = (id: string): void => {
    void window.api.terminal.kill(id)
    setTerminals((prev) => prev.filter((t) => t.id !== id))
    setTimeout(() => disposeTerminal(id), 0)
  }

  const togglePanel = (): void => {
    // Beim ersten Öffnen gleich ein Terminal starten
    if (!panelOpen && terminals.length === 0 && root && panelTab === 'terminal') void newTerminal('local')
    setPanelOpen(!panelOpen)
  }

  /** Explorer hat umbenannt/verschoben: offene Tabs auf den neuen Pfad umstellen. */
  const handleRenamed = (from: string, to: string): void => {
    const moved = (p: string): string | null => (p === from ? to : p.startsWith(from + '/') ? to + p.slice(from.length) : null)
    setTabs((prev) =>
      prev.map((t) => {
        if (!('path' in t)) return t
        const next = moved(t.path)
        if (!next) return t
        if (t.kind === 'file') {
          // Ungespeicherten Inhalt aus dem alten Monaco-Modell mitnehmen
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

  /** Explorer hat in den Papierkorb verschoben: zugehörige Tabs schließen (ungespeicherte bleiben offen). */
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
      setTabs((prev) => [...prev, { id: MODELS_TAB, title: 'Modelle', kind: 'models' }])
    }
    setActiveId(MODELS_TAB)
  }

  const closeTab = (id: string): void => {
    const tab = tabs.find((t) => t.id === id)
    if (tab?.kind === 'file' && tab.dirty && !confirm(`„${tab.title}“ hat ungespeicherte Änderungen. Trotzdem schließen?`)) {
      return
    }
    // Monaco-Modell freigeben, sonst tauchen verworfene Änderungen beim erneuten Öffnen wieder auf
    if (tab?.kind === 'file') monacoEditor.getModel(modelUri(tab.path))?.dispose()
    const idx = tabs.findIndex((t) => t.id === id)
    const next = tabs.filter((t) => t.id !== id)
    setTabs(next)
    if (activeId === id) setActiveId(next[Math.max(0, idx - 1)]?.id ?? '')
  }

  /** Öffnet eine Binär- oder Mediendatei im selben Tab als Text. */
  const openAsText = async (id: string): Promise<void> => {
    const tab = tabs.find((t) => t.id === id)
    if (!tab || !('path' in tab)) return
    try {
      const opened = await window.api.fs.openFile(tab.path, true)
      setTabs((prev) => prev.map((t) => (t.id === id ? fileTab(tab.path, opened) : t)))
    } catch (err) {
      alert(`Datei konnte nicht geöffnet werden:\n${err}`)
    }
  }

  // Das Modell kann im Agent-Modus Dateien öffnen und zu einer Zeile springen
  const openFileRef = useRef(openFile)
  openFileRef.current = openFile
  useEffect(
    () =>
      window.api.agent.onOpenFile(async ({ path, line }) => {
        await openFileRef.current(path)
        // Warten, bis der Editor das Modell der Datei angezeigt hat
        setTimeout(() => {
          const ed = editorRef.current
          if (!ed) return
          ed.revealLineInCenter(line)
          ed.setPosition({ lineNumber: line, column: 1 })
        }, 150)
      }),
    []
  )

  // Der Agent hat eine Datei geändert: offenen Tab aktualisieren (mit Cmd+Z rückgängig zu machen)
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
        // Inhalt entspricht wieder der Datei auf der Festplatte
        setTabs((prev) => prev.map((t) => (t.id === path && t.kind === 'file' ? { ...t, content: opened.content, dirty: false } : t)))
      }),
    []
  )

  // Cmd+W aus dem App-Menü schließt den aktiven Tab
  const closeActiveRef = useRef<() => void>(() => {})
  closeActiveRef.current = () => {
    if (tabs.some((t) => t.id === activeId)) closeTab(activeId)
  }
  useEffect(() => window.api.menu.onCloseTab(() => closeActiveRef.current()), [])

  // Terminal-Menü: Ctrl+` blendet ein/aus, Ctrl+Shift+` öffnet ein neues Terminal
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

  /** Liefert der Chat-Leiste den aktuellen Datei- und Auswahl-Kontext. */
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

  /** Fügt Code aus dem Chat an der Cursor-Position ein (oder ersetzt die Auswahl). */
  const insertIntoEditor = (code: string): void => {
    const ed = editorRef.current
    if (!ed || activeTab?.kind !== 'file') {
      alert('Öffne zuerst eine Datei, um Code einzufügen.')
      return
    }
    const sel = ed.getSelection()
    if (!sel) return
    ed.executeEdits('ki-chat', [{ range: sel, text: code, forceMoveMarkers: true }])
    ed.focus()
  }

  return (
    <div className="app">
      {/* Eigene Titelleiste nur auf dem Mac – unter Linux zeigt der normale Fensterrahmen den Titel */}
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
            title="Quellcodeverwaltung (Git)"
            onClick={() => setSidebar((v) => (v === 'git' ? null : 'git'))}
          >
            <Icon name="git" />
          </button>
          <button
            className={sidebar === 'container' ? 'active' : ''}
            title="Devcontainer & Build"
            onClick={() => setSidebar((v) => (v === 'container' ? null : 'container'))}
          >
            <Icon name="container" />
          </button>
          <button className={panelOpen ? 'active' : ''} title="Terminal (⌃`)" onClick={togglePanel}>
            <Icon name="terminal" />
          </button>
          <button className={activeTab?.kind === 'models' ? 'active' : ''} title="Modelle" onClick={openModels}>
            <Icon name="chip" />
          </button>
          <button className={chatOpen ? 'active' : ''} title="KI-Chat" onClick={() => setChatOpen((v) => !v)}>
            <Icon name="chat" />
          </button>
        </nav>

        {sidebar === 'git' && (
          <aside className="sidebar">
            <div className="panel-header">
              <span>Quellcode</span>
            </div>
            <GitPanel root={root} onOpenFolder={openFolder} onOpenFile={openFile} />
          </aside>
        )}

        {sidebar === 'container' && (
          <aside className="sidebar">
            <div className="panel-header">
              <span>Container &amp; Build</span>
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
                    <button className="icon-btn" title="Neue Datei …" onClick={() => treeRef.current?.newFile()}>
                      <Icon name="new-file" size={16} />
                    </button>
                    <button className="icon-btn" title="Neuer Ordner …" onClick={() => treeRef.current?.newFolder()}>
                      <Icon name="new-folder" size={16} />
                    </button>
                    <button className="icon-btn" title="Explorer aktualisieren" onClick={() => treeRef.current?.refresh()}>
                      <Icon name="refresh" size={15} />
                    </button>
                    <button className="icon-btn" title="Alle zuklappen" onClick={() => treeRef.current?.collapseAll()}>
                      <Icon name="collapse" size={15} />
                    </button>
                  </>
                )}
                <button className="icon-btn" title="Ordner öffnen" onClick={openFolder}>
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
                <p>Kein Ordner geöffnet.</p>
                <button className="btn primary" onClick={openFolder}>
                  Ordner öffnen
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
          {/* Bleibt eingehängt, damit Terminals beim Ausblenden weiterlaufen */}
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
          <button className={`status-item ${dcStatus.state}`} onClick={() => setSidebar('container')} title="Devcontainer">
            <Icon name="container" size={13} />
            {dcStatus.state === 'running' ? 'Container läuft' : dcStatus.state === 'starting' ? 'Container startet …' : 'Container aus'}
          </button>
        )}
        <button
          className="status-item"
          onClick={() => {
            setPanelTab('ports')
            setPanelOpen(true)
          }}
          title="Weitergeleitete und erkannte Ports"
        >
          <Icon name="plug" size={13} /> {ports.length} {ports.length === 1 ? 'Port' : 'Ports'}
        </button>
        <span className="spacer" />
        {activeTab?.kind === 'file' && <span>{activeTab.dirty ? '● Ungespeichert' : 'Gespeichert'}</span>}
      </footer>
    </div>
  )
}

function StatusText({ status, onClick }: { status: EngineStatus; onClick: () => void }): React.JSX.Element {
  let text: string
  let cls = ''
  switch (status.state) {
    case 'idle':
      text = 'Kein Modell geladen'
      break
    case 'loading':
      text = `Lade Modell … ${Math.round(status.progress * 100)} %`
      cls = 'busy'
      break
    case 'ready':
      text = `${status.modelName} · ${status.gpu.toUpperCase()} · ${status.contextSize.toLocaleString('de')} Token`
      cls = 'ok'
      break
    case 'error':
      text = `Fehler: ${status.message}`
      cls = 'err'
      break
  }
  return (
    <button className={`status-model ${cls}`} onClick={onClick} title="Modelle verwalten">
      <span className="dot" /> {text}
    </button>
  )
}
