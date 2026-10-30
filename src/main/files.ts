// Öffnen und Speichern von Dateien beliebigen Typs.
import { net, protocol } from 'electron'
import { open, readFile, stat, writeFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { MediaKind, OpenedFile, TextEncoding } from '../shared/types'

/** Ordner, die im Explorer und für das Modell ausgeblendet werden. */
export const HIDDEN = new Set(['.git', 'node_modules', '.DS_Store', 'out', 'dist', '.next', '__pycache__'])

/** Eigenes Protokoll, über das die Oberfläche Bilder, PDFs, Audio und Video lädt. */
export const FILE_SCHEME = 'lokal-file'

const MEDIA: Record<string, MediaKind> = {
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', bmp: 'image',
  ico: 'image', avif: 'image', apng: 'image', tif: 'image', tiff: 'image', heic: 'image',
  pdf: 'pdf',
  mp3: 'audio', wav: 'audio', ogg: 'audio', oga: 'audio', m4a: 'audio', aac: 'audio',
  flac: 'audio', opus: 'audio', weba: 'audio', aiff: 'audio', aif: 'audio',
  mp4: 'video', webm: 'video', mov: 'video', m4v: 'video', ogv: 'video', mkv: 'video'
}

/** Größere Textdateien würden den Editor lahmlegen. */
const MAX_TEXT_BYTES = 50 * 1024 * 1024

/** Muss vor app.whenReady() laufen. */
export function registerScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: FILE_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
  ])
}

/** Muss nach app.whenReady() laufen. */
export function handleScheme(): void {
  protocol.handle(FILE_SCHEME, (req) => {
    const path = decodeURIComponent(new URL(req.url).pathname)
    // Range-Header weiterreichen, damit Audio/Video spulen kann
    return net.fetch(pathToFileURL(path).toString(), { headers: req.headers })
  })
}

function mediaUrl(path: string): string {
  return `${FILE_SCHEME}://file${path.split('/').map(encodeURIComponent).join('/')}`
}

/** Erkennt Binärdateien an Null-Bytes am Anfang (wie git). */
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
    // Kein gültiges UTF-8 – meist alte Windows-/Latin-1-Dateien
    return { content: buf.toString('latin1'), encoding: 'latin1' }
  }
}

export async function openFile(path: string, forceText = false): Promise<OpenedFile> {
  const { size } = await stat(path)
  const media = MEDIA[extname(path).slice(1).toLowerCase()]
  if (media && !forceText) return { kind: 'media', media, url: mediaUrl(path), size }
  if (size > MAX_TEXT_BYTES && !forceText) return { kind: 'binary', reason: 'too-large', size }

  if (!forceText) {
    // Nur den Anfang lesen, um Binärdateien schnell zu erkennen
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
