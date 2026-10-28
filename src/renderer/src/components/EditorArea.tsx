import Editor, { type OnMount } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { KeyCode, KeyMod } from 'monaco-editor'
import { useEffect, useRef, type MutableRefObject, type ReactNode } from 'react'
import { Icon } from './Icon'

export type Tab =
  | { id: string; title: string; kind: 'file'; path: string; content: string; dirty: boolean }
  | { id: string; title: string; kind: 'models' }

interface Props {
  tabs: Tab[]
  activeId: string
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onUpdate: (id: string, patch: Partial<Tab>) => void
  editorRef: MutableRefObject<editor.IStandaloneCodeEditor | null>
  renderModels: () => ReactNode
}

export default function EditorArea({ tabs, activeId, onSelect, onClose, onUpdate, editorRef, renderModels }: Props): React.JSX.Element {
  const active = tabs.find((t) => t.id === activeId)

  // Der Speichern-Befehl wird nur einmal registriert, braucht aber immer den aktuellen Tab
  const activeRef = useRef(active)
  useEffect(() => {
    activeRef.current = active
  }, [active])

  const handleMount: OnMount = (ed) => {
    editorRef.current = ed
    ed.addCommand(KeyMod.CtrlCmd | KeyCode.KeyS, async () => {
      const tab = activeRef.current
      if (tab?.kind !== 'file') return
      const content = ed.getValue()
      await window.api.fs.writeFile(tab.path, content)
      onUpdate(tab.id, { content, dirty: false })
    })
  }

  return (
    <div className="editor-area">
      <div className="tabbar">
        {tabs.map((t) => (
          <div
            key={t.id}
            className={`tab ${t.id === activeId ? 'active' : ''}`}
            onClick={() => onSelect(t.id)}
            onMouseDown={(e) => e.button === 1 && onClose(t.id)}
          >
            {t.kind === 'models' && <Icon name="chip" size={14} />}
            <span>{t.title}</span>
            {t.kind === 'file' && t.dirty && <span className="dirty-dot">●</span>}
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation()
                onClose(t.id)
              }}
            >
              <Icon name="close" size={12} />
            </button>
          </div>
        ))}
      </div>

      <div className="editor-content">
        {!active && (
          <div className="welcome">
            <h1>Lokal IDE</h1>
            <p>Öffne einen Ordner links oder lade ein Modell unter „Modelle“.</p>
          </div>
        )}
        {active?.kind === 'models' && <div className="scroll">{renderModels()}</div>}
        {/* Editor bleibt gemountet, damit Undo-Verlauf und Modelle erhalten bleiben */}
        <div className="monaco-wrap" style={{ display: active?.kind === 'file' ? 'block' : 'none' }}>
          <Editor
            theme="vs-dark"
            path={active?.kind === 'file' ? active.path : undefined}
            defaultValue={active?.kind === 'file' ? active.content : ''}
            onMount={handleMount}
            onChange={() => {
              if (active?.kind === 'file' && !active.dirty) onUpdate(active.id, { dirty: true })
            }}
            options={{
              fontSize: 13,
              fontFamily: 'JetBrains Mono, SF Mono, Menlo, monospace',
              minimap: { enabled: true },
              smoothScrolling: true,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              padding: { top: 8 }
            }}
          />
        </div>
      </div>
    </div>
  )
}
