import { randomBytes } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import {
  blockStart,
  decryptAt,
  HEADER_BYTES,
  importKey,
  isLocked,
  ivOf,
  parseRange,
  shouldLock,
} from '../src/core/protect/format.ts'
import { keyFromText, lockBytes, serveLocked, unlockBytes } from './mediaLock.ts'

const key = keyFromText('test key')
const plain = randomBytes(5000)
const locked = lockBytes(plain, key)
const dir = mkdtempSync(path.join(tmpdir(), 'media-lock-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

describe('media lock', () => {
  it('locks and unlocks, the same way every time', () => {
    expect(isLocked(locked)).toBe(true)
    expect(isLocked(plain)).toBe(false)
    expect(locked.length).toBe(plain.length + HEADER_BYTES)
    expect(Buffer.from(locked.subarray(HEADER_BYTES, 64)).equals(plain.subarray(0, 48))).toBe(false)
    expect(unlockBytes(locked, key).equals(plain)).toBe(true)
    expect(lockBytes(plain, key).equals(locked)).toBe(true)
    expect(lockBytes(randomBytes(5000), key).subarray(8, 16).equals(locked.subarray(8, 16))).toBe(
      false,
    )
  })

  it('WebCrypto (service worker) reads any part the same as Node', async () => {
    const cryptoKey = await importKey(key)
    const iv = ivOf(locked)
    for (const [from, to] of [
      [0, 4999],
      [17, 33],
      [4096, 4999],
      [15, 16],
      [4999, 4999],
    ] as const) {
      const aligned = blockStart(from)
      const data = locked.subarray(HEADER_BYTES + aligned, HEADER_BYTES + to + 1)
      const out = (await decryptAt(cryptoKey, iv, data, aligned)).subarray(from - aligned)
      expect(Buffer.from(out).equals(plain.subarray(from, to + 1))).toBe(true)
    }
  })

  it('parses Range headers', () => {
    expect(parseRange('bytes=0-', 100)).toEqual({ start: 0, end: 99 })
    expect(parseRange('bytes=10-20', 100)).toEqual({ start: 10, end: 20 })
    expect(parseRange('bytes=90-500', 100)).toEqual({ start: 90, end: 99 })
    expect(parseRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 })
    expect(parseRange('bytes=100-', 100)).toBe('bad')
    expect(parseRange('bytes=5-2', 100)).toBe('bad')
    expect(parseRange('items=0-1', 100)).toBe('bad')
  })

  it('Electron serves whole files and ranges, and leaves plain files alone', async () => {
    const lockedFile = path.join(dir, 'a.webm')
    const plainFile = path.join(dir, 'b.webm')
    writeFileSync(lockedFile, locked)
    writeFileSync(plainFile, plain)
    expect(await serveLocked(plainFile, key, null)).toBeNull()

    const whole = (await serveLocked(lockedFile, key, null)) as Response
    expect(whole.status).toBe(200)
    expect(whole.headers.get('content-type')).toBe('video/webm')
    expect(Buffer.from(await whole.arrayBuffer()).equals(plain)).toBe(true)

    const part = (await serveLocked(lockedFile, key, 'bytes=1000-2050')) as Response
    expect(part.status).toBe(206)
    expect(part.headers.get('content-range')).toBe('bytes 1000-2050/5000')
    expect(Buffer.from(await part.arrayBuffer()).equals(plain.subarray(1000, 2051))).toBe(true)

    expect(((await serveLocked(lockedFile, key, 'bytes=9000-')) as Response).status).toBe(416)
  })

  it('locks only the listed endings and not the skipped paths', () => {
    const media = { enabled: true, key: 'k', extensions: ['png', 'ogg'], skip: ['icon.png'] }
    expect(shouldLock('assets/a.PNG', media)).toBe(true)
    expect(shouldLock('assets/a.js', media)).toBe(false)
    expect(shouldLock('icon.png', media)).toBe(false)
    expect(shouldLock('assets/a.ogg', { ...media, enabled: false })).toBe(false)
  })
})
