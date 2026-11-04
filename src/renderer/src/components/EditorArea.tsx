import Editor, { type OnMount } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { KeyCode, KeyMod } from 'monaco-editor'
import { useEffect, useRef, useState, type MutableRefObject, type ReactNode } from 'react'
import type { MediaKind, TextEncoding } from '../../../shared/types'
import { detectLanguage, formatSize, modelUri } from '../fileLanguage'
import { Icon } from './Icon'
import { t } from '../i18n'

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

  // The save command is registered only once but always needs the current tab
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
        alert(`${t('Saving failed:')}\n${err}`)
      }
    })
  }

  return (
    <div className="editor-area">
      <div className="tabbar">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab ${tab.id === activeId ? 'active' : ''}`}
            title={'path' in tab ? tab.path : tab.title}
            onClick={() => onSelect(tab.id)}
            onMouseDown={(e) => {
              // Middle mouse button closes the tab
              if (e.button === 1) {
                e.preventDefault()
                onClose(tab.id)
              }
            }}
          >
            {tab.kind === 'models' && <Icon name="chip" size={14} />}
            <span>{tab.title}</span>
            {tab.kind === 'file' && tab.dirty && <span className="dirty-dot">●</span>}
            <button
              className="tab-close"
              title={t('Close (⌘W)')}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                onClose(tab.id)
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
            <p>{t('Open a folder on the left or load a model under “Models”.')}</p>
          </div>
        )}
        {active?.kind === 'models' && <div className="scroll">{renderModels()}</div>}
        {active?.kind === 'media' && <MediaView key={active.id} tab={active} onOpenAsText={() => onOpenAsText(active.id)} />}
        {active?.kind === 'binary' && (
          <FileNotice
            path={active.path}
            message={
              active.reason === 'too-large'
                ? t('The file is too large for the editor ({size}).', { size: formatSize(active.size) })
                : t('Binary file – cannot be shown as text ({size}).', { size: formatSize(active.size) })
            }
            onOpenAsText={() => onOpenAsText(active.id)}
          />
        )}
        {/* The editor stays mounted so undo history and models are kept */}
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

/** Preview for images, PDFs, audio and video. */
function MediaView({ tab, onOpenAsText }: { tab: Extract<Tab, { kind: 'media' }>; onOpenAsText: () => void }): React.JSX.Element {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <FileNotice
        path={tab.path}
        message={t('This format cannot be shown here ({size}).', { size: formatSize(tab.size) })}
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
            {t('Open in default app')}
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
          {t('Open in default app')}
        </button>
        <button className="btn" onClick={onOpenAsText}>
          {t('Open as text anyway')}
        </button>
      </div>
    </div>
  )
}

function openExternal(path: string): void {
  window.api.fs.openExternal(path).catch((err) => alert(`${t('Could not open the file:')}\n${err}`))
}
