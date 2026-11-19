// Layered portraits straight from Aseprite files.
// vite/aseprite turns src/content/**/name.aseprite into name.gen.png + name.gen.ts (typed);
// fromAseprite() turns that into a LayeredPortrait for defineCharacter({ layered }).
import type { AtlasFrame, FaceArea, LayeredPortrait, LayerSpec } from './define'

/** A trimmed image in the generated sheet, and where it sits on the Aseprite canvas. */
export interface AsepriteImage {
  x: number
  y: number
  w: number
  h: number
  at: { x: number; y: number }
  /** Its version per language (layers named "<name>.<lang>"), in the same sheet. */
  langs?: Readonly<Record<string, Omit<AsepriteImage, 'langs'>>>
}

export type AsepriteSlot =
  | { kind: 'static'; image: AsepriteImage }
  | { kind: 'part'; name: string; options: Record<string, AsepriteImage> }

declare const partNames: unique symbol

/** What a generated name.gen.ts exports. `P` = part name -> option names (from your @groups). */
export interface AsepritePortraitData<P> {
  sheet: string
  sheetWidth: number
  sheetHeight: number
  /** Aseprite canvas size. */
  width: number
  height: number
  /** The "#face" layer's box (where the face is), if the file has one. */
  face?: FaceArea
  slots: readonly AsepriteSlot[]
  readonly [partNames]?: P
}

type Choice<P> = { [K in keyof P]?: P[K] | null }

/** Parts to show, plus an optional face box. */
type WithFace<P> = Choice<P> & {
  /**
   * Where the face is (side image, small tiles), in portrait pixels. Overrides the Aseprite
   * file's "#face" layer, or sets it when the file has none. In `defaults`: for every
   * expression; in an expression: for that one only (e.g. a tilted head).
   */
  faceArea?: FaceArea
}

export interface AsepritePortraitConfig<P, E extends string> {
  /** Keep hard pixel edges when scaled up. Default true (Aseprite art is usually pixel art). */
  pixelated?: boolean
  /** The option each part shows when an expression doesn't say. Parts left out are hidden. */
  defaults?: WithFace<P>
  /** Named expressions (typed poses). The first one is the default. */
  expressions: Record<E, WithFace<P>>
  blink?: {
    [K in keyof P]: { layer: K; closed: P[K]; everyMs?: [number, number]; closedMs?: number }
  }[keyof P]
  talk?: { [K in keyof P]: { layer: K; open: P[K]; frameMs?: number } }[keyof P]
}

export function fromAseprite<P, const E extends string>(
  data: AsepritePortraitData<P>,
  config: AsepritePortraitConfig<P, E>,
): LayeredPortrait<E, P> {
  const frame = (image: AsepriteImage): AtlasFrame => ({
    atlas: data.sheet,
    sheetWidth: data.sheetWidth,
    sheetHeight: data.sheetHeight,
    x: image.x,
    y: image.y,
    w: image.w,
    h: image.h,
  })
  const at = (image: AsepriteImage) => ({ src: frame(image), x: image.at.x, y: image.at.y })
  const placed = (image: AsepriteImage) => {
    const langs = image.langs
      ? Object.fromEntries(Object.entries(image.langs).map(([lang, own]) => [lang, at(own)]))
      : undefined
    return langs ? { ...at(image), langs } : at(image)
  }
  type Picked = Record<string, string | null> & { faceArea?: FaceArea }
  const { faceArea, ...defaults } = (config.defaults ?? {}) as Picked
  // faceArea is not a layer: kept apart from the parts of each expression.
  const expressions: Record<string, Record<string, string | null>> = {}
  const faceAreas: Record<string, FaceArea> = {}
  for (const [name, choice] of Object.entries(config.expressions)) {
    const { faceArea: own, ...parts } = choice as Picked
    expressions[name] = parts
    if (own) faceAreas[name] = own
  }

  // Every slot becomes a layer, in Aseprite's drawing order. Always-drawn runs get internal names.
  const layers: Record<string, LayerSpec> = {}
  data.slots.forEach((slot, index) => {
    if (slot.kind === 'static') {
      layers[`_base${index}`] = { x: 0, y: 0, options: { on: placed(slot.image) }, default: 'on' }
    } else {
      const options: LayerSpec['options'] = {}
      for (const [name, image] of Object.entries(slot.options)) options[name] = placed(image)
      layers[slot.name] = { x: 0, y: 0, options, default: defaults[slot.name] ?? null }
    }
  })

  const blink = config.blink as
    | { layer: string; closed: string; everyMs?: [number, number]; closedMs?: number }
    | undefined
  const talk = config.talk as { layer: string; open: string; frameMs?: number } | undefined
  return {
    kind: 'layered',
    width: data.width,
    height: data.height,
    layers,
    expressions: expressions as Record<E, Record<string, string | null>>,
    pixelated: config.pixelated ?? true,
    faceArea: faceArea ?? data.face,
    faceAreas: faceAreas as Partial<Record<E, FaceArea>>,
    blink: blink && {
      layer: blink.layer,
      closed: blink.closed,
      everyMs: blink.everyMs ?? [2000, 6000],
      closedMs: blink.closedMs ?? 130,
    },
    talk: talk && { layer: talk.layer, open: talk.open, frameMs: talk.frameMs ?? 110 },
  }
}
