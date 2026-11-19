// Image conversion for the build (src/content/config/media.ts images.convert) and gallery thumbnails.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import type { ImageRule, MediaConfig } from '../../src/core/media.ts'
import { cacheDirFor, once, pickRule } from './cache.ts'

export { pickRule }

/** Lossy quality for JPG sources when a rule gives none (lossless would make them bigger). */
const JPG_QUALITY = 90

/** What to do with one image in one build. */
export interface ImagePlan {
  format: 'webp' | 'avif'
  /** Undefined = lossless. */
  quality?: number
  /** 1 = same size. */
  scale: number
}

export function imagePlan(
  rule: ImageRule | undefined,
  file: string,
  lite: boolean,
): ImagePlan | null {
  if (!rule || rule.format === 'keep') return null
  const jpg = /\.jpe?g$/i.test(file)
  const settings = lite && rule.lite ? rule.lite : rule
  const quality = settings.quality ?? (jpg ? JPG_QUALITY : undefined)
  const scale = lite ? (rule.lite?.scale ?? 1) : 1
  return { format: rule.format, quality, scale }
}

/**
 * The file to ship for `file`: a converted copy in `cacheDir`, or `file` itself when there is no
 * plan, or the converted copy would not be smaller (and isn't scaled down).
 */
export function convertImage(
  file: string,
  plan: ImagePlan | null,
  cacheDir: string,
  warn: (message: string) => void = console.warn,
): Promise<string> {
  if (!plan) return Promise.resolve(file)
  const input = readFileSync(file)
  const dir = cacheDirFor(cacheDir, input, plan)
  const out = path.join(dir, `${path.parse(file).name}.${plan.format}`)
  // Per file name: two files with the same bytes share `dir`, but each has its own output.
  const keep = `${out}.keep-original`
  return once(out, async () => {
    if (existsSync(out)) return out
    if (existsSync(keep)) return file
    mkdirSync(dir, { recursive: true })
    let encoded: Buffer
    try {
      let image = sharp(input)
      if (plan.scale !== 1) {
        const meta = await image.metadata()
        const width = Math.max(1, Math.round((meta.width ?? 1) * plan.scale))
        image = image.resize({ width, kernel: 'lanczos3' })
      }
      const { quality } = plan
      encoded =
        plan.format === 'webp'
          ? await (quality === undefined
              ? image.webp({ lossless: true, exact: true, effort: 6 })
              : image.webp({ quality, effort: 6 })
            ).toBuffer()
          : await (quality === undefined
              ? image.avif({ lossless: true })
              : image.avif({ quality })
            ).toBuffer()
    } catch (error) {
      // e.g. WebP can't go over 16383 px on a side.
      warn(`[media] kept ${file} as it is: ${error instanceof Error ? error.message : error}`)
      writeFileSync(keep, '')
      return file
    }
    if (plan.scale === 1 && encoded.length >= input.length) {
      writeFileSync(keep, '')
      return file
    }
    writeFileSync(out, encoded)
    return out
  })
}

/** A small WebP copy of `file` for the gallery grid. */
export function makeThumbnail(
  file: string,
  settings: MediaConfig['images']['thumbnails'],
  cacheDir: string,
): Promise<string> {
  const input = readFileSync(file)
  const dir = cacheDirFor(cacheDir, input, { thumbnail: settings })
  const out = path.join(dir, `${path.parse(file).name}.thumb.webp`)
  return once(out, async () => {
    if (existsSync(out)) return out
    mkdirSync(dir, { recursive: true })
    const encoded = await sharp(input)
      .resize({ width: settings.width, withoutEnlargement: true })
      .webp({ quality: settings.quality })
      .toBuffer()
    writeFileSync(out, encoded)
    return out
  })
}
