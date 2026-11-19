import type { VariantValue } from './variants'
// Gallery pictures (CGs): plain images, or layered CGs made from an Aseprite file with toggle layers
// (src/content/gallery/<id>/*.aseprite -> *.gen.ts). A variant is a named set of toggles:
// variants: { crying: { crying: true }, 'crying.full_moon': { crying: true, full_moon: true } }.
// Toggle layers are small images with a place on the canvas; places are used as fractions of the
// canvas, so they line up at any screen size and in the lite build's smaller files.

/** A layered CG (generated from Aseprite). T = toggle layer names. */
export interface LayeredCg<T extends string = string> {
  /** Canvas size in the Aseprite file. */
  width: number
  height: number
  /** The picture with no toggles on (every always-drawn layer flattened). */
  image: string
  /** Draw order, bottom first. toggle null = always drawn. x/y/w/h: place on the canvas (px). */
  parts: readonly CgPart<T>[]
  /**
   * Language -> its version (layers named "<name>.<lang>" in the Aseprite file): its own
   * flattened picture and parts. Languages without one use the above.
   */
  langs?: Readonly<Record<string, { image: string; parts: readonly CgPart<T>[] }>>
}

export interface CgPart<T extends string = string> {
  toggle: T | null
  src: string
  x: number
  y: number
  w: number
  h: number
}

/** A layered CG as drawn in `lang` (a language folder, or 'source'). */
function cgIn<T extends string>(cg: LayeredCg<T>, lang?: string): LayeredCg<T> {
  const version = lang ? cg.langs?.[lang] : undefined
  return version ? { ...cg, image: version.image, parts: version.parts } : cg
}

/** One image of a stacked picture. x/y/w/h are fractions (0-1) of the whole picture. */
export interface PictureLayer {
  src: string
  x: number
  y: number
  w: number
  h: number
}

/** Images stacked bottom first on a canvas of this shape (width / height). */
export interface StackedPicture {
  aspect: number
  layers: PictureLayer[]
}

/** What to draw: one image URL, or a stacked picture (a layered CG with toggles on). */
export type Picture = string | StackedPicture

/** Every image URL a picture needs. */
export function pictureUrls(picture: Picture): string[] {
  return typeof picture === 'string' ? [picture] : picture.layers.map((layer) => layer.src)
}

/** A picture for the gallery (src/content/gallery/<id>): shown in events with cg('<id>'). */
export interface GalleryConfig<T extends string = string, V extends string = string> {
  /** Only in the version of the game built with this content variant (src/content/config/variants.ts); left out of the others. */
  only?: VariantValue
  title: string
  /** Image URL (import image from './image.png'), or a layered CG (import cg from './pond.gen'). */
  image: string | LayeredCg<T>
  /**
   * Smaller picture for the gallery grid. Default: made automatically if the image is a PNG, JPG,
   * WebP, AVIF or layered CG inside src/content/gallery/ (see src/content/config/media.ts), else the image.
   */
  thumbnail?: string
  /**
   * Layered CGs: named sets of toggles, shown with cg('<id>', '<variant>'). Order = gallery order.
   * Only these are in the gallery: add `base: {}` (no toggles on) for the plain picture.
   */
  variants?: Record<V, Partial<Record<T, boolean>>>
}

export function isLayeredCg(value: unknown): value is LayeredCg {
  return typeof value === 'object' && value !== null && 'parts' in value
}

/**
 * The URL of the picture with no toggles on, in `lang` for a layered CG (its "<name>.<lang>"
 * layers). A plain image file is swapped later by lang.image (its "<name>.<lang>.<ext>" file).
 */
export function cgImage(config: PictureConfig, lang?: string): string {
  return isLayeredCg(config.image) ? cgIn(config.image, lang).image : config.image
}

/** What to draw for a variant (undefined = no toggles on: the flattened picture), in `lang`. */
export function cgPicture(config: PictureConfig, variant?: string, lang?: string): Picture {
  const cg = isLayeredCg(config.image) ? cgIn(config.image, lang) : config.image
  if (!isLayeredCg(cg) || variant === undefined) return cgImage(config, lang)
  const toggles = config.variants?.[variant]
  if (!toggles) {
    console.warn(`[gallery] "${config.title ?? 'a background'}" has no variant "${variant}"`)
    return cg.image
  }
  const on = cg.parts.filter((part) => part.toggle === null || toggles[part.toggle] === true)
  // No toggle on: the flattened picture is one image instead of several.
  if (on.every((part) => part.toggle === null)) return cg.image
  return {
    aspect: cg.width / cg.height,
    layers: on.map((part) => ({
      src: part.src,
      x: part.x / cg.width,
      y: part.y / cg.height,
      w: part.w / cg.width,
      h: part.h / cg.height,
    })),
  }
}

/**
 * The pictures in the gallery, in order. With variants: only those (the plain picture only as a
 * variant of its own, `base: {}`). Without: the one picture (undefined).
 */
export function cgVariants(config: GalleryConfig): (string | undefined)[] {
  const named = Object.keys(config.variants ?? {})
  return named.length > 0 ? named : [undefined]
}

/** Unlock key of one variant (the plain picture keeps the key it always had). */
export function cgUnlockKey(id: string, variant?: string): string {
  return variant === undefined ? `gallery:${id}` : `gallery:${id}:${variant}`
}

/** A gallery picture or a background: one picture, or a layered CG with named variants. */
export type PictureConfig = Pick<GalleryConfig, 'image' | 'variants'> & { title?: string }

/**
 * A background with variants (src/content/backgrounds/<name>/index.ts), made like a layered CG:
 * `image` is the .aseprite file's generated module, `variants` names sets of its "+toggle" layers.
 * A plain background needs no file of its own: drop the picture into src/content/backgrounds/.
 */
export interface BackgroundConfig<T extends string = string, V extends string = string> {
  /** A layered picture (import bg from './street.gen', made from street.aseprite), or a file URL. */
  image: string | LayeredCg<T>
  /**
   * Named sets of toggles: bg('town/street', 'evening'). With variants a background has ONLY these
   * (add `base: {}` for the picture with no toggles on).
   */
  variants?: Record<V, Partial<Record<T, boolean>>>
}

export function defineBackground<const T extends string = never, const V extends string = never>(
  config: BackgroundConfig<T, V>,
): BackgroundConfig<T, V> {
  return config
}

export function defineGallery<const T extends string = never, const V extends string = never>(
  config: GalleryConfig<T, V>,
): GalleryConfig<T, V> {
  return config
}
