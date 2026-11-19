// @vitest-environment node
import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import type { ImageRule } from '../../src/core/media.ts'
import { convertImage, imagePlan, makeThumbnail, pickRule } from './images.ts'

const dir = mkdtempSync(path.join(tmpdir(), 'game-images-'))

/** A noisy RGBA picture (so it is big as PNG and shrinks as lossy WebP). */
async function picture(name: string, width: number, height: number, block = 1) {
  const pixels = Buffer.alloc(width * height * 4)
  const noise = (n: number) => {
    const h = Math.imul(n ^ (n >>> 15), 2246822519)
    return Math.imul(h ^ (h >>> 13), 3266489917) >>> 24
  }
  for (let i = 0; i < pixels.length; i++) {
    const pixel = i >> 2
    const cell = Math.floor((pixel % width) / block) + Math.floor(pixel / width / block) * width
    pixels[i] = i % 4 === 3 ? 255 : noise(cell * 4 + (i % 4))
  }
  const file = path.join(dir, name)
  writeFileSync(
    file,
    await sharp(pixels, { raw: { width, height, channels: 4 } })
      .png()
      .toBuffer(),
  )
  return file
}

describe('pickRule', () => {
  const rules: ImageRule[] = [
    { match: 'gallery/**', format: 'webp', quality: 90 },
    { match: '**', format: 'webp' },
  ]
  it('uses the first rule that matches', () => {
    expect(pickRule(rules, 'gallery/pond/image.png')?.quality).toBe(90)
    expect(pickRule(rules, 'tilesets/countryside.png')?.quality).toBeUndefined()
    expect(pickRule([], 'x.png')).toBeUndefined()
  })
})

describe('convertImage', () => {
  it('converts to lossy WebP and caches the result', async () => {
    const file = await picture('cg.png', 256, 256)
    const cache = path.join(dir, 'cache1')
    const plan = { format: 'webp', quality: 80, scale: 1 } as const
    const out = await convertImage(file, plan, cache)
    expect(out.endsWith('cg.webp')).toBe(true)
    expect(statSync(out).size).toBeLessThan(statSync(file).size)
    expect(await convertImage(file, plan, cache)).toBe(out)
  })

  it('lite: scales down', async () => {
    const file = await picture('cg2.png', 200, 100)
    const out = await convertImage(file, { format: 'webp', quality: 80, scale: 0.5 }, dir)
    const meta = await sharp(out).metadata()
    expect([meta.width, meta.height]).toEqual([100, 50])
  })

  it('lossless keeps every pixel', async () => {
    const file = await picture('tiles.png', 128, 128, 8) // 8×8 blocks, like pixel art
    const out = await convertImage(file, { format: 'webp', scale: 1 }, path.join(dir, 'c2'))
    expect(out.endsWith('tiles.webp')).toBe(true)
    const a = await sharp(file).raw().toBuffer()
    const b = await sharp(readFileSync(out)).ensureAlpha().raw().toBuffer()
    expect(b.equals(a)).toBe(true)
  })

  it('keeps the original with no plan, or when converting would not shrink it', async () => {
    const file = await picture('tiny.png', 2, 2)
    const cache = path.join(dir, 'c3')
    expect(await convertImage(file, null, cache)).toBe(file)
    const flat = path.join(dir, 'flat.png')
    writeFileSync(
      flat,
      await sharp({ create: { width: 1, height: 1, channels: 3, background: '#fff' } })
        .png()
        .toBuffer(),
    )
    expect(await convertImage(flat, { format: 'avif', scale: 1 }, cache)).toBe(flat)
  })
})

describe('imagePlan', () => {
  const rule = { match: '**', format: 'webp', lite: { scale: 0.5, quality: 85 } } as const
  it('normal build: lossless, full size; lite: the lite settings', () => {
    expect(imagePlan(rule, 'a.png', false)).toEqual({
      format: 'webp',
      quality: undefined,
      scale: 1,
    })
    expect(imagePlan(rule, 'a.png', true)).toEqual({ format: 'webp', quality: 85, scale: 0.5 })
  })
  it('lite without lite settings = the normal build; JPGs are lossy; keep = null', () => {
    expect(imagePlan({ match: '**', format: 'webp' }, 'a.png', true)?.scale).toBe(1)
    expect(imagePlan({ match: '**', format: 'webp' }, 'a.jpg', false)?.quality).toBe(90)
    expect(imagePlan({ match: '**', format: 'keep' }, 'a.png', false)).toBeNull()
    expect(imagePlan(undefined, 'a.png', false)).toBeNull()
  })
})

describe('makeThumbnail', () => {
  it('shrinks to the configured width', async () => {
    const file = await picture('big.png', 800, 400)
    const out = await makeThumbnail(file, { width: 200, quality: 80 }, path.join(dir, 'c4'))
    const meta = await sharp(out).metadata()
    expect([meta.format, meta.width, meta.height]).toEqual(['webp', 200, 100])
  })
})
