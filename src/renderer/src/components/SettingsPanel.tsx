import { useEffect, useRef, useState } from 'react'
import { LOAD_SETTINGS, type EngineStatus, type ModelSettings } from '../../../shared/types'
import { locale, t } from '../i18n'

interface Props {
  status: EngineStatus
}

const CONTEXT_SIZES = [2048, 4096, 8192, 16384, 32768, 65536]

/** Adjustable model parameters and the UI language. Changes are saved automatically. */
export default function SettingsPanel({ status }: Props): React.JSX.Element {
  const [s, setS] = useState<ModelSettings | null>(null)
  const [needsReload, setNeedsReload] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const pending = useRef<Partial<ModelSettings>>({})

  useEffect(() => {
    window.api.settings.get().then(setS)
  }, [])

  // After reloading, the load settings apply again
  useEffect(() => {
    if (status.state === 'loading') setNeedsReload(false)
  }, [status.state])

  if (!s) return <div className="empty-hint">{t('Loading …')}</div>

  /** Show immediately, save in batches (sliders fire very often). */
  const set = <K extends keyof ModelSettings>(key: K, value: ModelSettings[K]): void => {
    setS((prev) => (prev ? { ...prev, [key]: value } : prev))
    pending.current[key] = value
    if (LOAD_SETTINGS.includes(key) && status.state === 'ready') setNeedsReload(true)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const patch = pending.current
      pending.current = {}
      void window.api.settings.update(patch)
    }, 300)
  }

  const resetAll = async (): Promise<void> => {
    if (!confirm(t('Reset all model settings to default?'))) return
    const defaults = await window.api.settings.defaults()
    const loadChanged = LOAD_SETTINGS.some((k) => defaults[k] !== s[k])
    // The language is not a model setting – keep it
    setS(await window.api.settings.update({ ...defaults, language: s.language }))
    if (loadChanged && status.state === 'ready') setNeedsReload(true)
  }

  const reload = (): void => {
    if (status.state === 'ready') void window.api.engine.load(status.modelPath)
  }

  return (
    <div className="settings">
      {needsReload && (
        <div className="settings-reload">
          <span>{t('This change only applies after reloading the model.')}</span>
          <button className="btn primary" onClick={reload}>
            {t('Reload now')}
          </button>
        </div>
      )}

      <h3>{t('Language')}</h3>
      <label className="settings-field">
        <select value={s.language ?? 'auto'} onChange={(e) => void window.api.settings.update({ language: e.target.value as ModelSettings['language'] })}>
          <option value="auto">{t('Automatic (system language)')}</option>
          <option value="en">English</option>
          <option value="de">Deutsch</option>
        </select>
        <small>{t('The window reloads in the new language.')}</small>
      </label>

      <h3>{t('Answer')}</h3>
      <Slider label={t('Temperature')} hint={t('Higher = more creative, lower = more precise')} min={0} max={2} step={0.05} value={s.temperature} onChange={(v) => set('temperature', v)} />
      <Slider label="Top-P" hint={t('Only the most likely words up to this share')} min={0} max={1} step={0.01} value={s.topP} onChange={(v) => set('topP', v)} />
      <Slider label="Top-K" hint={t('Only choose from the K most likely words (0 = off)')} min={0} max={200} step={1} value={s.topK} onChange={(v) => set('topK', v)} />
      <Slider label="Min-P" hint={t('Filter out unlikely words')} min={0} max={1} step={0.01} value={s.minP} onChange={(v) => set('minP', v)} />
      <Slider label={t('Repetition penalty')} hint={t('Against endless loops (1 = off)')} min={1} max={2} step={0.01} value={s.repeatPenalty} onChange={(v) => set('repeatPenalty', v)} />
      <Slider label={t('… considers the last tokens')} min={0} max={512} step={16} value={s.repeatLastTokens} onChange={(v) => set('repeatLastTokens', v)} />

      <NumberField label={t('Max. answer length (tokens)')} hint={t('Empty = unlimited')} value={s.maxTokens || null} onChange={(v) => set('maxTokens', v ?? 0)} />
      <NumberField label="Seed" hint={t('Same seed = same answer. Empty = random')} value={s.seed} onChange={(v) => set('seed', v)} />
      <NumberField label={t('Thinking budget (tokens)')} hint={t('For models with a thinking mode. Empty = default, 0 = no thinking')} value={s.thoughtTokens} onChange={(v) => set('thoughtTokens', v)} />

      <h3>{t('Coding agent')}</h3>
      <label className="settings-field">
        <span>{t('Approvals')}</span>
        <select value={s.approvalMode} onChange={(e) => set('approvalMode', e.target.value as ModelSettings['approvalMode'])}>
          <option value="ask">{t('Always ask (recommended)')}</option>
          <option value="auto-edits">{t('File changes automatically, ask for commands')}</option>
          <option value="auto-all">{t('Everything automatically')}</option>
        </select>
        <small>{t('Dangerous commands (e.g. sudo, rm -rf, git push) are always asked for. The model only works in the project folder.')}</small>
      </label>
      <Slider label={t('Max. tool calls per answer')} hint={t('How often the model may read, change or run commands')} min={1} max={50} step={1} value={s.maxToolCalls} onChange={(v) => set('maxToolCalls', v)} />
      <Slider label={t('Time limit for commands (seconds)')} hint={t('After that a terminal command is aborted')} min={10} max={600} step={10} value={s.commandTimeout} onChange={(v) => set('commandTimeout', v)} />

      <h3>{t('System prompt')}</h3>
      <p className="settings-hint">{t('Basic instruction to the model. Applies from the next new chat.')}</p>
      <textarea rows={6} value={s.systemPrompt} onChange={(e) => set('systemPrompt', e.target.value)} />

      <h3>{t('Loading')}</h3>
      <p className="settings-hint">{t('These values only apply after reloading the model.')}</p>
      <label className="settings-field">
        <span>{t('Context size')}</span>
        <select value={s.contextSize} onChange={(e) => set('contextSize', Number(e.target.value))}>
          {CONTEXT_SIZES.map((n) => (
            <option key={n} value={n}>
              {t('{count} tokens', { count: n.toLocaleString(locale) })}
            </option>
          ))}
          <option value={0}>{t('Automatic (as large as possible)')}</option>
        </select>
        <small>{t('How much text the model can remember. More needs more memory.')}</small>
      </label>
      <label className="settings-field">
        <span>{t('Graphics backend')}</span>
        <select value={s.gpuBackend ?? 'auto'} onChange={(e) => set('gpuBackend', e.target.value as ModelSettings['gpuBackend'])}>
          <option value="auto">{t('Automatic (recommended)')}</option>
          <option value="metal">Metal – Apple Silicon</option>
          <option value="cuda">{t('CUDA – NVIDIA graphics cards')}</option>
          <option value="vulkan">Vulkan – AMD, Intel, NVIDIA</option>
          <option value="cpu">{t('CPU only')}</option>
        </select>
        <small>{t('Automatic picks the fastest available one. On Linux CUDA needs the NVIDIA driver and CUDA 12.4+.')}</small>
      </label>
      <label className="settings-field">
        <span>{t('GPU usage')}</span>
        <select
          value={String(s.gpuLayers)}
          onChange={(e) => set('gpuLayers', e.target.value === 'auto' || e.target.value === 'max' ? e.target.value : Number(e.target.value))}
        >
          <option value="auto">{t('Automatic')}</option>
          <option value="max">{t('Everything on the GPU')}</option>
          <option value="0">{t('CPU only')}</option>
        </select>
      </label>
      <label className="settings-check">
        <input type="checkbox" checked={s.flashAttention} onChange={(e) => set('flashAttention', e.target.checked)} />
        <span>
          Flash Attention
          <small>{t('Saves memory with a large context, not every model supports it.')}</small>
        </span>
      </label>

      <button className="btn" onClick={resetAll}>
        {t('Reset to defaults')}
      </button>
    </div>
  )
}

function Slider({
  label,
  hint,
  min,
  max,
  step,
  value,
  onChange
}: {
  label: string
  hint?: string
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
}): React.JSX.Element {
  return (
    <label className="settings-field">
      <span>
        {label}
        <b>{value}</b>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      {hint && <small>{hint}</small>}
    </label>
  )
}

function NumberField({
  label,
  hint,
  value,
  onChange
}: {
  label: string
  hint?: string
  value: number | null
  onChange: (v: number | null) => void
}): React.JSX.Element {
  return (
    <label className="settings-field">
      <span>{label}</span>
      <input
        type="number"
        min={0}
        step={1}
        value={value ?? ''}
        placeholder={t('empty')}
        onChange={(e) => {
          const v = e.target.value.trim()
          onChange(v === '' ? null : Math.max(0, Math.floor(Number(v))))
        }}
      />
      {hint && <small>{hint}</small>}
    </label>
  )
}
