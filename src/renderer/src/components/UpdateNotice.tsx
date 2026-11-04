import { useEffect, useRef, useState } from 'react'
import type { UpdateState } from '../../../shared/types'
import { Icon } from './Icon'
import { t } from '../i18n'

const DISMISSED_KEY = 'update.dismissed'

function readDismissed(): string | null {
  try {
    return localStorage.getItem(DISMISSED_KEY)
  } catch {
    return null
  }
}

/**
 * Notice at the bottom right: new version available → install → restart.
 * Also returns an entry for the status bar.
 */
export function useUpdates(): {
  state: UpdateState
  /** Notice card (or null) */
  notice: React.JSX.Element | null
  /** Status bar entry (or null) */
  statusItem: React.JSX.Element | null
} {
  const [state, setState] = useState<UpdateState>({ state: 'idle' })
  const [open, setOpen] = useState(true)
  const [log, setLog] = useState('')
  const [showLog, setShowLog] = useState(false)
  // Show “up to date” only after a manual check
  const manual = useRef(false)

  useEffect(() => {
    void window.api.update.state().then(setState)
    const a = window.api.update.onState((s) => {
      setState(s)
      // A newer version than the last dismissed one: show again
      if (s.state === 'available') setOpen(manual.current || s.latest !== readDismissed())
      if (s.state === 'installing' || s.state === 'ready' || s.state === 'error') setOpen(true)
    })
    const b = window.api.update.onLog((t) => setLog((prev) => (prev + t).slice(-100_000)))
    const c = window.api.menu.onCheckUpdates(() => {
      manual.current = true
      setOpen(true)
      void window.api.update.check()
    })
    return () => {
      a()
      b()
      c()
    }
  }, [])

  // Success message after a manual check disappears by itself
  useEffect(() => {
    if (state.state !== 'up-to-date' || !manual.current) return
    const t = setTimeout(() => {
      manual.current = false
      setOpen(false)
    }, 4000)
    return () => clearTimeout(t)
  }, [state])

  const close = (): void => {
    if (state.state === 'available') {
      try {
        localStorage.setItem(DISMISSED_KEY, state.latest)
      } catch {
        /* convenience only */
      }
    }
    manual.current = false
    setOpen(false)
  }

  const install = (): void => {
    setLog('')
    void window.api.update.install()
  }

  let body: React.JSX.Element | null = null
  switch (state.state) {
    case 'checking':
      if (manual.current) body = <p className="update-line">{t('Checking for updates …')}</p>
      break
    case 'up-to-date':
      if (manual.current) body = <p className="update-line ok">✓ {t('Lokal IDE is up to date.')}</p>
      break
    case 'available':
      body = (
        <>
          <b className="update-title">{t('New version available')}</b>
          <p className="muted">
            {state.behindBy === 1 ? t('1 new change:') : t('{count} new changes:', { count: state.behindBy })}
          </p>
          <ul className="update-commits">
            {state.commits.slice(0, 6).map((c) => (
              <li key={c.sha} title={c.sha}>
                {c.message}
              </li>
            ))}
            {state.commits.length > 6 && <li className="muted">{t('… and {count} more', { count: state.commits.length - 6 })}</li>}
          </ul>
          <div className="update-actions">
            <button className="btn" onClick={close}>
              {t('Later')}
            </button>
            <button className="btn primary" onClick={install}>
              <Icon name="download" size={14} /> {t('Install')}
            </button>
          </div>
        </>
      )
      break
    case 'installing':
      body = (
        <>
          <b className="update-title">{t('Installing update')}</b>
          <p className="update-line">
            <span className="spinner" /> {state.step} …
          </p>
          <p className="muted small">{t('You can keep working. Only a restart is needed at the end.')}</p>
          <button className="link-btn" onClick={() => setShowLog((v) => !v)}>
            {showLog ? t('Hide details') : t('Show details')}
          </button>
        </>
      )
      break
    case 'ready':
      body = (
        <>
          <b className="update-title">{t('Update is ready')}</b>
          <p className="muted">
            {state.dev ? t('New code is loaded. Restart the app to use it.') : t('The new version is built. It will be installed on restart.')}
          </p>
          {state.installTo && <p className="muted small mono update-path">→ {state.installTo}</p>}
          <p className="muted small">{t('Save unsaved files first – running terminals will be closed.')}</p>
          <div className="update-actions">
            <button className="btn" onClick={() => setOpen(false)}>
              {t('Later')}
            </button>
            <button className="btn primary" onClick={() => void window.api.update.restart()}>
              <Icon name="refresh" size={14} /> {t('Restart now')}
            </button>
          </div>
        </>
      )
      break
    case 'error':
      body = (
        <>
          <b className="update-title err-text">{t('Update failed')}</b>
          <p className="update-error">{state.message}</p>
          <div className="update-actions">
            {log && (
              <button className="link-btn" onClick={() => setShowLog((v) => !v)}>
                {showLog ? t('Hide details') : t('Details')}
              </button>
            )}
            <span className="spacer" />
            <button className="btn" onClick={close}>
              {t('Close')}
            </button>
            <button
              className="btn primary"
              onClick={() => {
                manual.current = true
                void window.api.update.check()
              }}
            >
              {t('Check again')}
            </button>
          </div>
        </>
      )
      break
  }

  const notice =
    open && body ? (
      <div className="update-notice" role="status">
        <button className="icon-btn update-close" title={t('Close')} onClick={close}>
          <Icon name="close" size={14} />
        </button>
        {body}
        {showLog && log && <UpdateLog text={log} />}
      </div>
    ) : null

  let statusItem: React.JSX.Element | null = null
  if (state.state === 'available' || state.state === 'installing' || state.state === 'ready') {
    const label = state.state === 'available' ? t('Update available') : state.state === 'installing' ? t('Installing update …') : t('Restart for update')
    statusItem = (
      <button className="status-item update" onClick={() => setOpen(true)} title={t('Show update')}>
        <Icon name="arrow-up" size={13} /> {label}
      </button>
    )
  }

  return { state, notice, statusItem }
}

function UpdateLog({ text }: { text: string }): React.JSX.Element {
  const ref = useRef<HTMLPreElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [text])
  return (
    <pre className="update-log" ref={ref}>
      {text}
    </pre>
  )
}
