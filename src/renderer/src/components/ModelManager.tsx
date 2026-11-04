import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CatalogEntry, DownloadProgress, EngineStatus, HardwareInfo, InstalledModel, SystemInfo, VariantEntry } from '../../../shared/types'
import { Icon } from './Icon'
import { locale, t } from '../i18n'

const fmtGB = (b: number): string => `${(b / 1e9).toFixed(1)} GB`

const FIT_LABEL = { good: 'Runs smoothly', tight: 'Tight – close other apps', 'too-large': 'Too large for this machine' }

const GPU_LABEL = { metal: 'Metal GPU', cuda: 'CUDA (NVIDIA)', vulkan: 'Vulkan GPU', cpu: 'CPU only' }

const SIZE_LABEL = {
  all: 'All',
  small: 'Small (up to 8 GB RAM)',
  medium: 'Medium (16–64 GB)',
  large: 'Large (64–256 GB)',
  huge: 'Huge (256 GB+)'
} as const

type SortKey = 'catalog' | 'speed' | 'small'

/** Variant a card shows first: the installed one, otherwise the recommended one. */
const defaultVariant = (m: CatalogEntry): VariantEntry =>
  m.variants.find((v) => v.installed) ?? m.variants.find((v) => v.id === m.recommendedVariant) ?? m.variants[0]

/** Fastest variant that fits this machine – for sorting and filtering */
const bestFitting = (m: CatalogEntry): VariantEntry | undefined =>
  m.variants.filter((v) => v.fit !== 'too-large').sort((a, b) => (b.tokensPerSec ?? 0) - (a.tokensPerSec ?? 0))[0]

export default function ModelManager({ status }: { status: EngineStatus }): React.JSX.Element {
  const [info, setInfo] = useState<SystemInfo | null>(null)
  const [hw, setHw] = useState<HardwareInfo | null>(null)
  const [catalog, setCatalog] = useState<CatalogEntry[]>([])
  const [installed, setInstalled] = useState<InstalledModel[]>([])
  const [downloads, setDownloads] = useState<Record<string, DownloadProgress>>({})
  const [sizeFilter, setSizeFilter] = useState<keyof typeof SIZE_LABEL>('all')
  const [onlyFitting, setOnlyFitting] = useState(false)
  const [sort, setSort] = useState<SortKey>('catalog')

  const visible = useMemo(() => {
    let list = catalog.filter((m) => (sizeFilter === 'all' || m.sizeClass === sizeFilter) && (!onlyFitting || bestFitting(m)))
    if (sort === 'speed') list = [...list].sort((a, b) => (bestFitting(b)?.tokensPerSec ?? 0) - (bestFitting(a)?.tokensPerSec ?? 0))
    if (sort === 'small') list = [...list].sort((a, b) => defaultVariant(a).sizeBytes - defaultVariant(b).sizeBytes)
    return list
  }, [catalog, sizeFilter, onlyFitting, sort])

  const startDownload = (v: VariantEntry): void => {
    if (v.fit === 'too-large' && !confirm(t('This variant ({size}) is too large for your memory and won\'t run here. Download anyway?', { size: fmtGB(v.sizeBytes) }))) return
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
    window.api.system.hardware().then(setHw).catch(() => setHw(null))
    refresh()
    return window.api.models.onProgress((p) => {
      setDownloads((d) => {
        const next = { ...d }
        if (p.done) delete next[p.id]
        else next[p.id] = p
        return next
      })
      if (p.done) {
        if (p.error && p.error !== 'cancelled') alert(t('Download failed: {error}', { error: p.error }))
        refresh()
      }
    })
  }, [refresh])

  const loadedPath = status.state === 'ready' || status.state === 'loading' ? status.modelPath : null

  const remove = async (m: InstalledModel): Promise<void> => {
    const msg = m.external
      ? t('Remove “{name}” from the list? The file itself is kept.', { name: m.name })
      : t('Delete “{name}”? The file ({size}) will be removed from the disk.', { name: m.name, size: fmtGB(m.sizeBytes) })
    if (!confirm(msg)) return
    await window.api.models.remove(m.path)
    refresh()
  }

  return (
    <div className="models-page">
      <header className="models-header">
        <div>
          <h1>{t('Local Models')}</h1>
          <p className="muted">
            {t('Models run entirely on your machine. Nothing leaves your device.')}
            {info && (
              <>
                {' '}
                {t('Your system:')} <strong>{info.cpu}</strong>, <strong>{Math.round(info.totalMemBytes / 1024 ** 3)} GB RAM</strong>
                {hw && (
                  <>
                    {', '}
                    <strong>{t(GPU_LABEL[hw.gpu])}</strong>
                    {hw.gpuNames.length > 0 && !hw.unifiedMemory && ` (${hw.gpuNames.join(', ')}, ${Math.round(hw.vramBytes / 1024 ** 3)} GB VRAM)`}
                  </>
                )}
                .
              </>
            )}
          </p>
        </div>
        <div className="row-gap">
          <button className="btn" onClick={async () => (await window.api.models.import()) && refresh()}>
            <Icon name="plus" size={14} /> {t('Import GGUF file')}
          </button>
          <button className="btn" onClick={() => window.api.system.revealModels()}>
            {t('Show folder')}
          </button>
        </div>
      </header>

      <section>
        <h2>{t('Installed')}</h2>
        {installed.length === 0 ? (
          <p className="muted">{t('No models installed yet. Download one below – “Qwen3.5 4B” is a good start.')}</p>
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
                    {m.external && ` · ${t('imported')}`}
                    {isLoaded && status.state === 'loading' && ` · ${t('loading {percent} %', { percent: Math.round(status.progress * 100) })}`}
                    {isLoaded && status.state === 'ready' && ` · ${t('active on {gpu}', { gpu: status.gpu.toUpperCase() })}`}
                    </div>
                  </div>
                  {isLoaded ? (
                    <button className="btn" onClick={() => window.api.engine.unload()}>
                      {t('Unload')}
                    </button>
                  ) : (
                    <button className="btn primary" onClick={() => window.api.engine.load(m.path)}>
                      {t('Load')}
                    </button>
                  )}
                  <button className="icon-btn" title={t('Remove')} onClick={() => remove(m)}>
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
        <h2>{t('Model catalog')}</h2>
        <p className="muted small">
          {t('Every model comes in several variants: fewer bits = smaller and faster, but slightly less accurate. 4-bit is usually the best compromise. Models with MoE compute only part of their parameters per word and are therefore especially fast.')}
        </p>
        <div className="catalog-filters">
          {(['all', 'small', 'medium', 'large', 'huge'] as const).map((c) => (
            <button key={c} className={`chip ${sizeFilter === c ? 'on' : ''}`} onClick={() => setSizeFilter(c)}>
              {t(SIZE_LABEL[c])}
            </button>
          ))}
          <label className="filter-check">
            <input type="checkbox" checked={onlyFitting} onChange={(e) => setOnlyFitting(e.target.checked)} /> {t('Only what fits this machine')}
          </label>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="catalog">{t('Grouped by size')}</option>
            <option value="speed">{t('Fastest first')}</option>
            <option value="small">{t('Smallest first')}</option>
          </select>
        </div>
        {visible.length === 0 && <p className="muted">{t('No models for this selection.')}</p>}
        {sort === 'catalog' ? (
          (['small', 'medium', 'large', 'huge'] as const)
            .filter((c) => visible.some((m) => m.sizeClass === c))
            .map((c) => (
              <div key={c}>
                <h3 className="catalog-group">{t(SIZE_LABEL[c])}</h3>
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
        <span className="muted small" title={t('Total parameters / computed per word')}>
          {fmtParams(m.totalParamsB)}
          {moe && ` · ${t('{params} active', { params: fmtParams(m.activeParamsB) })}`}
        </span>
      </div>
      <p className="small">{t(m.description)}</p>
      <div className="tags">
        {m.tags.map((tag) => (
          <span key={tag} className="tag">
            {t(tag)}
          </span>
        ))}
      </div>

      <select className="variant-select" value={v.id} onChange={(e) => setVariantId(e.target.value)}>
        {m.variants.map((x) => (
          <option key={x.id} value={x.id}>
            {x.quant} · {fmtGB(x.sizeBytes)}
            {x.files.length > 1 ? ` (${t('{count} parts', { count: x.files.length })})` : ''}
            {x.installed ? ` · ✓ ${t('installed')}` : x.fit === 'too-large' ? ` · ${t('too large')}` : ''}
          </option>
        ))}
      </select>
      <div className="muted small">{t(v.label)}</div>

      <div className="card-facts">
        <span className={`fit fit-${v.fit}`} title={v.fitNote}>
          {v.fitNote ? t('Partly on the CPU') : t(FIT_LABEL[v.fit])}
        </span>
        {v.tokensPerSec !== null && <span className="speed" title={t('Rough estimate from memory bandwidth and model size')}>≈ {t('{count} words/s', { count: v.tokensPerSec })}</span>}
      </div>
      <div className={`license ${m.license.commercial ? '' : 'restricted'}`} title={m.license.note ? t(m.license.note) : undefined}>
        {t('License:')}{' '}
        <button className="text-link" onClick={() => window.api.openUrl(m.license.url)}>
          {m.license.name}
        </button>
        {!m.license.commercial && <span> · {t('Restrictions')}</span>}
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
              {t('Cancel')}
            </button>
          </div>
        </div>
      ) : v.installed ? (
        <button className="btn" disabled>
          {t('Installed')}
        </button>
      ) : (
        <button className="btn primary" onClick={() => onStart(v)}>
          <Icon name="download" size={14} /> {t('Download ({size})', { size: fmtGB(v.sizeBytes) })}
        </button>
      )}
    </div>
  )
}

function fmtParams(b: number): string {
  return b >= 10 ? `${Math.round(b)}B` : `${b.toLocaleString(locale, { maximumFractionDigits: 1 })}B`
}
