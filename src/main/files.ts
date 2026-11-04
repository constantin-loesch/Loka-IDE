// Opening and saving files of any type.
import { net, protocol } from 'electron'
import { watch, type FSWatcher } from 'node:fs'
import { mkdir, open, readFile, rename as fsRename, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, extname } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { MediaKind, OpenedFile, TextEncoding } from '../shared/types'
import { t } from './i18n'

/** Folders hidden in the explorer and from the model. */
export const HIDDEN = new Set(['.git', 'node_modules', '.DS_Store', 'out', 'dist', '.next', '__pycache__'])

/** Own protocol through which the UI loads images, PDFs, audio and video. */
export const FILE_SCHEME = 'lokal-file'

const MEDIA: Record<string, MediaKind> = {
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', bmp: 'image',
  ico: 'image', avif: 'image', apng: 'image', tif: 'image', tiff: 'image', heic: 'image',
  pdf: 'pdf',
  mp3: 'audio', wav: 'audio', ogg: 'audio', oga: 'audio', m4a: 'audio', aac: 'audio',
  flac: 'audio', opus: 'audio', weba: 'audio', aiff: 'audio', aif: 'audio',
  mp4: 'video', webm: 'video', mov: 'video', m4v: 'video', ogv: 'video', mkv: 'video'
}

/** Larger text files would paralyze the editor. */
const MAX_TEXT_BYTES = 50 * 1024 * 1024

/** Must run before app.whenReady(). */
export function registerScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: FILE_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
  ])
}

/** Must run after app.whenReady(). */
export function handleScheme(): void {
  protocol.handle(FILE_SCHEME, (req) => {
    const path = decodeURIComponent(new URL(req.url).pathname)
    // Pass the Range header on so audio/video can seek
    return net.fetch(pathToFileURL(path).toString(), { headers: req.headers })
  })
}

function mediaUrl(path: string): string {
  return `${FILE_SCHEME}://file${path.split('/').map(encodeURIComponent).join('/')}`
}

/** Detects binary files by null bytes at the start (like git). */
function looksBinary(buf: Buffer): boolean {
  const n = Math.min(buf.length, 8000)
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true
  return false
}

function decodeText(buf: Buffer): { content: string; encoding: TextEncoding } {
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return { content: buf.subarray(3).toString('utf8'), encoding: 'utf8bom' }
  }
  if (buf[0] === 0xff && buf[1] === 0xfe) {
    return { content: buf.subarray(2).toString('utf16le'), encoding: 'utf16le' }
  }
  try {
    return { content: new TextDecoder('utf-8', { fatal: true }).decode(buf), encoding: 'utf8' }
  } catch {
    // Not valid UTF-8 – usually old Windows/Latin-1 files
    return { content: buf.toString('latin1'), encoding: 'latin1' }
  }
}

export async function openFile(path: string, forceText = false): Promise<OpenedFile> {
  const { size } = await stat(path)
  const media = MEDIA[extname(path).slice(1).toLowerCase()]
  if (media && !forceText) return { kind: 'media', media, url: mediaUrl(path), size }
  if (size > MAX_TEXT_BYTES && !forceText) return { kind: 'binary', reason: 'too-large', size }

  if (!forceText) {
    // Only read the beginning to detect binary files quickly
    const fh = await open(path, 'r')
    try {
      const head = Buffer.alloc(Math.min(size, 8000))
      await fh.read(head, 0, head.length, 0)
      const utf16 = head[0] === 0xff && head[1] === 0xfe
      if (!utf16 && looksBinary(head)) return { kind: 'binary', reason: 'binary', size }
    } finally {
      await fh.close()
    }
  }
  return { kind: 'text', ...decodeText(await readFile(path)) }
}

export async function saveFile(path: string, content: string, encoding: TextEncoding = 'utf8'): Promise<void> {
  let buf: Buffer
  switch (encoding) {
    case 'utf8bom':
      buf = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(content, 'utf8')])
      break
    case 'utf16le':
      buf = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(content, 'utf16le')])
      break
    case 'latin1':
      buf = Buffer.from(content, 'latin1')
      break
    default:
      buf = Buffer.from(content, 'utf8')
  }
  await writeFile(path, buf)
}

// ---------- Create, rename, delete ----------

/** Creates an empty file; missing intermediate folders (“src/new/file.ts”) are created too. */
export async function createFile(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  // 'wx' = error if the file already exists
  await writeFile(path, '', { flag: 'wx' }).catch((err: NodeJS.ErrnoException) => {
    throw err.code === 'EEXIST' ? new Error(t('“{name}” already exists.', { name: basename(path) })) : err
  })
}

export async function createDir(path: string): Promise<void> {
  if (await exists(path)) throw new Error(t('“{name}” already exists.', { name: basename(path) }))
  await mkdir(path, { recursive: true })
}

export async function rename(from: string, to: string): Promise<void> {
  if (from === to) return
  // Only the case changed: on macOS that's the same file
  if (from.toLowerCase() !== to.toLowerCase() && (await exists(to))) throw new Error(t('“{name}” already exists.', { name: basename(to) }))
  await mkdir(dirname(to), { recursive: true })
  await fsRename(from, to)
}

async function exists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false
  )
}

// ---------- Watching folders ----------

const watchers = new Map<string, FSWatcher>()

/**
 * Watches the expanded folders of the explorer (not recursive, so cheap even for large
 * projects). Changes – e.g. from the terminal – are reported via `onChange` with the folder.
 */
export function watchDirs(dirs: string[], onChange: (dir: string) => void): void {
  const wanted = new Set(dirs)
  for (const [dir, w] of watchers) {
    if (!wanted.has(dir)) {
      w.close()
      watchers.delete(dir)
    }
  }
  for (const dir of wanted) {
    if (watchers.has(dir)) continue
    try {
      let t: NodeJS.Timeout | null = null
      const w = watch(dir, () => {
        // Combine many events in quick succession
        if (t) clearTimeout(t)
        t = setTimeout(() => onChange(dir), 150)
      })
      w.on('error', () => {
        w.close()
        watchers.delete(dir)
      })
      watchers.set(dir, w)
    } catch {
      /* folder no longer exists */
    }
  }
}
