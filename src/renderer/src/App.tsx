import { useCallback, useEffect, useRef, useState } from 'react'
import { editor as monacoEditor, type editor } from 'monaco-editor'
import type { EngineStatus, OpenedFile } from '../../shared/types'
import { modelUri } from './fileLanguage'
import FileTree from './components/FileTree'
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

export default function App(): React.JSX.Element {
  const [root, setRoot] = useState<string | null>(null)
  const [tabs, setTabs] = useState<Tab[]>([{ id: MODELS_TAB, title: 'Modelle', kind: 'models' }])
  const [activeId, setActiveId] = useState<string>(MODELS_TAB)
  const [sidebar, setSidebar] = useState<'explorer' | 'git' | null>('explorer')
  const [chatOpen, setChatOpen] = useState(true)
  const [status, setStatus] = useState<EngineStatus>({ state: 'idle' })
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)

  useEffect(() => {
    window.api.engine.status().then(setStatus)
    return window.api.engine.onStatus(setStatus)
  }, [])

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

  // Cmd+W aus dem App-Menü schließt den aktiven Tab
  const closeActiveRef = useRef<() => void>(() => {})
  closeActiveRef.current = () => {
    if (tabs.some((t) => t.id === activeId)) closeTab(activeId)
  }
  useEffect(() => window.api.menu.onCloseTab(() => closeActiveRef.current()), [])

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
      <div className="titlebar">
        <span className="titlebar-name">{root ? root.split('/').pop() : 'Lokal IDE'}</span>
      </div>

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

        {sidebar === 'explorer' && (
          <aside className="sidebar">
            <div className="panel-header">
              <span>Explorer</span>
              <button className="icon-btn" title="Ordner öffnen" onClick={openFolder}>
                <Icon name="folder-open" size={16} />
              </button>
            </div>
            {root ? (
              <FileTree root={root} activePath={activeTab && 'path' in activeTab ? activeTab.path : undefined} onOpen={openFile} />
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
        </main>

        {chatOpen && (
          <ChatPanel
            status={status}
            getEditorContext={getEditorContext}
            onInsert={insertIntoEditor}
            onOpenModels={openModels}
          />
        )}
      </div>

      <footer className="statusbar">
        <StatusText status={status} onClick={openModels} />
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
