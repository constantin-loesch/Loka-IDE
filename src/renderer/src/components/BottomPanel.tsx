import { useEffect, useRef, useState } from 'react'
import type { PortInfo, TerminalInfo, TerminalTarget } from '../../../shared/types'
import { Icon } from './Icon'
import TerminalView from './TerminalView'
import { t } from '../i18n'

export type PanelTab = 'terminal' | 'ports' | 'output'

interface Props {
  tab: PanelTab
  onTab: (t: PanelTab) => void
  terminals: TerminalInfo[]
  activeTerminal: string | null
  onSelectTerminal: (id: string) => void
  onNewTerminal: (target: TerminalTarget) => void
  onKillTerminal: (id: string) => void
  containerRunning: boolean
  ports: PortInfo[]
  output: string
  onClearOutput: () => void
  onClose: () => void
  hasRoot: boolean
  visible: boolean
}

export default function BottomPanel(p: Props): React.JSX.Element {
  return (
    <div className="bottom-panel">
      <div className="panel-tabs">
        <button className={p.tab === 'terminal' ? 'active' : ''} onClick={() => p.onTab('terminal')}>
          Terminal
        </button>
        <button className={p.tab === 'ports' ? 'active' : ''} onClick={() => p.onTab('ports')}>
          Ports {p.ports.length > 0 && <span className="count">{p.ports.length}</span>}
        </button>
        <button className={p.tab === 'output' ? 'active' : ''} onClick={() => p.onTab('output')}>
          {t('Output')}
        </button>
        <span className="spacer" />
        {p.tab === 'terminal' && (
          <>
            <button className="icon-btn" title={t('New terminal (⌃⇧`)')} onClick={() => p.onNewTerminal('local')} disabled={!p.hasRoot}>
              <Icon name="plus" size={16} />
            </button>
            <button
              className="icon-btn"
              title={p.containerRunning ? t('New terminal in the dev container') : t('Dev container is not running')}
              onClick={() => p.onNewTerminal('container')}
              disabled={!p.containerRunning}
            >
              <Icon name="container" size={16} />
            </button>
            {p.activeTerminal && (
              <button className="icon-btn" title={t('Kill terminal')} onClick={() => p.onKillTerminal(p.activeTerminal!)}>
                <Icon name="trash" size={15} />
              </button>
            )}
          </>
        )}
        {p.tab === 'output' && (
          <button className="icon-btn" title={t('Clear output')} onClick={p.onClearOutput}>
            <Icon name="trash" size={15} />
          </button>
        )}
        <button className="icon-btn" title={t('Close panel')} onClick={p.onClose}>
          <Icon name="close" size={15} />
        </button>
      </div>

      <div className="panel-body">
        {/* Terminals always stay mounted so history and running programs are kept */}
        <div className="terminal-area" style={{ display: p.tab === 'terminal' ? 'flex' : 'none' }}>
          <div className="terminal-stack">
            {p.terminals.length === 0 && (
              <div className="empty-hint">
                {p.hasRoot ? (
                  <button className="btn" onClick={() => p.onNewTerminal('local')}>
                    <Icon name="terminal" size={15} /> {t('Open terminal')}
                  </button>
                ) : (
                  t('Open a folder to start a terminal.')
                )}
              </div>
            )}
            {p.terminals.map((term) => (
              <TerminalView key={term.id} id={term.id} visible={p.visible && p.tab === 'terminal' && term.id === p.activeTerminal} />
            ))}
          </div>
          {p.terminals.length > 1 && (
            <div className="terminal-list">
              {p.terminals.map((term) => (
                <div
                  key={term.id}
                  className={`terminal-item ${term.id === p.activeTerminal ? 'active' : ''}`}
                  onClick={() => p.onSelectTerminal(term.id)}
                  title={term.cwd}
                >
                  <Icon name={term.target === 'container' ? 'container' : 'terminal'} size={13} />
                  <span>{term.title}</span>
                  <button
                    className="icon-btn"
                    title={t('Kill')}
                    onClick={(e) => {
                      e.stopPropagation()
                      p.onKillTerminal(term.id)
                    }}
                  >
                    <Icon name="close" size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {p.tab === 'ports' && <PortsView ports={p.ports} containerRunning={p.containerRunning} />}
        {p.tab === 'output' && <OutputView text={p.output} />}
      </div>
    </div>
  )
}

function PortsView({ ports, containerRunning }: { ports: PortInfo[]; containerRunning: boolean }): React.JSX.Element {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  const add = async (): Promise<void> => {
    const port = Number(value.trim())
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      setError(t('Enter a port between 1 and 65535'))
      return
    }
    try {
      await window.api.ports.forward(port)
      setValue('')
      setError(null)
    } catch (err) {
      setError(String(err))
    }
  }

  return (
    <div className="ports-view">
      <table className="ports-table">
        <thead>
          <tr>
            <th>Port</th>
            <th>{t('Forwarded address')}</th>
            <th>{t('Source')}</th>
            <th>{t('Process')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {ports.map((p) => (
            <tr key={`${p.source}-${p.port}`}>
              <td>
                <span className={`port-dot ${p.source}`} /> {p.port}
              </td>
              <td>
                <button className="link-btn mono" onClick={() => void window.api.openUrl(p.url)} title={t('Open in browser')}>
                  {p.url.replace('http://', '')}
                </button>
                {p.localPort && p.localPort !== p.port && <span className="muted"> {t('(port {port} was taken)', { port: p.port })}</span>}
              </td>
              <td>{p.source === 'container' ? t('Dev container') : t('Terminal')}</td>
              <td className="muted">{p.process ?? (p.forwarded ? t('pinned') : t('automatic'))}</td>
              <td className="port-actions">
                <button className="icon-btn" title={t('Open in browser')} onClick={() => void window.api.openUrl(p.url)}>
                  <Icon name="globe" size={14} />
                </button>
                <button className="icon-btn" title={t('Copy address')} onClick={() => void window.api.copy(p.url)}>
                  <Icon name="copy" size={14} />
                </button>
                {(p.source === 'container' || p.forwarded) && (
                  <button className="icon-btn" title={t('Stop forwarding')} onClick={() => void window.api.ports.unforward(p.port)}>
                    <Icon name="close" size={14} />
                  </button>
                )}
              </td>
            </tr>
          ))}
          {ports.length === 0 && (
            <tr>
              <td colSpan={5} className="muted ports-empty">
                {t('No ports yet. When a program in the terminal or in the dev container starts a server (e.g.')} <code>npm run dev</code>{t('), it shows up here automatically.')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <form
        className="port-add"
        onSubmit={(e) => {
          e.preventDefault()
          void add()
        }}
      >
        <input
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setError(null)
          }}
          placeholder={containerRunning ? t('Forward a port from the container, e.g. 8080') : t('Enter a port, e.g. 8080')}
          inputMode="numeric"
        />
        <button className="btn" type="submit">
          <Icon name="plug" size={14} /> {t('Forward port')}
        </button>
        {error && <span className="err-text">{error}</span>}
      </form>
    </div>
  )
}

function OutputView({ text }: { text: string }): React.JSX.Element {
  const ref = useRef<HTMLPreElement>(null)
  useEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [text])
  return (
    <pre className="output-view" ref={ref}>
      {text || t('The output of starting and building the dev container appears here.')}
    </pre>
  )
}
