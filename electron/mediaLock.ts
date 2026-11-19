// Media lock, Node side: locking files at build time (vite/protect.ts) and reading them back in
// Electron (main.ts). The format is in src/core/protect/format.ts.
import { createCipheriv, createDecipheriv, createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { open } from 'node:fs/promises'
import { Readable } from 'node:stream'
import {
  blockStart,
  counterAt,
  HEADER_BYTES,
  header,
  isLocked,
  ivOf,
  mimeOf,
  parseRange,
} from '../src/core/protect/format.ts'

/** The AES-256 key (hex) for the key text in src/content/config/protect.ts. */
export function keyFromText(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

/** A plain file's bytes -> its locked bytes. The same input always gives the same output. */
export function lockBytes(plain: Uint8Array, keyHex: string): Buffer {
  const iv = createHash('sha256').update(plain).digest().subarray(0, 8)
  const cipher = createCipheriv('aes-256-ctr', Buffer.from(keyHex, 'hex'), counterAt(iv, 0))
  return Buffer.concat([header(iv), cipher.update(plain), cipher.final()])
}

/** A locked file's bytes -> the plain bytes (tests, tools). */
export function unlockBytes(locked: Uint8Array, keyHex: string): Buffer {
  const decipher = createDecipheriv(
    'aes-256-ctr',
    Buffer.from(keyHex, 'hex'),
    counterAt(ivOf(locked), 0),
  )
  return Buffer.concat([decipher.update(locked.subarray(HEADER_BYTES)), decipher.final()])
}

/**
 * Serves a file that may be locked: null when it is not (the caller serves it as it is), else a
 * Response with the plain bytes, decrypted while they are read. Answers Range (videos seek).
 */
export async function serveLocked(
  file: string,
  keyHex: string,
  range: string | null,
): Promise<Response | null> {
  let size: number
  let iv: Uint8Array
  const handle = await open(file, 'r')
  try {
    const head = new Uint8Array(HEADER_BYTES)
    const { bytesRead } = await handle.read(head, 0, HEADER_BYTES, 0)
    if (bytesRead < HEADER_BYTES || !isLocked(head)) return null
    iv = ivOf(head)
    size = (await handle.stat()).size - HEADER_BYTES
  } finally {
    await handle.close()
  }

  const headers: Record<string, string> = {
    'Content-Type': mimeOf(file.replaceAll('\\', '/')),
    'Accept-Ranges': 'bytes',
  }
  let start = 0
  let end = size - 1
  if (range) {
    const part = parseRange(range, size)
    if (part === 'bad') {
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
    }
    ;({ start, end } = part)
    headers['Content-Range'] = `bytes ${start}-${end}/${size}`
  }
  headers['Content-Length'] = String(Math.max(0, end - start + 1))
  if (size === 0) return new Response(new Uint8Array(0), { status: 200, headers })

  const aligned = blockStart(start)
  const decipher = createDecipheriv(
    'aes-256-ctr',
    Buffer.from(keyHex, 'hex'),
    counterAt(iv, aligned / 16),
  )
  const source = createReadStream(file, {
    start: HEADER_BYTES + aligned,
    end: HEADER_BYTES + end,
  })
  async function* plain() {
    let skip = start - aligned
    for await (const chunk of source.pipe(decipher)) {
      let bytes = chunk as Buffer
      if (skip > 0) {
        const cut = Math.min(skip, bytes.length)
        bytes = bytes.subarray(cut)
        skip -= cut
      }
      if (bytes.length > 0) yield bytes
    }
  }
  const body = Readable.toWeb(Readable.from(plain())) as unknown as ReadableStream<Uint8Array>
  return new Response(body, { status: range ? 206 : 200, headers })
}
