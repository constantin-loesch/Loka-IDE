import { useCallback, useEffect, useState } from 'react'
import type { CatalogEntry, DownloadProgress, EngineStatus, InstalledModel, SystemInfo } from '../../../shared/types'
import { Icon } from './Icon'

const fmtGB = (b: number): string => `${(b / 1e9).toFixed(1)} GB`

const FIT_LABEL = { gut: 'Läuft flüssig', knapp: 'Knapp – andere Apps schließen', 'zu-gross': 'Zu groß für diesen Rechner' }

export default function ModelManager({ status }: { status: EngineStatus }): React.JSX.Element {
  const [info, setInfo] = useState<SystemInfo | null>(null)
  const [catalog, setCatalog] = useState<CatalogEntry[]>([])
  const [installed, setInstalled] = useState<InstalledModel[]>([])
  const [downloads, setDownloads] = useState<Record<string, DownloadProgress>>({})

  const refresh = useCallback(async () => {
    const [c, i] = await Promise.all([window.api.models.catalog(), window.api.models.installed()])
    setCatalog(c)
    setInstalled(i)
  }, [])

  useEffect(() => {
    window.api.system.info().then(setInfo)
    refresh()
    return window.api.models.onProgress((p) => {
      setDownloads((d) => {
        const next = { ...d }
        if (p.done) delete next[p.id]
        else next[p.id] = p
        return next
      })
      if (p.done) {
        if (p.error && p.error !== 'Abgebrochen') alert(`Download fehlgeschlagen: ${p.error}`)
        refresh()
      }
    })
  }, [refresh])

  const loadedPath = status.state === 'ready' || status.state === 'loading' ? status.modelPath : null

  const remove = async (m: InstalledModel): Promise<void> => {
    const msg = m.external
      ? `„${m.name}“ aus der Liste entfernen? Die Datei selbst bleibt erhalten.`
      : `„${m.name}“ löschen? Die Datei (${fmtGB(m.sizeBytes)}) wird von der Festplatte entfernt.`
    if (!confirm(msg)) return
    await window.api.models.remove(m.path)
    refresh()
  }

  return (
    <div className="models-page">
      <header className="models-header">
        <div>
          <h1>Lokale Modelle</h1>
          <p className="muted">
            Modelle laufen komplett auf deinem Rechner. Nichts verlässt dein Gerät.
            {info && (
              <>
                {' '}
                Dein System: <strong>{info.cpu}</strong>, <strong>{Math.round(info.totalMemBytes / 1024 ** 3)} GB RAM</strong>.
              </>
            )}
          </p>
        </div>
        <div className="row-gap">
          <button className="btn" onClick={async () => (await window.api.models.import()) && refresh()}>
            <Icon name="plus" size={14} /> GGUF-Datei importieren
          </button>
          <button className="btn" onClick={() => window.api.system.revealModels()}>
            Ordner anzeigen
          </button>
        </div>
      </header>

      <section>
        <h2>Installiert</h2>
        {installed.length === 0 ? (
          <p className="muted">Noch keine Modelle installiert. Lade unten eines herunter – „Qwen2.5 Coder 3B“ ist ein guter Start.</p>
        ) : (
          <div className="installed-list">
            {installed.map((m) => {
              const isLoaded = loadedPath === m.path
              return (
                <div key={m.path} className={`installed-row ${isLoaded ? 'loaded' : ''}`}>
                  <div className="grow">
                    <div className="model-name">{m.name}</div>
                    <div className="muted small">
                      {fmtGB(m.sizeBytes)}
                      {m.external && ' · importiert'}
                      {isLoaded && status.state === 'loading' && ` · lädt ${Math.round(status.progress * 100)} %`}
                      {isLoaded && status.state === 'ready' && ` · aktiv auf ${status.gpu.toUpperCase()}`}
                    </div>
                  </div>
                  {isLoaded ? (
                    <button className="btn" onClick={() => window.api.engine.unload()}>
                      Entladen
                    </button>
                  ) : (
                    <button className="btn primary" onClick={() => window.api.engine.load(m.path)}>
                      Laden
                    </button>
                  )}
                  <button className="icon-btn" title="Entfernen" onClick={() => remove(m)}>
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
        {status.state === 'error' && <p className="error-box">{status.message}</p>}
      </section>

      <section>
        <h2>Empfohlene Modelle</h2>
        <div className="catalog-grid">
          {catalog.map((m) => {
            const dl = downloads[m.id]
            return (
              <div key={m.id} className={`model-card fit-${m.fit}`}>
                <div className="card-top">
                  <span className="model-name">{m.name}</span>
                  <span className="muted small">{fmtGB(m.sizeBytes)}</span>
                </div>
                <p className="small">{m.description}</p>
                <div className="tags">
                  {m.tags.map((t) => (
                    <span key={t} className="tag">
                      {t}
                    </span>
                  ))}
                </div>
                <div className={`fit fit-${m.fit}`}>{FIT_LABEL[m.fit]}</div>
                {dl ? (
                  <div className="download">
                    <div className="progress">
                      <div style={{ width: `${(dl.received / dl.total) * 100}%` }} />
                    </div>
                    <div className="row-gap small">
                      <span className="muted grow">
                        {fmtGB(dl.received)} / {fmtGB(dl.total)}
                      </span>
                      <button className="link-btn" onClick={() => window.api.models.cancelDownload(m.id)}>
                        Abbrechen
                      </button>
                    </div>
                  </div>
                ) : m.installed ? (
                  <button className="btn" disabled>
                    Installiert
                  </button>
                ) : (
                  <button
                    className="btn primary"
                    onClick={() => {
                      if (m.fit === 'zu-gross' && !confirm('Dieses Modell ist wahrscheinlich zu groß für deinen Arbeitsspeicher. Trotzdem herunterladen?')) return
                      setDownloads((d) => ({ ...d, [m.id]: { id: m.id, received: 0, total: m.sizeBytes, done: false } }))
                      window.api.models.download(m.id)
                    }}
                  >
                    <Icon name="download" size={14} /> Herunterladen
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
