import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CatalogEntry, DownloadProgress, EngineStatus, InstalledModel, SystemInfo, VariantEntry } from '../../../shared/types'
import { Icon } from './Icon'

const fmtGB = (b: number): string => `${(b / 1e9).toFixed(1)} GB`

const FIT_LABEL = { gut: 'Läuft flüssig', knapp: 'Knapp – andere Apps schließen', 'zu-gross': 'Zu groß für diesen Rechner' }

const SIZE_LABEL = {
  alle: 'Alle',
  klein: 'Klein (bis 8 GB RAM)',
  mittel: 'Mittel (16–64 GB)',
  groß: 'Groß (64–256 GB)',
  riesig: 'Riesig (256 GB+)'
} as const

type SortKey = 'katalog' | 'tempo' | 'klein'

/** Variante, die eine Karte zuerst zeigt: installierte, sonst die empfohlene. */
const defaultVariant = (m: CatalogEntry): VariantEntry =>
  m.variants.find((v) => v.installed) ?? m.variants.find((v) => v.id === m.recommendedVariant) ?? m.variants[0]

/** Schnellste Variante, die auf diesen Rechner passt – für Sortierung und Filter */
const bestFitting = (m: CatalogEntry): VariantEntry | undefined =>
  m.variants.filter((v) => v.fit !== 'zu-gross').sort((a, b) => (b.tokensPerSec ?? 0) - (a.tokensPerSec ?? 0))[0]

export default function ModelManager({ status }: { status: EngineStatus }): React.JSX.Element {
  const [info, setInfo] = useState<SystemInfo | null>(null)
  const [catalog, setCatalog] = useState<CatalogEntry[]>([])
  const [installed, setInstalled] = useState<InstalledModel[]>([])
  const [downloads, setDownloads] = useState<Record<string, DownloadProgress>>({})
  const [sizeFilter, setSizeFilter] = useState<keyof typeof SIZE_LABEL>('alle')
  const [onlyFitting, setOnlyFitting] = useState(false)
  const [sort, setSort] = useState<SortKey>('katalog')

  const visible = useMemo(() => {
    let list = catalog.filter((m) => (sizeFilter === 'alle' || m.sizeClass === sizeFilter) && (!onlyFitting || bestFitting(m)))
    if (sort === 'tempo') list = [...list].sort((a, b) => (bestFitting(b)?.tokensPerSec ?? 0) - (bestFitting(a)?.tokensPerSec ?? 0))
    if (sort === 'klein') list = [...list].sort((a, b) => defaultVariant(a).sizeBytes - defaultVariant(b).sizeBytes)
    return list
  }, [catalog, sizeFilter, onlyFitting, sort])

  const startDownload = (v: VariantEntry): void => {
    if (v.fit === 'zu-gross' && !confirm(`Diese Variante (${fmtGB(v.sizeBytes)}) ist zu groß für deinen Arbeitsspeicher und wird hier nicht laufen. Trotzdem herunterladen?`)) return
    setDownloads((d) => ({ ...d, [v.id]: { id: v.id, received: 0, total: v.sizeBytes, done: false } }))
    void window.api.models.download(v.id)
  }

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
          <p className="muted">Noch keine Modelle installiert. Lade unten eines herunter – „Qwen3.5 4B“ ist ein guter Start.</p>
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
        <h2>Modell-Katalog</h2>
        <p className="muted small">
          Jedes Modell gibt es in mehreren Varianten: weniger Bits = kleiner und schneller, aber etwas ungenauer. 4-Bit ist meist der
          beste Kompromiss. Modelle mit <strong>MoE</strong> rechnen pro Wort nur einen Teil ihrer Parameter und sind deshalb besonders schnell.
        </p>
        <div className="catalog-filters">
          {(['alle', 'klein', 'mittel', 'groß', 'riesig'] as const).map((c) => (
            <button key={c} className={`chip ${sizeFilter === c ? 'on' : ''}`} onClick={() => setSizeFilter(c)}>
              {SIZE_LABEL[c]}
            </button>
          ))}
          <label className="filter-check">
            <input type="checkbox" checked={onlyFitting} onChange={(e) => setOnlyFitting(e.target.checked)} /> Nur was auf diesen Mac passt
          </label>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="katalog">Nach Größe gruppiert</option>
            <option value="tempo">Schnellste zuerst</option>
            <option value="klein">Kleinste zuerst</option>
          </select>
        </div>
        {visible.length === 0 && <p className="muted">Keine Modelle für diese Auswahl.</p>}
        {sort === 'katalog' ? (
          (['klein', 'mittel', 'groß', 'riesig'] as const)
            .filter((c) => visible.some((m) => m.sizeClass === c))
            .map((c) => (
              <div key={c}>
                <h3 className="catalog-group">{SIZE_LABEL[c]}</h3>
                <div className="catalog-grid">
                  {visible
                    .filter((m) => m.sizeClass === c)
                    .map((m) => (
                      <ModelCard key={m.id} model={m} downloads={downloads} onStart={startDownload} />
                    ))}
                </div>
              </div>
            ))
        ) : (
          <div className="catalog-grid">
            {visible.map((m) => (
              <ModelCard key={m.id} model={m} downloads={downloads} onStart={startDownload} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function ModelCard({
  model: m,
  downloads,
  onStart
}: {
  model: CatalogEntry
  downloads: Record<string, DownloadProgress>
  onStart: (v: VariantEntry) => void
}): React.JSX.Element {
  const [variantId, setVariantId] = useState(() => defaultVariant(m).id)
  const v = m.variants.find((x) => x.id === variantId) ?? defaultVariant(m)
  const dl = downloads[v.id]
  const moe = m.activeParamsB < m.totalParamsB * 0.6

  return (
    <div className={`model-card fit-${v.fit}`}>
      <div className="card-top">
        <span className="model-name">{m.name}</span>
        <span className="muted small" title="Parameter insgesamt / pro Wort gerechnet">
          {fmtParams(m.totalParamsB)}
          {moe && ` · ${fmtParams(m.activeParamsB)} aktiv`}
        </span>
      </div>
      <p className="small">{m.description}</p>
      <div className="tags">
        {m.tags.map((t) => (
          <span key={t} className="tag">
            {t}
          </span>
        ))}
      </div>

      <select className="variant-select" value={v.id} onChange={(e) => setVariantId(e.target.value)}>
        {m.variants.map((x) => (
          <option key={x.id} value={x.id}>
            {x.quant} · {fmtGB(x.sizeBytes)}
            {x.files.length > 1 ? ` (${x.files.length} Teile)` : ''}
            {x.installed ? ' · ✓ installiert' : x.fit === 'zu-gross' ? ' · zu groß' : ''}
          </option>
        ))}
      </select>
      <div className="muted small">{v.label}</div>

      <div className="card-facts">
        <span className={`fit fit-${v.fit}`}>{FIT_LABEL[v.fit]}</span>
        {v.tokensPerSec !== null && <span className="speed" title="Grobe Schätzung aus Speicherbandbreite und Modellgröße">≈ {v.tokensPerSec} Wörter/s</span>}
      </div>
      <div className={`license ${m.license.commercial ? '' : 'restricted'}`} title={m.license.note}>
        Lizenz:{' '}
        <button className="text-link" onClick={() => window.api.openUrl(m.license.url)}>
          {m.license.name}
        </button>
        {!m.license.commercial && <span> · Einschränkungen</span>}
      </div>

      {dl ? (
        <div className="download">
          <div className="progress">
            <div style={{ width: `${(dl.received / dl.total) * 100}%` }} />
          </div>
          <div className="row-gap small">
            <span className="muted grow">
              {fmtGB(dl.received)} / {fmtGB(dl.total)}
            </span>
            <button className="link-btn" onClick={() => window.api.models.cancelDownload(v.id)}>
              Abbrechen
            </button>
          </div>
        </div>
      ) : v.installed ? (
        <button className="btn" disabled>
          Installiert
        </button>
      ) : (
        <button className="btn primary" onClick={() => onStart(v)}>
          <Icon name="download" size={14} /> Herunterladen ({fmtGB(v.sizeBytes)})
        </button>
      )}
    </div>
  )
}

function fmtParams(b: number): string {
  return b >= 10 ? `${Math.round(b)}B` : `${b.toLocaleString('de', { maximumFractionDigits: 1 })}B`
}
