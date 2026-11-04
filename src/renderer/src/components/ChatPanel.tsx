import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import type { ApprovalAnswer, ApprovalRequest, ChatMode, EngineStatus, InstalledModel } from '../../../shared/types'
import ApprovalCard from './ApprovalCard'
import { Icon } from './Icon'
import SettingsPanel from './SettingsPanel'
import { t } from '../i18n'

export interface EditorContext {
  fileName: string
  language: string
  content: string
  selection: string
}

/** Answer sections in the order they arrived: text, thoughts and tool steps. */
interface Part {
  kind: 'text' | 'thought' | 'tool'
  text: string
  /** For tool steps: output, e.g. from the terminal */
  output?: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  text: string
  parts?: Part[]
  /** Short note on which context was sent along */
  contextLabel?: string
  /** Files changed by the agent in this answer (relative to the project) */
  changed?: string[]
  reverted?: boolean
  error?: string
}

interface Props {
  status: EngineStatus
  /** Opened project folder – needed so the model can navigate by itself */
  root: string | null
  getEditorContext: () => EditorContext | null
  onInsert: (code: string) => void
  onOpenModels: () => void
  /** Does the file have unsaved changes in the editor? Then the agent must not overwrite it. */
  isDirty: (path: string) => boolean
}

// Truncate whole files so they fit into the model's context (~4 characters per token)
const MAX_FILE_CHARS = 16_000

export default function ChatPanel({ status, root, getEditorContext, onInsert, onOpenModels, isDirty }: Props): React.JSX.Element {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [includeFile, setIncludeFile] = useState(true)
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([])
  const [showSettings, setShowSettings] = useState(false)
  const [installed, setInstalled] = useState<InstalledModel[]>([])
  const listRef = useRef<HTMLDivElement>(null)
  const activeRequest = useRef<string | null>(null)

  const ready = status.state === 'ready'
  // No switching needed: with an open folder the model decides itself whether it just answers,
  // looks things up in the project or changes something. Changes and commands still need approval.
  const effectiveMode: ChatMode = root ? 'agent' : 'chat'

  const answer = (a: ApprovalAnswer): void => {
    setApprovals((prev) => prev.filter((r) => r.id !== a.id))
    void window.api.agent.answer(a)
  }

  // The agent wants to change something – show the approval card
  const isDirtyRef = useRef(isDirty)
  isDirtyRef.current = isDirty
  useEffect(
    () =>
      window.api.agent.onApproval((req) => {
        if (req.path && isDirtyRef.current(req.path)) {
          // Never overwrite the user's unsaved changes
          void window.api.agent.answer({
            id: req.id,
            approved: false,
            reason: `${req.relPath} has unsaved changes in the editor. The user has to save the file first.`
          })
          return
        }
        setApprovals((prev) => [...prev, req])
      }),
    []
  )

  useEffect(() => {
    window.api.models.installed().then(setInstalled)
  }, [status.state])

  // Append streamed answer parts to the running message
  useEffect(
    () =>
      window.api.chat.onChunk((c) => {
        if (c.requestId !== activeRequest.current) return
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== c.requestId) return m
            const parts = [...(m.parts ?? [])]
            if (c.kind === 'tool-result') {
              const idx = parts.map((p) => p.kind).lastIndexOf('tool')
              if (idx >= 0) parts[idx] = { ...parts[idx], output: c.text }
              return { ...m, parts }
            }
            if (c.kind === 'retract') {
          // Tool call the model wrote as text – don't show it as an answer
              const idx = parts.map((p) => p.kind).lastIndexOf('text')
              const removed = idx >= 0 ? parts.splice(idx, 1)[0].text : ''
              return { ...m, parts, text: m.text.slice(0, m.text.length - removed.length) }
            }
            const last = parts[parts.length - 1]
          // Replace the “preparing …” placeholder with the real tool step
            if (c.kind === 'tool' && last?.kind === 'tool' && last.text.startsWith('⏳')) {
              parts[parts.length - 1] = { kind: 'tool', text: c.text }
              return { ...m, parts }
            }
          // Text and thoughts are continued, every tool step is its own entry
            if (last && last.kind === c.kind && c.kind !== 'tool') parts[parts.length - 1] = { ...last, text: last.text + c.text }
            else parts.push({ kind: c.kind, text: c.text })
            return { ...m, parts, text: c.kind === 'text' ? m.text + c.text : m.text }
          })
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
        prompt = `Selected code from \`${ctx.fileName}\`:\n\`\`\`${ctx.language}\n${ctx.selection}\n\`\`\`\n\n${question}`
        contextLabel = t('Selection from {file}', { file: ctx.fileName })
      } else {
        const truncated = ctx.content.length > MAX_FILE_CHARS
        const body = truncated ? ctx.content.slice(0, MAX_FILE_CHARS) + '\n… (truncated)' : ctx.content
        prompt = `Current file \`${ctx.fileName}\`:\n\`\`\`${ctx.language}\n${body}\n\`\`\`\n\n${question}`
        contextLabel = ctx.fileName + (truncated ? ` ${t('(truncated)')}` : '')
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

    const res = await window.api.chat.send({ requestId, prompt, root, mode: effectiveMode })
    setApprovals([])
    if (res.changed?.length) setMessages((prev) => prev.map((m) => (m.id === requestId ? { ...m, changed: res.changed } : m)))
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
        <span>{showSettings ? t('Model Settings') : t('AI Chat')}</span>
        <span className="header-actions">
          <button
            className={`icon-btn ${showSettings ? 'on' : ''}`}
            title={showSettings ? t('Back to chat') : t('Model Settings')}
            onClick={() => setShowSettings((v) => !v)}
          >
            <Icon name={showSettings ? 'chat' : 'sliders'} size={16} />
          </button>
          <button className="icon-btn" title={t('New chat')} onClick={newChat}>
            <Icon name="plus" size={16} />
          </button>
        </span>
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
          <option value="">{installed.length ? t('Choose model …') : t('No model installed')}</option>
          {installed.map((m) => (
            <option key={m.path} value={m.path}>
              {m.name}
            </option>
          ))}
          <option value="__manage__">{t('Manage models …')}</option>
        </select>
        {status.state === 'loading' && (
          <div className="progress thin">
            <div style={{ width: `${status.progress * 100}%` }} />
          </div>
        )}
      </div>

      {showSettings ? (
        <div className="chat-messages">
          <SettingsPanel status={status} />
        </div>
      ) : (
      <>
      <div className="chat-messages" ref={listRef}>
        {messages.length === 0 && (
          <div className="chat-empty">
            <Icon name="sparkle" size={28} />
            {ready ? (
              <p>
                {effectiveMode === 'agent'
                      ? t('Ask something about your project or give it a task. The model searches and reads by itself and changes files or runs commands if needed – you approve each of those first.')
                      : t('Ask something about your code. Open a folder so the model can look into the project itself and get tasks done.')}
              </p>
            ) : (
              <>
                    <p>{t('Load a local model first to chat.')}</p>
                <button className="btn primary" onClick={onOpenModels}>
                      {t('Open Models')}
                </button>
              </>
            )}
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`msg ${m.role}`}>
            {m.contextLabel && <div className="ctx-chip">📎 {m.contextLabel}</div>}
            {m.role === 'assistant' ? (
              (m.parts ?? []).map((part, pi) =>
                part.kind === 'tool' ? (
                  part.output !== undefined ? (
                    <details key={pi} className="tool-step has-output">
                      <summary>{part.text}</summary>
                      <pre>{part.output}</pre>
                    </details>
                  ) : (
                    <div key={pi} className="tool-step">
                      {part.text}
                    </div>
                  )
                ) : part.kind === 'thought' ? (
                  <details key={pi} className="thought">
                      <summary>{t('Chain of thought')}</summary>
                    <pre>{part.text.trim()}</pre>
                  </details>
                ) : (
                  <Markdown key={pi} text={part.text} onInsert={onInsert} />
                )
              )
            ) : (
              <p>{m.text}</p>
            )}
            {m.role === 'assistant' && !m.text && !m.error && busy && <span className="typing">●●●</span>}
            {m.error && <div className="error-box">{m.error}</div>}
            {m.changed && m.changed.length > 0 && (
              <div className="changes-bar">
                <span className="muted">
                      {m.reverted ? t('↶ Reverted:') + ' ' : t('✎ Changed:') + ' '}
                  {m.changed.join(', ')}
                </span>
                {!m.reverted && (
                  <button
                    className="link-btn"
                        title={t('Restores the state before this answer (newly created files are deleted)')}
                    onClick={async () => {
                          if (!confirm(t('Revert all changes of this answer?') + `\n\n${m.changed!.join('\n')}\n\n` + t('Later changes to these files will be lost.'))) return
                      await window.api.agent.revert(m.id)
                      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, reverted: true } : x)))
                    }}
                  >
                        {t('Undo')}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
        {approvals.map((req) => (
          <ApprovalCard key={req.id} req={req} onAnswer={answer} />
        ))}
      </div>

      <div className="chat-input">
        <div className="ctx-toggles">
          <label className="ctx-toggle">
            <input type="checkbox" checked={includeFile} onChange={(e) => setIncludeFile(e.target.checked)} />
              {t('Send file / selection')}
          </label>
        </div>
        <div className="input-row">
          <textarea
            value={input}
              placeholder={ready ? t('Message … (Enter to send, Shift+Enter for a new line)') : t('No model loaded')}
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
                <button className="send-btn stop" title={t('Stop')} onClick={() => window.api.chat.stop()}>
              <Icon name="stop" size={16} />
            </button>
          ) : (
                <button className="send-btn" title={t('Send')} disabled={!ready || !input.trim()} onClick={send}>
              <Icon name="send" size={16} />
            </button>
          )}
        </div>
      </div>
      </>
      )}
    </aside>
  )
}

/** Minimal Markdown renderer: code blocks, inline code, bold. Deliberately without innerHTML. */
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
        <Icon name="copy" size={12} /> {copied ? t('Copied') : t('Copy')}
        </button>
        <button className="link-btn" onClick={() => onInsert(code)}>
        <Icon name="insert" size={12} /> {t('Insert')}
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  )
}
