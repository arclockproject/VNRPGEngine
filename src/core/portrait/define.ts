// Layered ("paper doll") portraits: one base image plus small parts (eyes, mouth, …) placed on
// top, and named expressions that pick a part per layer. Same idea as Ren'Py's layeredimage.
// Parts can be separate image files or frames of one atlas (sprite sheet) image.

/** A rectangle inside an atlas image, in the atlas image's pixels. */
export interface AtlasFrame {
  atlas: string
  sheetWidth: number
  sheetHeight: number
  x: number
  y: number
  w: number
  h: number
}

/** An image file URL (`import eyes from './eyes.png'`) or an atlas frame. */
export type ImageSource = string | AtlasFrame

/**
 * One big image with many small images in it. Frame names become typed properties:
 * `const sheet = defineAtlas({ src, width: 512, height: 256, frames: { eyes_open: { x: 0, y: 0, w: 40, h: 16 } } })`
 * then use `sheet.eyes_open` wherever an image is expected.
 */
export function defineAtlas<const F extends string>(config: {
  src: string
  /** Pixel size of the whole atlas image. */
  width: number
  height: number
  frames: Record<F, { x: number; y: number; w: number; h: number }>
}): Record<F, AtlasFrame> {
  const result = {} as Record<F, AtlasFrame>
  for (const name of Object.keys(config.frames) as F[]) {
    result[name] = {
      atlas: config.src,
      sheetWidth: config.width,
      sheetHeight: config.height,
      ...config.frames[name],
    }
  }
  return result
}

/** An image with its own position on the base (in base image pixels). */
export interface PlacedImage {
  src: ImageSource
  x?: number
  y?: number
}

/**
 * A part option: just an image (placed at the layer's x/y), or an image with its own position.
 * `langs`: its version per language (Aseprite layers named "<name>.<lang>"), drawn instead.
 */
export type PartOption =
  | ImageSource
  | (PlacedImage & { langs?: Readonly<Record<string, PlacedImage>> })

export interface LayerSpec {
  /** Top-left corner of the part on the base image, in base image pixels. */
  x: number
  y: number
  /** Named images for this layer, e.g. { open: eyesOpen, closed: eyesClosed }. */
  options: Record<string, PartOption>
  /** Option used when an expression doesn't mention this layer. Default: the first option. null = hidden. */
  default?: string | null
}

type Layers = Record<string, LayerSpec>
type OptionOf<L extends Layers, K extends keyof L> = keyof L[K]['options'] & string

/** Which option each layer shows (null hides the layer). Layers left out use their default. */
export type PartChoice<L extends Layers> = { [K in keyof L]?: OptionOf<L, K> | null }

declare const partsType: unique symbol

/** A box on a portrait, in its pixels: where the face is (side image, small tiles). Square is best. */
export interface FaceArea {
  x: number
  y: number
  w: number
  h: number
}

/** A built layered portrait. `E` = expression names, `P` = layer name -> option names. */
export interface LayeredPortrait<E extends string = string, P = Record<string, string>> {
  kind: 'layered'
  width: number
  height: number
  /** Always drawn first. Optional: Aseprite portraits put their base runs in `layers`. */
  base?: ImageSource
  layers: Layers
  expressions: Record<E, Record<string, string | null>>
  blink?: { layer: string; closed: string; everyMs: [number, number]; closedMs: number }
  talk?: { layer: string; open: string; frameMs: number }
  /** Keep hard pixel edges when scaled (pixel art). */
  pixelated?: boolean
  /** Where the face is (all expressions without their own). */
  faceArea?: FaceArea
  /** Per expression: where the face is when it differs (a tilted head). */
  faceAreas?: Partial<Record<E, FaceArea>>
  /** Type-only: the layer/option names, for show('anna', { parts: { mouth: 'frown' } }). */
  readonly [partsType]?: P
}

export type PartsOfPortrait<T> = T extends { readonly [partsType]?: infer P } ? P : never

export function defineLayeredPortrait<const L extends Layers, const E extends string>(config: {
  /** Pixel size of the base image; layer x/y are measured on it. */
  width: number
  height: number
  base: ImageSource
  /** Drawn in this order on top of the base (later = in front). */
  layers: L
  /** Named expressions. The first one is the default. */
  expressions: Record<E, PartChoice<L>>
  /** Auto-blink: every 2–6 s (default) the layer briefly shows `closed`. */
  blink?: {
    [K in keyof L]: {
      layer: K
      closed: OptionOf<L, K>
      everyMs?: [number, number]
      closedMs?: number
    }
  }[keyof L]
  /** While the character's line is typing, the layer flips between its option and `open`. */
  talk?: { [K in keyof L]: { layer: K; open: OptionOf<L, K>; frameMs?: number } }[keyof L]
}): LayeredPortrait<E, { [K in keyof L]: OptionOf<L, K> }> {
  return {
    kind: 'layered',
    width: config.width,
    height: config.height,
    base: config.base,
    layers: config.layers,
    expressions: config.expressions as Record<E, Record<string, string | null>>,
    blink: config.blink && {
      layer: config.blink.layer as string,
      closed: config.blink.closed,
      everyMs: config.blink.everyMs ?? [2000, 6000],
      closedMs: config.blink.closedMs ?? 130,
    },
    talk: config.talk && {
      layer: config.talk.layer as string,
      open: config.talk.open,
      frameMs: config.talk.frameMs ?? 110,
    },
  }
}

export function isLayered(value: unknown): value is LayeredPortrait {
  return (
    typeof value === 'object' && value !== null && (value as { kind?: unknown }).kind === 'layered'
  )
}

/** The option each layer shows for an expression plus overrides (null = hidden). */
export function resolveParts(
  portrait: LayeredPortrait,
  expression: string | null,
  overrides: Record<string, string | null> = {},
): Record<string, string | null> {
  const chosen = (expression && portrait.expressions[expression]) || {}
  const result: Record<string, string | null> = {}
  for (const [name, layer] of Object.entries(portrait.layers)) {
    const fallback =
      layer.default === undefined ? (Object.keys(layer.options)[0] ?? null) : layer.default
    const pick = name in overrides ? overrides[name] : name in chosen ? chosen[name] : fallback
    result[name] = pick !== undefined && pick !== null && pick in layer.options ? pick : null
  }
  return result
}

/** Every image URL a portrait uses (to preload them, so blinking never flickers). */
export function portraitUrls(portrait: LayeredPortrait): string[] {
  const urls = new Set<string>()
  const add = (source: ImageSource) => urls.add(typeof source === 'string' ? source : source.atlas)
  if (portrait.base) add(portrait.base)
  for (const layer of Object.values(portrait.layers)) {
    for (const option of Object.values(layer.options)) {
      if (typeof option === 'object' && 'src' in option) {
        add(option.src)
        for (const version of Object.values(option.langs ?? {})) add(version.src)
      } else add(option)
    }
  }
  return [...urls]
}
