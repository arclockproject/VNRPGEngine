// Turns an Aseprite file into a layered portrait: one atlas PNG + a typed TypeScript module.
//
// Rules (see CLAUDE.memory.md / the character docs):
// - Layers and plain groups ("folders") are always drawn: the base.
// - A group named "@Name" is a part: exactly one of its children shows at a time (an option).
//   A child layer is one option; a plain child group is one option made of several layers.
// - Every layer is used, hidden or not (hide layers in Aseprite as you like while you paint).
// - Names starting with "_" are ignored. Names starting with "#" are markers, never drawn:
//   "#face" = the face box (the bounding box of its pixels), for the side image and small tiles.
// - Layer order = drawing order.
import type { AseFile, AseLayer } from './read.ts'

export interface Bitmap {
  /** Position of the trimmed image on the canvas. */
  x: number
  y: number
  width: number
  height: number
  pixels: Uint8Array
}

/** Language -> the image in that language, only where it differs (layers named "<name>.<lang>"). */
export type LangImages = Record<string, Bitmap>

export type Slot =
  | { kind: 'static'; image: Bitmap; langs?: LangImages }
  | {
      kind: 'part'
      name: string
      options: { name: string; image: Bitmap; langs?: LangImages }[]
    }

/** "Half Closed" -> "half_closed". Returns null if it can't be used as an id. */
export function toId(name: string): string | null {
  const id = name
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
  return /^[a-z][a-z0-9_]*$/.test(id) ? id : null
}

/** Not drawn: "_name" (left out) and "#name" (markers such as "#face"). Hidden layers ARE drawn. */
export const ignored = (layer: AseLayer) => layer.name.startsWith('_') || layer.name.startsWith('#')

/** The face box from a "#face" layer, in canvas pixels. */
export interface FaceBox {
  x: number
  y: number
  w: number
  h: number
}

/** Bounding box of the pixels on the "#face" layer (anywhere in the tree), or null. */
export function findFace(file: AseFile, warn: (message: string) => void): FaceBox | null {
  const found: AseLayer[] = []
  const walk = (layer: AseLayer) => {
    if (layer.name.trim().toLowerCase() === '#face') found.push(layer)
    else for (const child of layer.children) walk(child)
  }
  for (const root of file.roots) walk(root)
  if (found.length === 0) return null
  if (found.length > 1) warn('more than one "#face" layer: the first one is used')
  // Drawn under another name (markers are never drawn), only to find its pixels.
  const layer = found[0] as AseLayer
  const image = trim(file, composite(file, [{ ...layer, name: 'face' }]))
  if (!image) {
    warn('"#face" is empty: draw a filled square where the face is')
    return null
  }
  const box = { x: image.x, y: image.y, w: image.width, h: image.height }
  if (Math.abs(box.w - box.h) > Math.max(1, 0.02 * Math.max(box.w, box.h)))
    warn(`"#face" is ${box.w}x${box.h}, not a square: it is fitted into a square`)
  return box
}

/** Draws `layers` (and everything inside groups) onto one full-size canvas, in order. */
export function composite(file: AseFile, layers: AseLayer[], cels = file.cels): Uint8Array {
  const out = new Uint8Array(file.width * file.height * 4)
  const draw = (layer: AseLayer, parentOpacity: number) => {
    if (ignored(layer)) return
    const opacity = (parentOpacity * layer.opacity) / 255
    if (layer.type === 1) {
      for (const child of layer.children) draw(child, opacity)
      return
    }
    const cel = cels.get(layer.index)
    if (!cel) return
    const alphaScale = (opacity * cel.opacity) / (255 * 255)
    for (let cy = 0; cy < cel.height; cy++) {
      const y = cel.y + cy
      if (y < 0 || y >= file.height) continue
      for (let cx = 0; cx < cel.width; cx++) {
        const x = cel.x + cx
        if (x < 0 || x >= file.width) continue
        const s = (cy * cel.width + cx) * 4
        const sa = ((cel.pixels[s + 3] ?? 0) / 255) * alphaScale
        if (sa <= 0) continue
        const d = (y * file.width + x) * 4
        const da = (out[d + 3] ?? 0) / 255
        const a = sa + da * (1 - sa)
        for (let k = 0; k < 3; k++) {
          const sc = cel.pixels[s + k] ?? 0
          const dc = out[d + k] ?? 0
          out[d + k] = Math.round((sc * sa + dc * da * (1 - sa)) / a)
        }
        out[d + 3] = Math.round(a * 255)
      }
    }
  }
  for (const layer of layers) draw(layer, 255)
  return out
}

/** Crops a full-size canvas to its visible pixels. Null if nothing is visible. */
export function trim(file: AseFile, canvas: Uint8Array): Bitmap | null {
  let minX = file.width
  let minY = file.height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < file.height; y++) {
    for (let x = 0; x < file.width; x++) {
      if ((canvas[(y * file.width + x) * 4 + 3] ?? 0) === 0) continue
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }
  if (maxX < 0) return null
  const width = maxX - minX + 1
  const height = maxY - minY + 1
  const pixels = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    const from = ((minY + y) * file.width + minX) * 4
    pixels.set(canvas.subarray(from, from + width * 4), y * width * 4)
  }
  return { x: minX, y: minY, width, height, pixels }
}

/** Walks the layer tree into slots: runs of always-drawn layers, and @parts. */
export function buildSlots(file: AseFile, warn: (message: string) => void): Slot[] {
  const slots: Slot[] = []
  let run: AseLayer[] = []
  const partNames = new Set<string>()

  const flushRun = () => {
    if (run.length === 0) return
    const image = trim(file, composite(file, run))
    if (image) slots.push({ kind: 'static', image })
    run = []
  }

  const visit = (layer: AseLayer) => {
    if (ignored(layer)) return
    if (layer.type === 2) return warn(`"${layer.name}": tilemap layers are not supported, skipped`)
    if (layer.type === 1 && layer.name.startsWith('@')) {
      flushRun()
      const name = toId(layer.name.slice(1))
      if (!name)
        return warn(`"${layer.name}": part names need letters/digits/_ (starting with a letter)`)
      if (partNames.has(name))
        return warn(`"${layer.name}": a part called "${name}" already exists`)
      partNames.add(name)
      const options: { name: string; image: Bitmap }[] = []
      for (const child of layer.children) {
        if (ignored(child)) continue
        if (child.type === 1 && child.name.startsWith('@')) {
          warn(`"${child.name}" inside "${layer.name}": a part can't contain parts, skipped`)
          continue
        }
        const option = toId(child.name)
        if (!option) {
          warn(`"${layer.name}/${child.name}": option names need letters/digits/_, skipped`)
          continue
        }
        if (options.some((o) => o.name === option)) {
          warn(
            `"${layer.name}/${child.name}": "${option}" is already an option of "${name}", skipped`,
          )
          continue
        }
        const image = trim(file, composite(file, [child]))
        if (!image) {
          warn(`"${layer.name}/${child.name}" is empty, skipped`)
          continue
        }
        options.push({ name: option, image })
      }
      if (options.length === 0) warn(`"${layer.name}" has no options`)
      else slots.push({ kind: 'part', name, options })
      return
    }
    if (layer.type === 1) {
      // A plain folder: its contents are drawn in place (and may contain @parts).
      for (const child of layer.children) visit(child)
      return
    }
    run.push(layer)
  }

  for (const root of file.roots) visit(root)
  flushRun()
  return slots
}

const sameBitmap = (a: Bitmap, b: Bitmap) =>
  a.x === b.x &&
  a.y === b.y &&
  a.width === b.width &&
  a.height === b.height &&
  Buffer.from(a.pixels).equals(Buffer.from(b.pixels))

/**
 * Adds `lang`'s images to `base` (built from the same file with its "<name>.<lang>" layers in
 * place): only the slots / options whose picture differs get a language image.
 */
export function addLanguageSlots(
  base: Slot[],
  lang: string,
  other: Slot[],
  warn: (message: string) => void,
) {
  if (other.length !== base.length) {
    warn(`the ${lang} layers change which parts there are; ${lang} is left out`)
    return
  }
  base.forEach((slot, i) => {
    const theirs = other[i]
    if (slot.kind === 'static' && theirs?.kind === 'static') {
      if (!sameBitmap(slot.image, theirs.image))
        slot.langs = { ...slot.langs, [lang]: theirs.image }
      return
    }
    if (slot.kind === 'part' && theirs?.kind === 'part') {
      for (const option of slot.options) {
        const match = theirs.options.find((o) => o.name === option.name)
        if (match && !sameBitmap(option.image, match.image))
          option.langs = { ...option.langs, [lang]: match.image }
      }
      return
    }
    warn(`the ${lang} layers change the order of parts; part ${i + 1} is left out in ${lang}`)
  })
}

/** An image and its language images, in a fixed order (sheet packing and the module agree). */
const withLangs = (image: Bitmap, langs?: LangImages): Bitmap[] => [
  image,
  ...Object.keys(langs ?? {})
    .sort()
    .map((lang) => (langs as LangImages)[lang] as Bitmap),
]

export interface Packed {
  width: number
  height: number
  pixels: Uint8Array
  /** Where each bitmap ended up in the atlas, in input order. */
  places: { x: number; y: number }[]
}

/** Simple shelf packing with 2px gaps (no bleeding between parts when scaled). */
export function pack(bitmaps: Bitmap[]): Packed {
  const GAP = 2
  const area = bitmaps.reduce((sum, b) => sum + (b.width + GAP) * (b.height + GAP), 0)
  const widest = Math.max(1, ...bitmaps.map((b) => b.width + GAP * 2))
  const width = Math.max(widest, Math.ceil(Math.sqrt(area) * 1.15))
  const order = bitmaps
    .map((_, i) => i)
    .sort((a, b) => (bitmaps[b]?.height ?? 0) - (bitmaps[a]?.height ?? 0))
  const places: { x: number; y: number }[] = new Array(bitmaps.length)
  let x = GAP
  let y = GAP
  let shelf = 0
  for (const i of order) {
    const b = bitmaps[i] as Bitmap
    if (x + b.width + GAP > width) {
      x = GAP
      y += shelf + GAP
      shelf = 0
    }
    places[i] = { x, y }
    x += b.width + GAP
    shelf = Math.max(shelf, b.height)
  }
  const height = Math.max(1, y + shelf + GAP)
  const pixels = new Uint8Array(width * height * 4)
  bitmaps.forEach((b, i) => {
    const p = places[i] as { x: number; y: number }
    for (let row = 0; row < b.height; row++) {
      pixels.set(
        b.pixels.subarray(row * b.width * 4, (row + 1) * b.width * 4),
        ((p.y + row) * width + p.x) * 4,
      )
    }
  })
  return { width, height, pixels, places }
}

/** The generated TypeScript module (imports the generated PNG next to it). */
export function renderModule(
  sourceName: string,
  pngName: string,
  file: AseFile,
  slots: Slot[],
  packed: Packed,
  face: FaceBox | null = null,
) {
  let next = 0
  const place = (b: Bitmap) => {
    const p = packed.places[next++] as { x: number; y: number }
    return `x: ${p.x}, y: ${p.y}, w: ${b.width}, h: ${b.height}, at: { x: ${b.x}, y: ${b.y} }`
  }
  const image = (b: Bitmap, langs?: LangImages) => {
    const own = place(b)
    const names = Object.keys(langs ?? {}).sort()
    if (names.length === 0) return `{ ${own} }`
    const versions = names.map(
      (lang) => `${lang}: { ${place((langs as LangImages)[lang] as Bitmap)} }`,
    )
    return `{ ${own}, langs: { ${versions.join(', ')} } }`
  }
  const lines = [
    `// AUTO-GENERATED from ${sourceName} by vite/aseprite. Do not edit: change the .aseprite file instead.`,
    "import type { AsepritePortraitData } from '@/core/portrait/aseprite'",
    `import sheet from './${pngName}'`,
    '',
    'const data = {',
    '  sheet,',
    `  sheetWidth: ${packed.width},`,
    `  sheetHeight: ${packed.height},`,
    `  width: ${file.width},`,
    `  height: ${file.height},`,
    ...(face ? [`  face: { x: ${face.x}, y: ${face.y}, w: ${face.w}, h: ${face.h} },`] : []),
    '  slots: [',
  ]
  for (const slot of slots) {
    if (slot.kind === 'static') {
      lines.push(`    { kind: 'static', image: ${image(slot.image, slot.langs)} },`)
    } else {
      lines.push(`    { kind: 'part', name: '${slot.name}', options: {`)
      for (const option of slot.options)
        lines.push(`      ${option.name}: ${image(option.image, option.langs)},`)
      lines.push('    } },')
    }
  }
  const parts = slots.filter((s): s is Extract<Slot, { kind: 'part' }> => s.kind === 'part')
  const partsType = parts.length
    ? `{ ${parts.map((p) => `${p.name}: ${p.options.map((o) => `'${o.name}'`).join(' | ')}`).join('; ')} }`
    : 'Record<never, never>'
  lines.push('  ],', '}', '', `export default data as AsepritePortraitData<${partsType}>`, '')
  return lines.join('\n')
}

/** Bitmaps in the order renderModule() walks them (to pack them in the same order). */
export function slotBitmaps(slots: Slot[]): Bitmap[] {
  return slots.flatMap((slot) =>
    slot.kind === 'static'
      ? withLangs(slot.image, slot.langs)
      : slot.options.flatMap((o) => withLangs(o.image, o.langs)),
  )
}
