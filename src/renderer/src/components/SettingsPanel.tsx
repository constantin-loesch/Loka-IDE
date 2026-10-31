import { useEffect, useRef, useState } from 'react'
import { LOAD_SETTINGS, type EngineStatus, type ModelSettings } from '../../../shared/types'

interface Props {
  status: EngineStatus
}

const CONTEXT_SIZES = [2048, 4096, 8192, 16384, 32768, 65536]

/** Einstellbare Modell-Parameter. Änderungen werden automatisch gespeichert. */
export default function SettingsPanel({ status }: Props): React.JSX.Element {
  const [s, setS] = useState<ModelSettings | null>(null)
  const [needsReload, setNeedsReload] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const pending = useRef<Partial<ModelSettings>>({})

  useEffect(() => {
    window.api.settings.get().then(setS)
  }, [])

  // Nach dem Neuladen gelten die Lade-Einstellungen wieder
  useEffect(() => {
    if (status.state === 'loading') setNeedsReload(false)
  }, [status.state])

  if (!s) return <div className="empty-hint">Lade …</div>

  /** Sofort anzeigen, gebündelt speichern (Schieberegler feuern sehr oft). */
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
    if (!confirm('Alle Modell-Einstellungen auf Standard zurücksetzen?')) return
    const defaults = await window.api.settings.defaults()
    const loadChanged = LOAD_SETTINGS.some((k) => defaults[k] !== s[k])
    setS(await window.api.settings.update(defaults))
    if (loadChanged && status.state === 'ready') setNeedsReload(true)
  }

  const reload = (): void => {
    if (status.state === 'ready') void window.api.engine.load(status.modelPath)
  }

  return (
    <div className="settings">
      {needsReload && (
        <div className="settings-reload">
          <span>Diese Änderung gilt erst nach dem Neuladen des Modells.</span>
          <button className="btn primary" onClick={reload}>
            Jetzt neu laden
          </button>
        </div>
      )}

      <h3>Antwort</h3>
      <Slider label="Temperatur" hint="Höher = kreativer, niedriger = genauer" min={0} max={2} step={0.05} value={s.temperature} onChange={(v) => set('temperature', v)} />
      <Slider label="Top-P" hint="Nur die wahrscheinlichsten Wörter bis zu diesem Anteil" min={0} max={1} step={0.01} value={s.topP} onChange={(v) => set('topP', v)} />
      <Slider label="Top-K" hint="Nur aus den K wahrscheinlichsten Wörtern wählen (0 = aus)" min={0} max={200} step={1} value={s.topK} onChange={(v) => set('topK', v)} />
      <Slider label="Min-P" hint="Unwahrscheinliche Wörter herausfiltern" min={0} max={1} step={0.01} value={s.minP} onChange={(v) => set('minP', v)} />
      <Slider label="Wiederholungsstrafe" hint="Gegen Endlosschleifen (1 = aus)" min={1} max={2} step={0.01} value={s.repeatPenalty} onChange={(v) => set('repeatPenalty', v)} />
      <Slider label="… beachtet die letzten Token" min={0} max={512} step={16} value={s.repeatLastTokens} onChange={(v) => set('repeatLastTokens', v)} />

      <NumberField label="Max. Antwortlänge (Token)" hint="Leer = unbegrenzt" value={s.maxTokens || null} onChange={(v) => set('maxTokens', v ?? 0)} />
      <NumberField label="Seed" hint="Gleicher Seed = gleiche Antwort. Leer = zufällig" value={s.seed} onChange={(v) => set('seed', v)} />
      <NumberField label="Denk-Budget (Token)" hint="Für Modelle mit Nachdenk-Modus. Leer = Standard, 0 = nicht nachdenken" value={s.thoughtTokens} onChange={(v) => set('thoughtTokens', v)} />

      <h3>Codebase-Agent</h3>
      <label className="settings-field">
        <span>Freigaben</span>
        <select value={s.approvalMode} onChange={(e) => set('approvalMode', e.target.value as ModelSettings['approvalMode'])}>
          <option value="ask">Immer fragen (empfohlen)</option>
          <option value="auto-edits">Dateiänderungen automatisch, Befehle fragen</option>
          <option value="auto-all">Alles automatisch</option>
        </select>
        <small>Gefährliche Befehle (z. B. sudo, rm -rf, git push) werden immer nachgefragt. Das Modell arbeitet nur im Projektordner.</small>
      </label>
      <Slider label="Max. Werkzeug-Aufrufe pro Antwort" hint="Wie oft das Modell lesen, ändern oder Befehle ausführen darf" min={1} max={50} step={1} value={s.maxToolCalls} onChange={(v) => set('maxToolCalls', v)} />
      <Slider label="Zeitlimit für Befehle (Sekunden)" hint="Danach wird ein Terminal-Befehl abgebrochen" min={10} max={600} step={10} value={s.commandTimeout} onChange={(v) => set('commandTimeout', v)} />

      <h3>System-Prompt</h3>
      <p className="settings-hint">Grundanweisung an das Modell. Gilt ab dem nächsten neuen Chat.</p>
      <textarea rows={6} value={s.systemPrompt} onChange={(e) => set('systemPrompt', e.target.value)} />

      <h3>Laden</h3>
      <p className="settings-hint">Diese Werte gelten erst nach dem Neuladen des Modells.</p>
      <label className="settings-field">
        <span>Kontextgröße</span>
        <select value={s.contextSize} onChange={(e) => set('contextSize', Number(e.target.value))}>
          {CONTEXT_SIZES.map((n) => (
            <option key={n} value={n}>
              {n.toLocaleString('de')} Token
            </option>
          ))}
          <option value={0}>Automatisch (so groß wie möglich)</option>
        </select>
        <small>Wie viel Text sich das Modell merken kann. Mehr braucht mehr Arbeitsspeicher.</small>
      </label>
      <label className="settings-field">
        <span>Grafik-Backend</span>
        <select value={s.gpuBackend ?? 'auto'} onChange={(e) => set('gpuBackend', e.target.value as ModelSettings['gpuBackend'])}>
          <option value="auto">Automatisch (empfohlen)</option>
          <option value="metal">Metal – Apple Silicon</option>
          <option value="cuda">CUDA – NVIDIA-Grafikkarten</option>
          <option value="vulkan">Vulkan – AMD, Intel, NVIDIA</option>
          <option value="cpu">Nur CPU</option>
        </select>
        <small>Automatisch nimmt das schnellste verfügbare. CUDA braucht unter Linux den NVIDIA-Treiber und CUDA 12.4+.</small>
      </label>
      <label className="settings-field">
        <span>GPU-Nutzung</span>
        <select
          value={String(s.gpuLayers)}
          onChange={(e) => set('gpuLayers', e.target.value === 'auto' || e.target.value === 'max' ? e.target.value : Number(e.target.value))}
        >
          <option value="auto">Automatisch</option>
          <option value="max">Alles auf der GPU</option>
          <option value="0">Nur CPU</option>
        </select>
      </label>
      <label className="settings-check">
        <input type="checkbox" checked={s.flashAttention} onChange={(e) => set('flashAttention', e.target.checked)} />
        <span>
          Flash Attention
          <small>Spart Speicher bei großem Kontext, nicht jedes Modell unterstützt es.</small>
        </span>
      </label>

      <button className="btn" onClick={resetAll}>
        Auf Standard zurücksetzen
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
        placeholder="leer"
        onChange={(e) => {
          const v = e.target.value.trim()
          onChange(v === '' ? null : Math.max(0, Math.floor(Number(v))))
        }}
      />
      {hint && <small>{hint}</small>}
    </label>
  )
}
