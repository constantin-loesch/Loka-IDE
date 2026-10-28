import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import type { EngineStatus, InstalledModel } from '../../../shared/types'
import { Icon } from './Icon'

export interface EditorContext {
  fileName: string
  language: string
  content: string
  selection: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  text: string
  thought?: string
  /** Kurzer Hinweis, welcher Kontext mitgeschickt wurde */
  contextLabel?: string
  error?: string
}

interface Props {
  status: EngineStatus
  getEditorContext: () => EditorContext | null
  onInsert: (code: string) => void
  onOpenModels: () => void
}

// Ganze Dateien kürzen, damit sie in den Kontext des Modells passen (~4 Zeichen pro Token)
const MAX_FILE_CHARS = 16_000

export default function ChatPanel({ status, getEditorContext, onInsert, onOpenModels }: Props): React.JSX.Element {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [includeFile, setIncludeFile] = useState(true)
  const [installed, setInstalled] = useState<InstalledModel[]>([])
  const listRef = useRef<HTMLDivElement>(null)
  const activeRequest = useRef<string | null>(null)

  const ready = status.state === 'ready'

  useEffect(() => {
    window.api.models.installed().then(setInstalled)
  }, [status.state])

  // Gestreamte Antwortteile an die laufende Nachricht anhängen
  useEffect(
    () =>
      window.api.chat.onChunk((c) => {
        if (c.requestId !== activeRequest.current) return
        setMessages((prev) =>
          prev.map((m) =>
            m.id === c.requestId
              ? c.kind === 'thought'
                ? { ...m, thought: (m.thought ?? '') + c.text }
                : { ...m, text: m.text + c.text }
              : m
          )
        )
      }),
    []
  )

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages])

  const send = async (): Promise<void> => {
    const question = input.trim()
    if (!question || busy || !ready) return

    let prompt = question
    let contextLabel: string | undefined
    const ctx = includeFile ? getEditorContext() : null
    if (ctx) {
      if (ctx.selection) {
        prompt = `Ausgewählter Code aus \`${ctx.fileName}\`:\n\`\`\`${ctx.language}\n${ctx.selection}\n\`\`\`\n\n${question}`
        contextLabel = `Auswahl aus ${ctx.fileName}`
      } else {
        const truncated = ctx.content.length > MAX_FILE_CHARS
        const body = truncated ? ctx.content.slice(0, MAX_FILE_CHARS) + '\n… (gekürzt)' : ctx.content
        prompt = `Aktuelle Datei \`${ctx.fileName}\`:\n\`\`\`${ctx.language}\n${body}\n\`\`\`\n\n${question}`
        contextLabel = ctx.fileName + (truncated ? ' (gekürzt)' : '')
      }
    }

    const requestId = crypto.randomUUID()
    activeRequest.current = requestId
    setMessages((prev) => [
      ...prev,
      { id: requestId + '-q', role: 'user', text: question, contextLabel },
      { id: requestId, role: 'assistant', text: '' }
    ])
    setInput('')
    setBusy(true)

    const res = await window.api.chat.send({ requestId, prompt })
    if (!res.ok) setMessages((prev) => prev.map((m) => (m.id === requestId ? { ...m, error: res.error } : m)))
    activeRequest.current = null
    setBusy(false)
  }

  const newChat = async (): Promise<void> => {
    if (busy) await window.api.chat.stop()
    await window.api.chat.reset()
    setMessages([])
  }

  return (
    <aside className="chat">
      <div className="panel-header">
        <span>KI-Chat</span>
        <button className="icon-btn" title="Neuer Chat" onClick={newChat}>
          <Icon name="plus" size={16} />
        </button>
      </div>

      <div className="chat-model">
        <select
          value={status.state === 'ready' || status.state === 'loading' ? status.modelPath : ''}
          onChange={(e) => {
            if (e.target.value === '__manage__') onOpenModels()
            else if (e.target.value) window.api.engine.load(e.target.value)
          }}
          disabled={status.state === 'loading'}
        >
          <option value="">{installed.length ? 'Modell wählen …' : 'Kein Modell installiert'}</option>
          {installed.map((m) => (
            <option key={m.path} value={m.path}>
              {m.name}
            </option>
          ))}
          <option value="__manage__">Modelle verwalten …</option>
        </select>
        {status.state === 'loading' && (
          <div className="progress thin">
            <div style={{ width: `${status.progress * 100}%` }} />
          </div>
        )}
      </div>

      <div className="chat-messages" ref={listRef}>
        {messages.length === 0 && (
          <div className="chat-empty">
            <Icon name="sparkle" size={28} />
            {ready ? (
              <p>Frag etwas zu deinem Code. Die geöffnete Datei oder deine Auswahl wird automatisch mitgeschickt.</p>
            ) : (
              <>
                <p>Lade zuerst ein lokales Modell, um zu chatten.</p>
                <button className="btn primary" onClick={onOpenModels}>
                  Modelle öffnen
                </button>
              </>
            )}
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`msg ${m.role}`}>
            {m.contextLabel && <div className="ctx-chip">📎 {m.contextLabel}</div>}
            {m.thought && (
              <details className="thought">
                <summary>Gedankengang</summary>
                <pre>{m.thought.trim()}</pre>
              </details>
            )}
            {m.role === 'assistant' ? <Markdown text={m.text} onInsert={onInsert} /> : <p>{m.text}</p>}
            {m.role === 'assistant' && !m.text && !m.error && busy && <span className="typing">●●●</span>}
            {m.error && <div className="error-box">{m.error}</div>}
          </div>
        ))}
      </div>

      <div className="chat-input">
        <label className="ctx-toggle">
          <input type="checkbox" checked={includeFile} onChange={(e) => setIncludeFile(e.target.checked)} />
          Datei / Auswahl mitsenden
        </label>
        <div className="input-row">
          <textarea
            value={input}
            placeholder={ready ? 'Nachricht … (Enter senden, Shift+Enter neue Zeile)' : 'Kein Modell geladen'}
            disabled={!ready}
            rows={3}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                send()
              }
            }}
          />
          {busy ? (
            <button className="send-btn stop" title="Stoppen" onClick={() => window.api.chat.stop()}>
              <Icon name="stop" size={16} />
            </button>
          ) : (
            <button className="send-btn" title="Senden" disabled={!ready || !input.trim()} onClick={send}>
              <Icon name="send" size={16} />
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}

/** Minimaler Markdown-Renderer: Codeblöcke, Inline-Code, Fett. Bewusst ohne innerHTML. */
function Markdown({ text, onInsert }: { text: string; onInsert: (code: string) => void }): React.JSX.Element {
  const parts: ReactNode[] = []
  const fence = /```(\w*)\n?([\s\S]*?)(```|$)/g
  let last = 0
  let match: RegExpExecArray | null
  let i = 0
  while ((match = fence.exec(text)) !== null) {
    if (match.index > last) parts.push(<Prose key={i++} text={text.slice(last, match.index)} />)
    const code = match[2].replace(/\n$/, '')
    parts.push(<CodeBlock key={i++} lang={match[1]} code={code} onInsert={onInsert} />)
    last = fence.lastIndex
    if (match[0].length === 0) break
  }
  if (last < text.length) parts.push(<Prose key={i++} text={text.slice(last)} />)
  return <div className="md">{parts}</div>
}

function Prose({ text }: { text: string }): React.JSX.Element {
  return (
    <>
      {text
        .split(/\n{2,}/)
        .filter((p) => p.trim())
        .map((para, pi) => (
          <p key={pi}>
            {para.split('\n').map((line, li) => (
              <Fragment key={li}>
                {li > 0 && <br />}
                {inline(line)}
              </Fragment>
            ))}
          </p>
        ))}
    </>
  )
}

function inline(line: string): ReactNode[] {
  return line.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((seg, i) => {
    if (seg.startsWith('`') && seg.endsWith('`') && seg.length > 1) return <code key={i}>{seg.slice(1, -1)}</code>
    if (seg.startsWith('**') && seg.endsWith('**') && seg.length > 3) return <strong key={i}>{seg.slice(2, -2)}</strong>
    return seg
  })
}

function CodeBlock({ lang, code, onInsert }: { lang: string; code: string; onInsert: (c: string) => void }): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  return (
    <div className="codeblock">
      <div className="codeblock-bar">
        <span>{lang || 'code'}</span>
        <span className="spacer" />
        <button
          className="link-btn"
          onClick={() => {
            navigator.clipboard.writeText(code)
            setCopied(true)
            setTimeout(() => setCopied(false), 1200)
          }}
        >
          <Icon name="copy" size={12} /> {copied ? 'Kopiert' : 'Kopieren'}
        </button>
        <button className="link-btn" onClick={() => onInsert(code)}>
          <Icon name="insert" size={12} /> Einfügen
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  )
}
