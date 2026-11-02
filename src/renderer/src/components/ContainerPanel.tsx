import { useCallback, useEffect, useState } from 'react'
import type { BuildTask, DevcontainerStatus, DevcontainerTemplate, TerminalTarget } from '../../../shared/types'
import { Icon } from './Icon'

interface Props {
  root: string | null
  status: DevcontainerStatus | null
  onRefreshStatus: () => void
  onOpenFolder: () => void
  onOpenFile: (path: string) => void
  /** Befehl in einem neuen Terminal ausführen */
  onRun: (command: string, target: TerminalTarget, title: string) => void
  onNewTerminal: (target: TerminalTarget) => void
  /** Ausgabe-Bereich zeigen (Container-Log) */
  onShowOutput: () => void
}

const errText = (err: unknown): string => String(err instanceof Error ? err.message : err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

export default function ContainerPanel(p: Props): React.JSX.Element {
  const [tasks, setTasks] = useState<BuildTask[]>([])
  const [target, setTarget] = useState<TerminalTarget>('local')
  const [custom, setCustom] = useState('')
  const [dialog, setDialog] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadTasks = useCallback(() => {
    if (p.root) window.api.tasks.detect(p.root).then(setTasks, () => setTasks([]))
    else setTasks([])
  }, [p.root])
  useEffect(loadTasks, [loadTasks])

  const s = p.status
  const running = s?.state === 'running'
  // Läuft der Container, Aufgaben standardmäßig dort ausführen
  useEffect(() => setTarget(running ? 'container' : 'local'), [running])

  if (!p.root) {
    return (
      <div className="empty-hint">
        <p>Kein Ordner geöffnet.</p>
        <button className="btn primary" onClick={p.onOpenFolder}>
          Ordner öffnen
        </button>
      </div>
    )
  }
  const root = p.root

  const act = async (label: string, fn: () => Promise<unknown>): Promise<void> => {
    setBusy(label)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(errText(err))
    } finally {
      setBusy(null)
      p.onRefreshStatus()
    }
  }

  const up = (rebuild: boolean): void => {
    p.onShowOutput()
    void act(rebuild ? 'rebuild' : 'up', () => window.api.devcontainer.up(root, rebuild))
  }

  const groups = [...new Set(tasks.map((t) => t.group))]

  return (
    <div className="container-panel">
      {/* ---------- Devcontainer ---------- */}
      <section>
        <h3>Devcontainer</h3>
        {!s && <p className="muted">Prüfe Docker …</p>}

        {s && s.docker === 'missing' && (
          <div className="notice warn">
            Docker ist nicht installiert. Devcontainer brauchen{' '}
            <button className="link-btn inline" onClick={() => void window.api.openUrl('https://www.docker.com/products/docker-desktop/')}>
              Docker Desktop
            </button>{' '}
            (oder Docker Engine, OrbStack, Colima).
          </div>
        )}
        {s && s.docker === 'not-running' && (
          <div className="notice warn">
            Docker läuft nicht. Starte Docker Desktop und klicke dann auf <i>Aktualisieren</i>.
            {s.dockerMessage && <small>{s.dockerMessage}</small>}
          </div>
        )}

        {s && !s.configPath && (
          <>
            <p className="muted">Dieses Projekt hat noch keinen Devcontainer. Lege einen an – mit Sprache, Build-Tools und Ports.</p>
            <button className="btn primary block" onClick={() => setDialog(true)}>
              <Icon name="plus" size={14} /> Devcontainer anlegen …
            </button>
          </>
        )}

        {s && s.configPath && (
          <>
            <div className="dc-card">
              <div className="dc-title">
                <Icon name="container" size={16} />
                <b>{s.name ?? 'Dev Container'}</b>
                <span className={`badge ${s.state}`}>
                  {s.state === 'running' ? 'läuft' : s.state === 'starting' ? 'startet …' : s.state === 'stopped' ? 'gestoppt' : 'nicht gebaut'}
                </span>
              </div>
              {s.image && <div className="muted mono small">{s.image}</div>}
              {s.remoteWorkspaceFolder && running && <div className="muted mono small">{s.remoteWorkspaceFolder}</div>}
              {s.forwardPorts.length > 0 && <div className="muted small">Ports: {s.forwardPorts.join(', ')}</div>}
            </div>

            <div className="dc-actions">
              {s.state === 'starting' || busy === 'up' || busy === 'rebuild' ? (
                <button className="btn" onClick={() => void window.api.devcontainer.cancel()}>
                  <Icon name="stop" size={13} /> Abbrechen
                </button>
              ) : running ? (
                <button className="btn primary" onClick={() => p.onNewTerminal('container')}>
                  <Icon name="terminal" size={14} /> Terminal im Container
                </button>
              ) : (
                <button className="btn primary" disabled={s.docker !== 'ok' || !!busy} onClick={() => up(false)}>
                  <Icon name="play" size={13} /> {s.state === 'stopped' ? 'Starten' : 'Bauen & starten'}
                </button>
              )}
              <button className="btn" disabled={s.docker !== 'ok' || !!busy || s.state === 'starting'} onClick={() => up(true)} title="Container löschen und ohne Cache neu bauen">
                <Icon name="refresh" size={13} /> Neu bauen
              </button>
              {running && (
                <button className="btn" disabled={!!busy} onClick={() => void act('stop', () => window.api.devcontainer.stop(root))}>
                  <Icon name="stop" size={13} /> Stoppen
                </button>
              )}
              {s.containerId && !running && (
                <button
                  className="btn"
                  disabled={!!busy}
                  onClick={() => {
                    if (confirm('Container löschen? Die Dateien im Projekt bleiben erhalten.')) void act('remove', () => window.api.devcontainer.remove(root))
                  }}
                >
                  <Icon name="trash" size={13} /> Löschen
                </button>
              )}
              <button className="btn" onClick={() => p.onOpenFile(s.configPath!)}>
                <Icon name="edit" size={13} /> devcontainer.json
              </button>
            </div>
          </>
        )}
        {busy === 'stop' && <p className="muted">Stoppe Container …</p>}
        {error && <div className="notice err">{error}</div>}
        <button className="link-btn" onClick={p.onRefreshStatus}>
          <Icon name="refresh" size={12} /> Aktualisieren
        </button>
      </section>

      {/* ---------- Build-Aufgaben ---------- */}
      <section>
        <div className="section-head">
          <h3>Build &amp; Aufgaben</h3>
          <button className="icon-btn" title="Aufgaben neu erkennen" onClick={loadTasks}>
            <Icon name="refresh" size={14} />
          </button>
        </div>
        <div className="segmented">
          <button className={target === 'local' ? 'active' : ''} onClick={() => setTarget('local')}>
            Lokal
          </button>
          <button
            className={target === 'container' ? 'active' : ''}
            disabled={!running}
            title={running ? '' : 'Devcontainer läuft nicht'}
            onClick={() => setTarget('container')}
          >
            Im Container
          </button>
        </div>

        {tasks.length === 0 && <p className="muted">Keine Build-Dateien erkannt (package.json, Makefile, Cargo.toml, go.mod, pom.xml, CMakeLists.txt …).</p>}
        {groups.map((g) => (
          <div key={g} className="task-group">
            <div className="task-group-name">{g}</div>
            {tasks
              .filter((t) => t.group === g)
              .map((t) => (
                <button key={t.command} className="task-row" title={t.command} onClick={() => p.onRun(t.command, target, t.label)}>
                  <Icon name="play" size={11} />
                  <span>{t.label}</span>
                  <code>{t.command}</code>
                </button>
              ))}
          </div>
        ))}

        <form
          className="task-custom"
          onSubmit={(e) => {
            e.preventDefault()
            if (custom.trim()) p.onRun(custom.trim(), target, custom.trim().split(' ')[0])
          }}
        >
          <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Eigener Befehl, z. B. make release" spellCheck={false} />
          <button className="icon-btn" type="submit" title="Ausführen">
            <Icon name="play" size={13} />
          </button>
        </form>
      </section>

      {dialog && (
        <DevcontainerDialog
          root={root}
          onClose={() => setDialog(false)}
          onCreated={(path, start) => {
            setDialog(false)
            p.onOpenFile(path)
            p.onRefreshStatus()
            if (start) up(false)
          }}
        />
      )}
    </div>
  )
}

function DevcontainerDialog({
  root,
  onClose,
  onCreated
}: {
  root: string
  onClose: () => void
  onCreated: (path: string, start: boolean) => void
}): React.JSX.Element {
  const [t, setT] = useState<DevcontainerTemplate | null>(null)
  const [opts, setOpts] = useState<Awaited<ReturnType<typeof window.api.devcontainer.options>> | null>(null)
  const [ports, setPorts] = useState('')
  const [preview, setPreview] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void window.api.devcontainer.options().then(setOpts)
    void window.api.devcontainer.suggest(root).then((s) => {
      setT(s)
      setPorts(s.forwardPorts.join(', '))
    })
  }, [root])

  useEffect(() => {
    if (t) void window.api.devcontainer.preview(t).then(setPreview)
  }, [t])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!t || !opts) return <div className="modal-backdrop" />

  const update = (patch: Partial<DevcontainerTemplate>): void => setT({ ...t, ...patch })

  const create = async (start: boolean): Promise<void> => {
    try {
      const path = await window.api.devcontainer.create(root, t)
      onCreated(path, start)
    } catch (err) {
      setError(errText(err))
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label="Devcontainer anlegen">
        <div className="modal-head">
          <b>Devcontainer anlegen</b>
          <button className="icon-btn" onClick={onClose} title="Schließen">
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="modal-body">
          <div className="modal-form">
            <label className="field">
              <span>Name</span>
              <input value={t.name} onChange={(e) => update({ name: e.target.value })} />
            </label>
            <label className="field">
              <span>Basis-Image</span>
              <select value={t.image} onChange={(e) => update({ image: e.target.value })}>
                {Object.entries(opts.images).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="field">
              <span>Build-Tools &amp; Features</span>
              <div className="feature-grid">
                {Object.entries(opts.features).map(([k, v]) => (
                  <label key={k} className="check">
                    <input
                      type="checkbox"
                      checked={t.features.includes(k)}
                      onChange={(e) => update({ features: e.target.checked ? [...t.features, k] : t.features.filter((f) => f !== k) })}
                    />
                    {v.label}
                  </label>
                ))}
              </div>
            </div>
            <label className="field">
              <span>Ports weiterleiten</span>
              <input
                value={ports}
                placeholder="z. B. 3000, 5173"
                onChange={(e) => {
                  setPorts(e.target.value)
                  update({
                    forwardPorts: e.target.value
                      .split(/[\s,;]+/)
                      .map(Number)
                      .filter((n) => Number.isInteger(n) && n > 0 && n < 65536)
                  })
                }}
              />
            </label>
            <label className="field">
              <span>Nach dem Erstellen ausführen</span>
              <input
                className="mono"
                value={t.postCreateCommand}
                placeholder="z. B. npm install"
                onChange={(e) => update({ postCreateCommand: e.target.value })}
              />
            </label>
          </div>
          <div className="modal-preview">
            <span className="muted small">.devcontainer/devcontainer.json</span>
            <pre>{preview}</pre>
          </div>
        </div>
        {error && <div className="notice err">{error}</div>}
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button className="btn" onClick={() => void create(false)}>
            Nur anlegen
          </button>
          <button className="btn primary" onClick={() => void create(true)}>
            Anlegen &amp; starten
          </button>
        </div>
      </div>
    </div>
  )
}
