import { app } from 'electron'
import { createWriteStream } from 'node:fs'
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { CatalogEntry, DownloadProgress, InstalledModel, ModelVariant } from '../shared/types'
import { CATALOG } from './catalog'
import { assess, fallbackHardware } from './hardware'
import { getHardware } from './llm'

export { CATALOG }

export const modelsDir = (): string => join(app.getPath('userData'), 'models')
const importedListFile = (): string => join(app.getPath('userData'), 'imported-models.json')


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

/** "-00002-of-00006" – Folgeteile eines mehrteiligen Modells */
const SPLIT = /-(\d{5})-of-(\d{5})\.gguf$/i

export async function listInstalled(): Promise<InstalledModel[]> {
  const dir = modelsDir()
  await mkdir(dir, { recursive: true })
  const result: InstalledModel[] = []
  const files = (await readdir(dir)).filter((f) => f.endsWith('.gguf'))

  for (const file of files) {
    const split = file.match(SPLIT)
    // Mehrteilige Modelle nur einmal zeigen – über den ersten Teil, den llama.cpp auch zum Laden braucht
    if (split && split[1] !== '00001') continue
    let size = (await stat(join(dir, file))).size
    if (split) {
      const prefix = file.replace(SPLIT, '')
      const parts = files.filter((f) => f.replace(SPLIT, '') === prefix && SPLIT.test(f))
      if (parts.length !== Number(split[2])) continue // Download noch nicht vollständig
      for (const part of parts) if (part !== file) size += (await stat(join(dir, part))).size
    }
    result.push({ path: join(dir, file), name: prettyName(file), sizeBytes: size, external: false })
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
  const present = new Set(await readdir(modelsDir()).catch(() => [] as string[]))
  const hw = await getHardware().catch(() => fallbackHardware())
  return CATALOG.map((m) => ({
    ...m,
    variants: m.variants.map((v) => {
      const a = assess(v.sizeBytes, m.activeParamsB / m.totalParamsB, hw)
      return {
        ...v,
        fit: a.fit,
        fitNote: a.note,
        installed: v.files.every((f) => present.has(f.fileName)),
        tokensPerSec: a.tokensPerSec
      }
    })
  }))
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
  // Bei mehrteiligen Modellen alle Teile löschen
  const file = basename(path)
  if (SPLIT.test(file)) {
    const prefix = file.replace(SPLIT, '')
    for (const f of await readdir(modelsDir())) {
      if (SPLIT.test(f) && f.replace(SPLIT, '') === prefix) await rm(join(modelsDir(), f), { force: true })
    }
  } else await rm(path, { force: true })
}

function prettyName(file: string): string {
  return file.replace(SPLIT, '').replace(/\.gguf$/i, '').replace(/[-_]/g, ' ')
}

// ---------- Downloads ----------

const activeDownloads = new Map<string, AbortController>()

function findVariant(id: string): ModelVariant | undefined {
  for (const m of CATALOG) {
    const v = m.variants.find((x) => x.id === id)
    if (v) return v
  }
  return undefined
}

/** Lädt alle Dateien einer Variante nacheinander. Abgebrochene Downloads werden fortgesetzt. */
export async function downloadModel(id: string, onProgress: (p: DownloadProgress) => void): Promise<void> {
  const variant = findVariant(id)
  if (!variant) throw new Error(`Unbekannte Modell-Variante: ${id}`)
  if (activeDownloads.has(id)) return

  const controller = new AbortController()
  activeDownloads.set(id, controller)
  await mkdir(modelsDir(), { recursive: true })
  const total = variant.sizeBytes
  let doneBefore = 0 // Bytes der bereits fertigen Teile

  try {
    for (const file of variant.files) {
      const target = join(modelsDir(), file.fileName)
      const existing = await stat(target).catch(() => null)
      if (existing && existing.size === file.sizeBytes) {
        doneBefore += file.sizeBytes
        continue
      }
      const partial = `${target}.part`
      let start = (await stat(partial).catch(() => null))?.size ?? 0

      const res = await fetch(file.url, {
        signal: controller.signal,
        headers: start > 0 ? { Range: `bytes=${start}-` } : {}
      })
      if (!res.ok || !res.body) throw new Error(`Download fehlgeschlagen (HTTP ${res.status})`)
      if (res.status !== 206) start = 0 // Server unterstützt kein Fortsetzen

      let received = start
      let lastEmit = 0
      const body = Readable.fromWeb(res.body as import('node:stream/web').ReadableStream)
      body.on('data', (chunk: Buffer) => {
        received += chunk.length
        const now = Date.now()
        if (now - lastEmit > 200) {
          lastEmit = now
          onProgress({ id, received: doneBefore + received, total, done: false })
        }
      })
      await pipeline(body, createWriteStream(partial, { flags: start > 0 ? 'a' : 'w' }))
      await rename(partial, target)
      doneBefore += file.sizeBytes
    }
    onProgress({ id, received: total, total, done: true })
  } catch (err) {
    const aborted = controller.signal.aborted
    onProgress({ id, received: 0, total, done: true, error: aborted ? 'Abgebrochen' : String(err) })
  } finally {
    activeDownloads.delete(id)
  }
}

export function cancelDownload(id: string): void {
  activeDownloads.get(id)?.abort()
}
