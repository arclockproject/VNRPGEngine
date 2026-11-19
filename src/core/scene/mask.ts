// Mask transitions for backgrounds (src/content/scenes.ts `transitions`): a "rule" says for every
// spot of the screen how early the new picture shows there (0 = first, 1 = last). Like Ren'Py's
// ImageDissolve and KiriKiri's universal transition. The rule is kept small (MASK_W × MASK_H) and
// stretched over the screen, so a frame costs some ten thousand numbers, not a million pixels.
import scenes from '@/content/scenes'
import type { Picture } from '../gallery'
import type { MaskTransition } from '../scenes'
import { backgroundKind } from './background'
import type { TransitionName } from './types'

export const MASK_W = 384
export const MASK_H = 216
export const DEFAULT_SOFTNESS = scenes.maskSoftness

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/**
 * How visible (0..1) the new picture is at a spot with rule value `value`, at `progress` 0..1.
 * At 0 nothing shows, at 1 everything does; `softness` is the width of the moving edge.
 */
export function maskAlpha(value: number, progress: number, softness: number): number {
  if (progress <= 0) return 0
  if (progress >= 1) return 1
  const soft = Math.max(0.001, softness)
  return clamp01((progress * (1 + soft) - value) / soft)
}

/** A rule function sampled at the middle of every mask pixel. */
export function ruleFromFunction(
  fn: (x: number, y: number) => number,
  width = MASK_W,
  height = MASK_H,
): Float32Array {
  const rule = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      rule[y * width + x] = clamp01(fn((x + 0.5) / width, (y + 0.5) / height))
    }
  }
  return rule
}

/** A greyscale picture as a rule: black = 0 (first), white = 1 (last). */
async function ruleFromImage(url: string): Promise<Float32Array> {
  const image = new Image()
  image.src = url
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = MASK_W
  canvas.height = MASK_H
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('no 2d canvas')
  ctx.drawImage(image, 0, 0, MASK_W, MASK_H)
  const { data } = ctx.getImageData(0, 0, MASK_W, MASK_H)
  const rule = new Float32Array(MASK_W * MASK_H)
  for (let i = 0; i < rule.length; i++) {
    const p = i * 4
    const r = data[p] ?? 0
    const g = data[p + 1] ?? 0
    const b = data[p + 2] ?? 0
    rule[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  }
  return rule
}

const transitions = scenes.transitions as Record<string, MaskTransition>
const rules = new Map<string, Promise<Float32Array>>()

export const maskTransition = (name: TransitionName): MaskTransition | undefined =>
  transitions[name]

/** The rule of a named transition (made once, then kept). */
export function loadRule(name: TransitionName): Promise<Float32Array> {
  let rule = rules.get(name)
  if (!rule) {
    const config = transitions[name]
    if (!config) return Promise.reject(new Error(`No transition "${name}"`))
    rule =
      typeof config.rule === 'string'
        ? ruleFromImage(config.rule)
        : Promise.resolve(ruleFromFunction(config.rule))
    rule.catch(() => rules.delete(name))
    rules.set(name, rule)
  }
  return rule
}

/** Writes the mask of one moment into `pixels` (RGBA, MASK_W × MASK_H): alpha = how visible. */
export function fillMask(
  pixels: Uint8ClampedArray,
  rule: Float32Array,
  progress: number,
  softness: number,
  reverse: boolean,
): void {
  for (let i = 0; i < rule.length; i++) {
    const value = rule[i] ?? 0
    pixels[i * 4 + 3] = maskAlpha(reverse ? 1 - value : value, progress, softness) * 255
  }
}

/** Where a picture of shape `aspect` (w / h) goes to cover a `width` × `height` box, centred. */
export function coverRect(aspect: number, width: number, height: number) {
  const w = Math.max(width, height * aspect)
  const h = w / aspect
  return { x: (width - w) / 2, y: (height - h) / 2, w, h }
}

// ---------------------------------------------------------------- drawing (browser only)

/** Can this background come in by a mask? Pictures, layered CGs and plain colours can. */
export function canMask(value: Picture): boolean {
  if (typeof value !== 'string') return true
  const kind = backgroundKind(value)
  return kind === 'image' || kind === 'colour'
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image()
  image.src = url
  await image.decode()
  return image
}

type Draw = (ctx: CanvasRenderingContext2D) => void

/** How to paint a background on a `width` × `height` canvas, covering it like the real one does. */
async function pictureDrawer(value: Picture, width: number, height: number): Promise<Draw> {
  if (typeof value !== 'string') {
    const images = await Promise.all(value.layers.map((layer) => loadImage(layer.src)))
    const box = coverRect(value.aspect, width, height)
    return (ctx) => {
      value.layers.forEach((layer, i) => {
        const image = images[i]
        if (!image) return
        ctx.drawImage(
          image,
          box.x + layer.x * box.w,
          box.y + layer.y * box.h,
          layer.w * box.w,
          layer.h * box.h,
        )
      })
    }
  }
  if (backgroundKind(value) === 'image') {
    const image = await loadImage(value)
    const box = coverRect(image.naturalWidth / Math.max(1, image.naturalHeight), width, height)
    return (ctx) => ctx.drawImage(image, box.x, box.y, box.w, box.h)
  }
  return (ctx) => {
    ctx.fillStyle = value
    ctx.fillRect(0, 0, width, height)
  }
}

/**
 * Plays a named transition on `canvas`: paints `value` through the moving mask for `duration` ms.
 * Resolves when it is over (or at once if something can't be loaded). `alive` = keep going.
 */
export async function playMask(
  canvas: HTMLCanvasElement,
  value: Picture,
  name: TransitionName,
  duration: number,
  alive: () => boolean,
): Promise<void> {
  const config = maskTransition(name)
  const ctx = canvas.getContext('2d')
  if (!config || !ctx || duration <= 0) return
  const rect = canvas.getBoundingClientRect()
  const density = Math.min(window.devicePixelRatio || 1, 2)
  const width = Math.max(1, Math.round(rect.width * density))
  const height = Math.max(1, Math.round(rect.height * density))
  canvas.width = width
  canvas.height = height
  const [rule, draw] = await Promise.all([loadRule(name), pictureDrawer(value, width, height)])
  const small = document.createElement('canvas')
  small.width = MASK_W
  small.height = MASK_H
  const smallCtx = small.getContext('2d')
  if (!smallCtx || !alive()) return
  const pixels = smallCtx.createImageData(MASK_W, MASK_H)
  const softness = config.softness ?? DEFAULT_SOFTNESS
  await new Promise<void>((resolve) => {
    const start = performance.now()
    const frame = (now: number) => {
      if (!alive()) return resolve()
      const progress = Math.min(1, Math.max(0, (now - start) / duration))
      fillMask(pixels.data, rule, progress, softness, config.reverse === true)
      smallCtx.putImageData(pixels, 0, 0)
      ctx.globalCompositeOperation = 'source-over'
      ctx.clearRect(0, 0, width, height)
      draw(ctx)
      // Keep the picture only where the mask is solid; the old background shows through the rest.
      ctx.globalCompositeOperation = 'destination-in'
      ctx.drawImage(small, 0, 0, width, height)
      if (progress >= 1) resolve()
      else requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  })
}
