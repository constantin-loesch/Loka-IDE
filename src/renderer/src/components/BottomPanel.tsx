import { useEffect, useRef, useState } from 'react'
import type { PortInfo, TerminalInfo, TerminalTarget } from '../../../shared/types'
import { Icon } from './Icon'
import TerminalView from './TerminalView'

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
          Ausgabe
        </button>
        <span className="spacer" />
        {p.tab === 'terminal' && (
          <>
            <button className="icon-btn" title="Neues Terminal (⌃⇧`)" onClick={() => p.onNewTerminal('local')} disabled={!p.hasRoot}>
              <Icon name="plus" size={16} />
            </button>
            <button
              className="icon-btn"
              title={p.containerRunning ? 'Neues Terminal im Devcontainer' : 'Devcontainer läuft nicht'}
              onClick={() => p.onNewTerminal('container')}
              disabled={!p.containerRunning}
            >
              <Icon name="container" size={16} />
            </button>
            {p.activeTerminal && (
              <button className="icon-btn" title="Terminal beenden" onClick={() => p.onKillTerminal(p.activeTerminal!)}>
                <Icon name="trash" size={15} />
              </button>
            )}
          </>
        )}
        {p.tab === 'output' && (
          <button className="icon-btn" title="Ausgabe leeren" onClick={p.onClearOutput}>
            <Icon name="trash" size={15} />
          </button>
        )}
        <button className="icon-btn" title="Bereich schließen" onClick={p.onClose}>
          <Icon name="close" size={15} />
        </button>
      </div>

      <div className="panel-body">
        {/* Terminals bleiben immer eingehängt, damit Verlauf und laufende Programme erhalten bleiben */}
        <div className="terminal-area" style={{ display: p.tab === 'terminal' ? 'flex' : 'none' }}>
          <div className="terminal-stack">
            {p.terminals.length === 0 && (
              <div className="empty-hint">
                {p.hasRoot ? (
                  <button className="btn" onClick={() => p.onNewTerminal('local')}>
                    <Icon name="terminal" size={15} /> Terminal öffnen
                  </button>
                ) : (
                  'Öffne einen Ordner, um ein Terminal zu starten.'
                )}
              </div>
            )}
            {p.terminals.map((t) => (
              <TerminalView key={t.id} id={t.id} visible={p.visible && p.tab === 'terminal' && t.id === p.activeTerminal} />
            ))}
          </div>
          {p.terminals.length > 1 && (
            <div className="terminal-list">
              {p.terminals.map((t) => (
                <div
                  key={t.id}
                  className={`terminal-item ${t.id === p.activeTerminal ? 'active' : ''}`}
                  onClick={() => p.onSelectTerminal(t.id)}
                  title={t.cwd}
                >
                  <Icon name={t.target === 'container' ? 'container' : 'terminal'} size={13} />
                  <span>{t.title}</span>
                  <button
                    className="icon-btn"
                    title="Beenden"
                    onClick={(e) => {
                      e.stopPropagation()
                      p.onKillTerminal(t.id)
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
      setError('Port zwischen 1 und 65535 eingeben')
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
            <th>Weitergeleitete Adresse</th>
            <th>Quelle</th>
            <th>Prozess</th>
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
                <button className="link-btn mono" onClick={() => void window.api.openUrl(p.url)} title="Im Browser öffnen">
                  {p.url.replace('http://', '')}
                </button>
                {p.localPort && p.localPort !== p.port && <span className="muted"> (Port {p.port} war belegt)</span>}
              </td>
              <td>{p.source === 'container' ? 'Devcontainer' : 'Terminal'}</td>
              <td className="muted">{p.process ?? (p.forwarded ? 'fest eingetragen' : 'automatisch')}</td>
              <td className="port-actions">
                <button className="icon-btn" title="Im Browser öffnen" onClick={() => void window.api.openUrl(p.url)}>
                  <Icon name="globe" size={14} />
                </button>
                <button className="icon-btn" title="Adresse kopieren" onClick={() => void window.api.copy(p.url)}>
                  <Icon name="copy" size={14} />
                </button>
                {(p.source === 'container' || p.forwarded) && (
                  <button className="icon-btn" title="Weiterleitung beenden" onClick={() => void window.api.ports.unforward(p.port)}>
                    <Icon name="close" size={14} />
                  </button>
                )}
              </td>
            </tr>
          ))}
          {ports.length === 0 && (
            <tr>
              <td colSpan={5} className="muted ports-empty">
                Noch keine Ports. Startet ein Programm im Terminal oder im Devcontainer einen Server (z. B. <code>npm run dev</code>),
                erscheint er hier automatisch.
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
          placeholder={containerRunning ? 'Port aus dem Container weiterleiten, z. B. 8080' : 'Port eintragen, z. B. 8080'}
          inputMode="numeric"
        />
        <button className="btn" type="submit">
          <Icon name="plug" size={14} /> Port weiterleiten
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
      {text || 'Hier erscheint die Ausgabe beim Starten und Bauen des Devcontainers.'}
    </pre>
  )
}
