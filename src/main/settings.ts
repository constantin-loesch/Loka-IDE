// Speichert die Modell-Parameter dauerhaft in userData/settings.json.
import { app } from 'electron'
import { readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ModelSettings } from '../shared/types'
import { jetson } from './hardware'

export const DEFAULT_SYSTEM_PROMPT = `Du bist ein hilfreicher Programmier-Assistent in einer lokalen IDE.
Antworte präzise und in der Sprache des Nutzers. Setze Code immer in Markdown-Codeblöcke mit Sprachangabe.
Wenn der Nutzer Code aus seinem Editor mitschickt, beziehe dich konkret darauf.`

export const DEFAULTS: ModelSettings = {
  temperature: 0.4,
  topP: 0.95,
  topK: 40,
  minP: 0.05,
  repeatPenalty: 1.1,
  repeatLastTokens: 64,
  maxTokens: 0,
  seed: null,
  thoughtTokens: null,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  maxToolCalls: 20,
  approvalMode: 'ask',
  commandTimeout: 120,
  contextSize: 8192,
  gpuLayers: 'auto',
  // Auf dem Jetson (CUDA, gemeinsamer Speicher) schneller und sparsamer beim Kontext
  flashAttention: !!jetson(),
  gpuBackend: 'auto'
}

const file = (): string => join(app.getPath('userData'), 'settings.json')

let current: ModelSettings | null = null

export function getSettings(): ModelSettings {
  if (!current) {
    try {
      current = { ...DEFAULTS, ...JSON.parse(readFileSync(file(), 'utf8')) }
    } catch {
      current = { ...DEFAULTS }
    }
  }
  return current!
}

export async function updateSettings(patch: Partial<ModelSettings>): Promise<ModelSettings> {
  current = { ...getSettings(), ...patch }
  await writeFile(file(), JSON.stringify(current, null, 2))
  return current
}

export async function resetSettings(): Promise<ModelSettings> {
  return updateSettings({ ...DEFAULTS })
}
