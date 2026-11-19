// Media lock: the file format shared by the build (vite/protect.ts), the service worker (sw.ts, web
// and Android) and Electron (electron/main.ts). Imports nothing, so every one of them can use it.
//
// A locked file: MAGIC (8 bytes) + IV (8 bytes) + the file encrypted with AES-256-CTR.
// The 16-byte counter block is IV + 8 zero bytes, +1 per 16-byte block of the plain file. The IV comes
// from the file's own bytes (the same file always gives the same locked bytes, so updates stay small),
// and 64 bits of counter never overflow into the IV (Node and WebCrypto then count the same way).

export interface ProtectConfig {
  media: {
    /** false = built games ship plain files. Dev servers never lock anything. */
    enabled: boolean
    /** Any text. The AES key is its SHA-256. Changing it changes every locked file (one big update). */
    key: string
    /** File endings to lock, without the dot, lower case. */
    extensions: string[]
    /** Paths inside the built game (e.g. 'icon.png') that stay plain. */
    skip?: string[]
  }
}

export function defineProtect(config: ProtectConfig): ProtectConfig {
  return config
}

/** What the build hands to the service worker and to Electron (lock.json). */
export interface LockInfo {
  /** The AES-256 key as 64 hex characters. */
  key: string
  extensions: string[]
}

export const MAGIC = 'SGMEDIA1'
export const HEADER_BYTES = 16
const IV_BYTES = 8
const BLOCK = 16

const MAGIC_BYTES = new TextEncoder().encode(MAGIC)

/** Whether these bytes start like a locked file. */
export function isLocked(bytes: Uint8Array): boolean {
  if (bytes.length < HEADER_BYTES) return false
  for (let i = 0; i < MAGIC_BYTES.length; i++) if (bytes[i] !== MAGIC_BYTES[i]) return false
  return true
}

/** The header for a file whose IV is `iv` (8 bytes). */
export function header(iv: Uint8Array): Uint8Array {
  const out = new Uint8Array(HEADER_BYTES)
  out.set(MAGIC_BYTES, 0)
  out.set(iv.subarray(0, IV_BYTES), MAGIC_BYTES.length)
  return out
}

/** The IV stored in a locked file's header. */
export function ivOf(bytes: Uint8Array): Uint8Array {
  return bytes.slice(MAGIC_BYTES.length, HEADER_BYTES)
}

/** The counter block for the 16-byte block `block` of the plain file. */
export function counterAt(iv: Uint8Array, block: number): Uint8Array<ArrayBuffer> {
  const counter = new Uint8Array(BLOCK)
  counter.set(iv.subarray(0, IV_BYTES), 0)
  let value = BigInt(block)
  for (let i = BLOCK - 1; i >= IV_BYTES; i--) {
    counter[i] = Number(value & 0xffn)
    value >>= 8n
  }
  return counter
}

/** The file ending of a path, lower case, without the dot ('' when it has none). */
export function extensionOf(path: string): string {
  const name = path.slice(path.lastIndexOf('/') + 1)
  const dot = name.lastIndexOf('.')
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase()
}

/** Whether the build locks this file (path relative to the built game, with '/'). */
export function shouldLock(path: string, media: ProtectConfig['media']): boolean {
  if (!media.enabled) return false
  if ((media.skip ?? []).includes(path)) return false
  return media.extensions.includes(extensionOf(path))
}

const MIME: Record<string, string> = {
  webp: 'image/webp',
  avif: 'image/avif',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  opus: 'audio/ogg',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  flac: 'audio/flac',
  mp4: 'video/mp4',
  webm: 'video/webm',
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
  otf: 'font/otf',
  json: 'application/json',
}

/** The Content-Type for a path. */
export function mimeOf(path: string): string {
  return MIME[extensionOf(path)] ?? 'application/octet-stream'
}

/** A key from LockInfo.key, ready for WebCrypto AES-CTR. */
export function importKey(hex: string): Promise<CryptoKey> {
  const raw = new Uint8Array(hex.length / 2)
  for (let i = 0; i < raw.length; i++) raw[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return crypto.subtle.importKey('raw', raw, { name: 'AES-CTR' }, false, ['decrypt'])
}

/**
 * Decrypts part of a locked file with WebCrypto. `data` is the encrypted bytes starting at plain-file
 * offset `start`, which must be a multiple of 16 (fetch from a block start and cut the extra bytes).
 */
export async function decryptAt(
  key: CryptoKey,
  iv: Uint8Array,
  data: Uint8Array,
  start: number,
): Promise<Uint8Array<ArrayBuffer>> {
  if (start % BLOCK !== 0) throw new Error('decryptAt: start must be a multiple of 16')
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-CTR', counter: counterAt(iv, start / BLOCK), length: 64 },
    key,
    data as Uint8Array<ArrayBuffer>,
  )
  return new Uint8Array(plain)
}

/** First and last byte (inclusive) of a "bytes=" Range header, or 'bad' when it can't be served. */
export function parseRange(range: string, size: number): { start: number; end: number } | 'bad' {
  const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim())
  if (!match || (match[1] === '' && match[2] === '')) return 'bad'
  let start: number
  let end: number
  if (match[1] === '') {
    // "bytes=-500" = the last 500 bytes.
    start = Math.max(0, size - Number(match[2]))
    end = size - 1
  } else {
    start = Number(match[1])
    end = match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1)
  }
  if (start > end || start >= size) return 'bad'
  return { start, end }
}

/** The block start at or before a plain-file offset. */
export const blockStart = (offset: number): number => offset - (offset % BLOCK)
