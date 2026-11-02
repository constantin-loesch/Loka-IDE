import { useEffect, useRef, useState } from 'react'
import type { UpdateState } from '../../../shared/types'
import { Icon } from './Icon'

const DISMISSED_KEY = 'update.dismissed'

function readDismissed(): string | null {
  try {
    return localStorage.getItem(DISMISSED_KEY)
  } catch {
    return null
  }
}

/**
 * Hinweis unten rechts: neue Version verfügbar → installieren → neu starten.
 * Liefert zusätzlich einen Eintrag für die Statusleiste.
 */
export function useUpdates(): {
  state: UpdateState
  /** Hinweis-Karte (oder null) */
  notice: React.JSX.Element | null
  /** Eintrag in der Statusleiste (oder null) */
  statusItem: React.JSX.Element | null
} {
  const [state, setState] = useState<UpdateState>({ state: 'idle' })
  const [open, setOpen] = useState(true)
  const [log, setLog] = useState('')
  const [showLog, setShowLog] = useState(false)
  // „Auf dem neuesten Stand“ nur nach einer Suche von Hand anzeigen
  const manual = useRef(false)

  useEffect(() => {
    void window.api.update.state().then(setState)
    const a = window.api.update.onState((s) => {
      setState(s)
      // Eine neuere Version als die zuletzt weggeklickte: wieder zeigen
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

  // Erfolgsmeldung nach Suche von Hand verschwindet von selbst
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
        /* nur Komfort */
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
      if (manual.current) body = <p className="update-line">Suche nach Updates …</p>
      break
    case 'up-to-date':
      if (manual.current) body = <p className="update-line ok">✓ Lokal IDE ist auf dem neuesten Stand.</p>
      break
    case 'available':
      body = (
        <>
          <b className="update-title">Neue Version verfügbar</b>
          <p className="muted">
            {state.behindBy} {state.behindBy === 1 ? 'neue Änderung' : 'neue Änderungen'}:
          </p>
          <ul className="update-commits">
            {state.commits.slice(0, 6).map((c) => (
              <li key={c.sha} title={c.sha}>
                {c.message}
              </li>
            ))}
            {state.commits.length > 6 && <li className="muted">… und {state.commits.length - 6} weitere</li>}
          </ul>
          <div className="update-actions">
            <button className="btn" onClick={close}>
              Später
            </button>
            <button className="btn primary" onClick={install}>
              <Icon name="download" size={14} /> Installieren
            </button>
          </div>
        </>
      )
      break
    case 'installing':
      body = (
        <>
          <b className="update-title">Update wird installiert</b>
          <p className="update-line">
            <span className="spinner" /> {state.step} …
          </p>
          <p className="muted small">Du kannst weiterarbeiten. Zum Schluss ist nur ein Neustart nötig.</p>
          <button className="link-btn" onClick={() => setShowLog((v) => !v)}>
            {showLog ? 'Details ausblenden' : 'Details anzeigen'}
          </button>
        </>
      )
      break
    case 'ready':
      body = (
        <>
          <b className="update-title">Update ist bereit</b>
          <p className="muted">
            {state.dev ? 'Neuer Code ist geladen. Starte die App neu, um ihn zu benutzen.' : 'Die neue Version ist gebaut. Beim Neustart wird sie installiert.'}
          </p>
          <p className="muted small">Ungespeicherte Dateien vorher speichern – laufende Terminals werden beendet.</p>
          <div className="update-actions">
            <button className="btn" onClick={() => setOpen(false)}>
              Später
            </button>
            <button className="btn primary" onClick={() => void window.api.update.restart()}>
              <Icon name="refresh" size={14} /> Jetzt neu starten
            </button>
          </div>
        </>
      )
      break
    case 'error':
      body = (
        <>
          <b className="update-title err-text">Update fehlgeschlagen</b>
          <p className="update-error">{state.message}</p>
          <div className="update-actions">
            {log && (
              <button className="link-btn" onClick={() => setShowLog((v) => !v)}>
                {showLog ? 'Details ausblenden' : 'Details'}
              </button>
            )}
            <span className="spacer" />
            <button className="btn" onClick={close}>
              Schließen
            </button>
            <button
              className="btn primary"
              onClick={() => {
                manual.current = true
                void window.api.update.check()
              }}
            >
              Erneut prüfen
            </button>
          </div>
        </>
      )
      break
  }

  const notice =
    open && body ? (
      <div className="update-notice" role="status">
        <button className="icon-btn update-close" title="Schließen" onClick={close}>
          <Icon name="close" size={14} />
        </button>
        {body}
        {showLog && log && <UpdateLog text={log} />}
      </div>
    ) : null

  let statusItem: React.JSX.Element | null = null
  if (state.state === 'available' || state.state === 'installing' || state.state === 'ready') {
    const label = state.state === 'available' ? 'Update verfügbar' : state.state === 'installing' ? 'Update wird installiert …' : 'Neustart für Update'
    statusItem = (
      <button className="status-item update" onClick={() => setOpen(true)} title="Update anzeigen">
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
