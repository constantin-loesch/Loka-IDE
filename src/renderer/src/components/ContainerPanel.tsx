import { useCallback, useEffect, useState } from 'react'
import type { BuildTask, DevcontainerStatus, DevcontainerTemplate, TerminalTarget } from '../../../shared/types'
import { Icon } from './Icon'
import { t } from '../i18n'

interface Props {
  root: string | null
  status: DevcontainerStatus | null
  onRefreshStatus: () => void
  onOpenFolder: () => void
  onOpenFile: (path: string) => void
  /** Run a command in a new terminal */
  onRun: (command: string, target: TerminalTarget, title: string) => void
  onNewTerminal: (target: TerminalTarget) => void
  /** Show the output panel (container log) */
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
  // If the container is running, run tasks there by default
  useEffect(() => setTarget(running ? 'container' : 'local'), [running])

  if (!p.root) {
    return (
      <div className="empty-hint">
        <p>{t('No folder open.')}</p>
        <button className="btn primary" onClick={p.onOpenFolder}>
          {t('Open Folder')}
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

  const groups = [...new Set(tasks.map((task) => task.group))]

  return (
    <div className="container-panel">
      {/* ---------- Dev container ---------- */}
      <section>
        <h3>{t('Dev container')}</h3>
        {!s && <p className="muted">{t('Checking Docker …')}</p>}

        {s && s.docker === 'missing' && (
          <div className="notice warn">
            {t('Docker is not installed. Dev containers need')}{' '}
            <button className="link-btn inline" onClick={() => void window.api.openUrl('https://www.docker.com/products/docker-desktop/')}>
              Docker Desktop
            </button>{' '}
            {t('(or Docker Engine, OrbStack, Colima).')}
          </div>
        )}
        {s && s.docker === 'not-running' && (
          <div className="notice warn">
            {t('Docker is not running. Start Docker Desktop and then click')} <i>{t('Refresh')}</i>.
            {s.dockerMessage && <small>{s.dockerMessage}</small>}
          </div>
        )}

        {s && !s.configPath && (
          <>
            <p className="muted">{t('This project has no dev container yet. Create one – with language, build tools and ports.')}</p>
            <button className="btn primary block" onClick={() => setDialog(true)}>
              <Icon name="plus" size={14} /> {t('Create dev container …')}
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
                  {s.state === 'running' ? t('running') : s.state === 'starting' ? t('starting …') : s.state === 'stopped' ? t('stopped') : t('not built')}
                </span>
              </div>
              {s.image && <div className="muted mono small">{s.image}</div>}
              {s.remoteWorkspaceFolder && running && <div className="muted mono small">{s.remoteWorkspaceFolder}</div>}
              {s.forwardPorts.length > 0 && <div className="muted small">Ports: {s.forwardPorts.join(', ')}</div>}
            </div>

            <div className="dc-actions">
              {s.state === 'starting' || busy === 'up' || busy === 'rebuild' ? (
                <button className="btn" onClick={() => void window.api.devcontainer.cancel()}>
                  <Icon name="stop" size={13} /> {t('Cancel')}
                </button>
              ) : running ? (
                <button className="btn primary" onClick={() => p.onNewTerminal('container')}>
                  <Icon name="terminal" size={14} /> {t('Terminal in container')}
                </button>
              ) : (
                <button className="btn primary" disabled={s.docker !== 'ok' || !!busy} onClick={() => up(false)}>
                  <Icon name="play" size={13} /> {s.state === 'stopped' ? t('Start') : t('Build & start')}
                </button>
              )}
              <button className="btn" disabled={s.docker !== 'ok' || !!busy || s.state === 'starting'} onClick={() => up(true)} title={t('Delete the container and rebuild it without cache')}>
                <Icon name="refresh" size={13} /> {t('Rebuild')}
              </button>
              {running && (
                <button className="btn" disabled={!!busy} onClick={() => void act('stop', () => window.api.devcontainer.stop(root))}>
                  <Icon name="stop" size={13} /> {t('Stop')}
                </button>
              )}
              {s.containerId && !running && (
                <button
                  className="btn"
                  disabled={!!busy}
                  onClick={() => {
                    if (confirm(t('Delete the container? The files in the project are kept.'))) void act('remove', () => window.api.devcontainer.remove(root))
                  }}
                >
                  <Icon name="trash" size={13} /> {t('Delete')}
                </button>
              )}
              <button className="btn" onClick={() => p.onOpenFile(s.configPath!)}>
                <Icon name="edit" size={13} /> devcontainer.json
              </button>
            </div>
          </>
        )}
        {busy === 'stop' && <p className="muted">{t('Stopping container …')}</p>}
        {error && <div className="notice err">{error}</div>}
        <button className="link-btn" onClick={p.onRefreshStatus}>
          <Icon name="refresh" size={12} /> {t('Refresh')}
        </button>
      </section>

      {/* ---------- Build tasks ---------- */}
      <section>
        <div className="section-head">
          <h3>{t('Build & Tasks')}</h3>
          <button className="icon-btn" title={t('Detect tasks again')} onClick={loadTasks}>
            <Icon name="refresh" size={14} />
          </button>
        </div>
        <div className="segmented">
          <button className={target === 'local' ? 'active' : ''} onClick={() => setTarget('local')}>
            {t('Local')}
          </button>
          <button
            className={target === 'container' ? 'active' : ''}
            disabled={!running}
            title={running ? '' : t('Dev container is not running')}
            onClick={() => setTarget('container')}
          >
            {t('In container')}
          </button>
        </div>

        {tasks.length === 0 && <p className="muted">{t('No build files detected (package.json, Makefile, Cargo.toml, go.mod, pom.xml, CMakeLists.txt …).')}</p>}
        {groups.map((g) => (
          <div key={g} className="task-group">
            <div className="task-group-name">{g}</div>
            {tasks
              .filter((task) => task.group === g)
              .map((task) => (
                <button key={task.command} className="task-row" title={task.command} onClick={() => p.onRun(task.command, target, task.label)}>
                  <Icon name="play" size={11} />
                  <span>{t(task.label)}</span>
                  <code>{task.command}</code>
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
          <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder={t('Own command, e.g. make release')} spellCheck={false} />
          <button className="icon-btn" type="submit" title={t('Run')}>
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
  const [tpl, setTpl] = useState<DevcontainerTemplate | null>(null)
  const [opts, setOpts] = useState<Awaited<ReturnType<typeof window.api.devcontainer.options>> | null>(null)
  const [ports, setPorts] = useState('')
  const [preview, setPreview] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void window.api.devcontainer.options().then(setOpts)
    void window.api.devcontainer.suggest(root).then((s) => {
      setTpl(s)
      setPorts(s.forwardPorts.join(', '))
    })
  }, [root])

  useEffect(() => {
    if (tpl) void window.api.devcontainer.preview(tpl).then(setPreview)
  }, [tpl])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!tpl || !opts) return <div className="modal-backdrop" />

  const update = (patch: Partial<DevcontainerTemplate>): void => setTpl({ ...tpl, ...patch })

  const create = async (start: boolean): Promise<void> => {
    try {
      const path = await window.api.devcontainer.create(root, tpl)
      onCreated(path, start)
    } catch (err) {
      setError(errText(err))
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label="Devcontainer anlegen">
        <div className="modal-head">
          <b>{t('Create dev container')}</b>
          <button className="icon-btn" onClick={onClose} title={t('Close')}>
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="modal-body">
          <div className="modal-form">
            <label className="field">
              <span>{t('Name')}</span>
              <input value={tpl.name} onChange={(e) => update({ name: e.target.value })} />
            </label>
            <label className="field">
              <span>{t('Base image')}</span>
              <select value={tpl.image} onChange={(e) => update({ image: e.target.value })}>
                {Object.entries(opts.images).map(([k, v]) => (
                  <option key={k} value={k}>
                    {t(v.label)}
                  </option>
                ))}
              </select>
            </label>
            <div className="field">
              <span>{t('Build tools & features')}</span>
              <div className="feature-grid">
                {Object.entries(opts.features).map(([k, v]) => (
                  <label key={k} className="check">
                    <input
                      type="checkbox"
                      checked={tpl.features.includes(k)}
                      onChange={(e) => update({ features: e.target.checked ? [...tpl.features, k] : tpl.features.filter((f) => f !== k) })}
                    />
                    {t(v.label)}
                  </label>
                ))}
              </div>
            </div>
            <label className="field">
              <span>{t('Forward ports')}</span>
              <input
                value={ports}
                placeholder={t('e.g. 3000, 5173')}
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
              <span>{t('Run after creating')}</span>
              <input
                className="mono"
                value={tpl.postCreateCommand}
                placeholder={t('e.g. npm install')}
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
            {t('Cancel')}
          </button>
          <button className="btn" onClick={() => void create(false)}>
            {t('Create only')}
          </button>
          <button className="btn primary" onClick={() => void create(true)}>
            {t('Create & start')}
          </button>
        </div>
      </div>
    </div>
  )
}
