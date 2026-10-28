import { app } from 'electron'
import { createWriteStream } from 'node:fs'
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { totalmem } from 'node:os'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { CatalogEntry, CatalogModel, DownloadProgress, Fit, InstalledModel } from '../shared/types'

const HF = 'https://huggingface.co'

/** Kuratierte Modelle, die auf normalen Laptops laufen. Größen sind die echten Dateigrößen. */
export const CATALOG: CatalogModel[] = [
  {
    id: 'qwen2.5-coder-1.5b',
    name: 'Qwen2.5 Coder 1.5B',
    description: 'Sehr schnell, gut für Code-Fragen und kurze Erklärungen. Guter Einstieg.',
    params: '1.5B',
    url: `${HF}/bartowski/Qwen2.5-Coder-1.5B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-1.5B-Instruct-Q4_K_M.gguf`,
    fileName: 'Qwen2.5-Coder-1.5B-Instruct-Q4_K_M.gguf',
    sizeBytes: 986_000_000,
    tags: ['Code', 'schnell']
  },
  {
    id: 'qwen2.5-coder-3b',
    name: 'Qwen2.5 Coder 3B',
    description: 'Guter Kompromiss aus Tempo und Qualität für Programmieraufgaben.',
    params: '3B',
    url: `${HF}/bartowski/Qwen2.5-Coder-3B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-3B-Instruct-Q4_K_M.gguf`,
    fileName: 'Qwen2.5-Coder-3B-Instruct-Q4_K_M.gguf',
    sizeBytes: 1_930_000_000,
    tags: ['Code', 'empfohlen']
  },
  {
    id: 'qwen3-4b',
    name: 'Qwen3 4B',
    description: 'Allround-Modell mit „Nachdenken“-Modus. Stark bei Logik und Erklärungen.',
    params: '4B',
    url: `${HF}/Qwen/Qwen3-4B-GGUF/resolve/main/Qwen3-4B-Q4_K_M.gguf`,
    fileName: 'Qwen3-4B-Q4_K_M.gguf',
    sizeBytes: 2_500_000_000,
    tags: ['Allround', 'Reasoning']
  },
  {
    id: 'gemma-3-4b',
    name: 'Gemma 3 4B',
    description: 'Allround-Modell von Google, gut in Deutsch und beim Formulieren.',
    params: '4B',
    url: `${HF}/bartowski/google_gemma-3-4b-it-GGUF/resolve/main/google_gemma-3-4b-it-Q4_K_M.gguf`,
    fileName: 'google_gemma-3-4b-it-Q4_K_M.gguf',
    sizeBytes: 2_490_000_000,
    tags: ['Allround', 'Deutsch']
  },
  {
    id: 'llama-3.2-3b',
    name: 'Llama 3.2 3B',
    description: 'Kompaktes Allround-Modell von Meta.',
    params: '3B',
    url: `${HF}/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf`,
    fileName: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    sizeBytes: 2_020_000_000,
    tags: ['Allround']
  },
  {
    id: 'qwen2.5-coder-7b',
    name: 'Qwen2.5 Coder 7B',
    description: 'Deutlich bessere Code-Qualität, braucht aber viel Arbeitsspeicher.',
    params: '7B',
    url: `${HF}/bartowski/Qwen2.5-Coder-7B-Instruct-GGUF/resolve/main/Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf`,
    fileName: 'Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf',
    sizeBytes: 4_680_000_000,
    tags: ['Code', 'Qualität']
  }
]

export const modelsDir = (): string => join(app.getPath('userData'), 'models')
const importedListFile = (): string => join(app.getPath('userData'), 'imported-models.json')

const GB = 1024 ** 3

/**
 * Grobe Einschätzung, ob ein Modell in den Speicher passt.
 * Auf Apple Silicon teilen sich CPU und GPU den RAM; das System braucht selbst einige GB.
 */
export function estimateFit(sizeBytes: number, totalBytes = totalmem()): Fit {
  const needed = sizeBytes * 1.2 + 0.5 * GB // Gewichte + Kontext/KV-Cache
  if (needed <= totalBytes - 3.5 * GB) return 'gut'
  if (needed <= totalBytes - 1.5 * GB) return 'knapp'
  return 'zu-gross'
}

async function readImported(): Promise<string[]> {
  try {
    return JSON.parse(await readFile(importedListFile(), 'utf8'))
  } catch {
    return []
  }
}

async function writeImported(paths: string[]): Promise<void> {
  await writeFile(importedListFile(), JSON.stringify(paths, null, 2))
}

export async function listInstalled(): Promise<InstalledModel[]> {
  const dir = modelsDir()
  await mkdir(dir, { recursive: true })
  const result: InstalledModel[] = []

  for (const file of await readdir(dir)) {
    if (!file.endsWith('.gguf')) continue
    const p = join(dir, file)
    const s = await stat(p)
    result.push({ path: p, name: prettyName(file), sizeBytes: s.size, external: false })
  }

  for (const p of await readImported()) {
    try {
      const s = await stat(p)
      result.push({ path: p, name: prettyName(basename(p)), sizeBytes: s.size, external: true })
    } catch {
      // Datei wurde verschoben oder gelöscht – einfach nicht anzeigen
    }
  }
  return result
}

export async function getCatalog(): Promise<CatalogEntry[]> {
  const installed = new Set((await listInstalled()).map((m) => basename(m.path)))
  return CATALOG.map((m) => ({ ...m, fit: estimateFit(m.sizeBytes), installed: installed.has(m.fileName) }))
}

export async function importModel(path: string): Promise<void> {
  const list = await readImported()
  if (!list.includes(path)) await writeImported([...list, path])
}

/** Entfernt ein Modell. Importierte Dateien werden nur aus der Liste genommen, nicht gelöscht. */
export async function removeModel(path: string): Promise<void> {
  const list = await readImported()
  if (list.includes(path)) {
    await writeImported(list.filter((p) => p !== path))
    return
  }
  if (!path.startsWith(modelsDir())) throw new Error('Pfad liegt außerhalb des Modell-Ordners')
  await rm(path, { force: true })
}

function prettyName(file: string): string {
  return file.replace(/\.gguf$/i, '').replace(/[-_]/g, ' ')
}

// ---------- Downloads ----------

const activeDownloads = new Map<string, AbortController>()

export async function downloadModel(id: string, onProgress: (p: DownloadProgress) => void): Promise<void> {
  const model = CATALOG.find((m) => m.id === id)
  if (!model) throw new Error(`Unbekanntes Modell: ${id}`)
  if (activeDownloads.has(id)) return

  const controller = new AbortController()
  activeDownloads.set(id, controller)
  await mkdir(modelsDir(), { recursive: true })
  const target = join(modelsDir(), model.fileName)
  const partial = `${target}.part`

  try {
    // Abgebrochene Downloads fortsetzen, falls eine .part-Datei existiert
    let start = 0
    try {
      start = (await stat(partial)).size
    } catch {
      /* keine Teildatei */
    }

    const res = await fetch(model.url, {
      signal: controller.signal,
      headers: start > 0 ? { Range: `bytes=${start}-` } : {}
    })
    if (!res.ok || !res.body) throw new Error(`Download fehlgeschlagen (HTTP ${res.status})`)
    if (res.status !== 206) start = 0 // Server unterstützt kein Fortsetzen

    const total = start + Number(res.headers.get('content-length') ?? model.sizeBytes)
    let received = start
    let lastEmit = 0

    const body = Readable.fromWeb(res.body as import('node:stream/web').ReadableStream)
    body.on('data', (chunk: Buffer) => {
      received += chunk.length
      const now = Date.now()
      if (now - lastEmit > 200) {
        lastEmit = now
        onProgress({ id, received, total, done: false })
      }
    })

    await pipeline(body, createWriteStream(partial, { flags: start > 0 ? 'a' : 'w' }))
    await rename(partial, target)
    onProgress({ id, received: total, total, done: true })
  } catch (err) {
    const aborted = controller.signal.aborted
    onProgress({ id, received: 0, total: model.sizeBytes, done: true, error: aborted ? 'Abgebrochen' : String(err) })
  } finally {
    activeDownloads.delete(id)
  }
}

export function cancelDownload(id: string): void {
  activeDownloads.get(id)?.abort()
}
