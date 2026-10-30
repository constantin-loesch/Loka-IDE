import Editor, { type OnMount } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { KeyCode, KeyMod } from 'monaco-editor'
import { useEffect, useRef, useState, type MutableRefObject, type ReactNode } from 'react'
import type { MediaKind, TextEncoding } from '../../../shared/types'
import { detectLanguage, formatSize, modelUri } from '../fileLanguage'
import { Icon } from './Icon'

export type Tab =
  | { id: string; title: string; kind: 'file'; path: string; content: string; dirty: boolean; encoding: TextEncoding }
  | { id: string; title: string; kind: 'media'; path: string; media: MediaKind; url: string; size: number }
  | { id: string; title: string; kind: 'binary'; path: string; reason: 'binary' | 'too-large'; size: number }
  | { id: string; title: string; kind: 'models' }

interface Props {
  tabs: Tab[]
  activeId: string
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onUpdate: (id: string, patch: Partial<Tab>) => void
  onOpenAsText: (id: string) => void
  editorRef: MutableRefObject<editor.IStandaloneCodeEditor | null>
  renderModels: () => ReactNode
}

export default function EditorArea({
  tabs,
  activeId,
  onSelect,
  onClose,
  onUpdate,
  onOpenAsText,
  editorRef,
  renderModels
}: Props): React.JSX.Element {
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
      try {
        await window.api.fs.writeFile(tab.path, content, tab.encoding)
        onUpdate(tab.id, { content, dirty: false })
      } catch (err) {
        alert(`Speichern fehlgeschlagen:\n${err}`)
      }
    })
  }

  return (
    <div className="editor-area">
      <div className="tabbar">
        {tabs.map((t) => (
          <div
            key={t.id}
            className={`tab ${t.id === activeId ? 'active' : ''}`}
            title={'path' in t ? t.path : t.title}
            onClick={() => onSelect(t.id)}
            onMouseDown={(e) => {
              // Mittlere Maustaste schließt den Tab
              if (e.button === 1) {
                e.preventDefault()
                onClose(t.id)
              }
            }}
          >
            {t.kind === 'models' && <Icon name="chip" size={14} />}
            <span>{t.title}</span>
            {t.kind === 'file' && t.dirty && <span className="dirty-dot">●</span>}
            <button
              className="tab-close"
              title="Schließen (⌘W)"
              onMouseDown={(e) => e.stopPropagation()}
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
        {active?.kind === 'media' && <MediaView key={active.id} tab={active} onOpenAsText={() => onOpenAsText(active.id)} />}
        {active?.kind === 'binary' && (
          <FileNotice
            path={active.path}
            message={
              active.reason === 'too-large'
                ? `Die Datei ist zu groß für den Editor (${formatSize(active.size)}).`
                : `Binärdatei – kann nicht als Text angezeigt werden (${formatSize(active.size)}).`
            }
            onOpenAsText={() => onOpenAsText(active.id)}
          />
        )}
        {/* Editor bleibt gemountet, damit Undo-Verlauf und Modelle erhalten bleiben */}
        <div className="monaco-wrap" style={{ display: active?.kind === 'file' ? 'block' : 'none' }}>
          <Editor
            theme="vs-dark"
            path={active?.kind === 'file' ? modelUri(active.path).toString() : undefined}
            language={active?.kind === 'file' ? detectLanguage(active.path) : undefined}
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

/** Vorschau für Bilder, PDFs, Audio und Video. */
function MediaView({ tab, onOpenAsText }: { tab: Extract<Tab, { kind: 'media' }>; onOpenAsText: () => void }): React.JSX.Element {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <FileNotice
        path={tab.path}
        message={`Dieses Format kann hier nicht angezeigt werden (${formatSize(tab.size)}).`}
        onOpenAsText={onOpenAsText}
      />
    )
  }

  const onError = (): void => setFailed(true)
  return (
    <div className={`preview preview-${tab.media}`}>
      {tab.media === 'image' && <img src={tab.url} alt={tab.title} onError={onError} />}
      {tab.media === 'pdf' && <iframe src={tab.url} title={tab.title} />}
      {tab.media === 'audio' && <audio src={tab.url} controls onError={onError} />}
      {tab.media === 'video' && <video src={tab.url} controls onError={onError} />}
      {tab.media !== 'pdf' && (
        <div className="preview-meta">
          {formatSize(tab.size)} ·{' '}
          <button className="text-link" onClick={() => openExternal(tab.path)}>
            Im Standardprogramm öffnen
          </button>
        </div>
      )}
    </div>
  )
}

function FileNotice({ path, message, onOpenAsText }: { path: string; message: string; onOpenAsText: () => void }): React.JSX.Element {
  return (
    <div className="welcome file-notice">
      <Icon name="file" size={40} />
      <p>{message}</p>
      <div className="file-notice-actions">
        <button className="btn primary" onClick={() => openExternal(path)}>
          Im Standardprogramm öffnen
        </button>
        <button className="btn" onClick={onOpenAsText}>
          Trotzdem als Text öffnen
        </button>
      </div>
    </div>
  )
}

function openExternal(path: string): void {
  window.api.fs.openExternal(path).catch((err) => alert(`Konnte die Datei nicht öffnen:\n${err}`))
}
