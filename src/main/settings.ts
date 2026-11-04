// Stores the model parameters permanently in userData/settings.json.
import { app } from 'electron'
import { readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ModelSettings } from '../shared/types'
import { jetson } from './hardware'

export const DEFAULT_SYSTEM_PROMPT = `You are a helpful programming assistant in a local IDE.
Answer precisely and in the user's language. Always put code in Markdown code blocks with a language tag.
If the user sends code from their editor, refer to it specifically.`

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
  // On the Jetson (CUDA, shared memory) faster and more memory-efficient for the context
  flashAttention: !!jetson(),
  gpuBackend: 'auto',
  language: 'auto'
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
