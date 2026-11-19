// Turns an Aseprite file with frames + tags into an animated sprite sheet: one PNG + a typed module.
//
// Rules:
// - Every layer is drawn, hidden or not (groups are just folders here; "@" has no special
//   meaning). Names starting with "_" are ignored; "#name" is a marker, never drawn.
// - Each tag becomes an animation, named after the tag (lowercase, spaces/dashes -> _).
//   Name them state_direction for the map: idle_down, walk_left, talk_up, wave… (left can be
//   left out: the engine mirrors right). No tags = one animation "idle" with every frame.
// - Tag direction (forward/reverse/ping-pong) and repeat count are respected; frame durations too.
// - Frames are cropped to the area any frame uses; identical frames are stored once.
// - Slices: "origin" = the feet (its pivot if set, else the bottom centre of the slice; default: the
//   bottom centre of the canvas). "collision" / "collision_*" = the hitbox (all together), e.g. the
//   feet/legs. "interact" = where the player must face to use it (default: the collision boxes).
//   "trigger" / "trigger_*" = walk-over areas (onEnter) that don't block.
//   Only frame 1 of a slice counts for now. Other slice names are ignored (warning).
import { composite, ignored, toId } from './portrait.ts'
import type { AseFile, AseSlice, AseSliceKey } from './read.ts'

export interface SpriteAnimation {
  /** Indexes into SpriteSheet.cells, in play order. */
  frames: number[]
  /** Milliseconds per entry in `frames`. */
  durations: number[]
  /** 0 = loop forever, N = play N times. */
  repeat: number
}

export interface SpriteSheet {
  /** Aseprite canvas size. */
  width: number
  height: number
  /** The cropped area of the canvas every frame image covers. */
  box: { x: number; y: number; w: number; h: number }
  /** Unique frame images, box.w × box.h RGBA each. */
  cells: Uint8Array[]
  animations: Record<string, SpriteAnimation>
  /** The feet, in canvas pixels. */
  origin: { x: number; y: number }
  /** Hitbox rectangles in pixels, relative to the origin. Empty = engine default. */
  collision: { x: number; y: number; w: number; h: number }[]
  /** Interaction areas, same units. Empty = use the collision boxes. */
  interact: { x: number; y: number; w: number; h: number }[]
  /** Walk-over (onEnter) areas, same units. */
  triggers: { x: number; y: number; w: number; h: number }[]
  /**
   * Languages whose "<name>.<lang>" layers change the picture: their cells, in the same order and
   * size as `cells` (so the same sheet layout works for every language).
   */
  langCells: Record<string, Uint8Array[]>
}

/** First key of a slice; warns when later frames move it (not supported yet). */
function firstKey(slice: AseSlice, warn: (message: string) => void): AseSliceKey | undefined {
  const [key, ...rest] = slice.keys
  const moves = rest.some(
    (k) =>
      k.x !== key?.x ||
      k.y !== key?.y ||
      k.w !== key?.w ||
      k.h !== key?.h ||
      k.pivot?.x !== key?.pivot?.x ||
      k.pivot?.y !== key?.pivot?.y,
  )
  if (moves) warn(`slice "${slice.name}" changes between frames; only frame 1 is used for now`)
  return key
}

/** Reads the origin, collision, interact and trigger slices. */
export function spriteSlices(file: AseFile, warn: (message: string) => void) {
  let origin = { x: file.width / 2, y: file.height }
  const boxes: AseSliceKey[] = []
  const interact: AseSliceKey[] = []
  const triggers: AseSliceKey[] = []
  let originSeen = false
  for (const slice of file.slices) {
    const id = toId(slice.name)
    const key = firstKey(slice, warn)
    if (!key) continue
    if (id === 'origin') {
      if (originSeen) warn('more than one "origin" slice; the first one is used')
      else
        origin = key.pivot
          ? { x: key.x + key.pivot.x, y: key.y + key.pivot.y }
          : { x: key.x + key.w / 2, y: key.y + key.h }
      originSeen = true
    } else if (id && /^collision(_|$)/.test(id)) {
      boxes.push(key)
    } else if (id && /^interact(_|$)/.test(id)) {
      interact.push(key)
    } else if (id && /^trigger(_|$)/.test(id)) {
      triggers.push(key)
    } else {
      warn(
        `slice "${slice.name}" ignored (sprites use "origin", "collision…", "interact…" and "trigger…" slices)`,
      )
    }
  }
  const relative = (list: AseSliceKey[]) =>
    list.map((b) => ({ x: b.x - origin.x, y: b.y - origin.y, w: b.w, h: b.h }))
  return {
    origin,
    collision: relative(boxes),
    interact: relative(interact),
    triggers: relative(triggers),
  }
}

/** Frame order for a tag, following its direction. */
export function tagSequence(
  from: number,
  to: number,
  direction: 'forward' | 'reverse' | 'pingpong' | 'pingpong_reverse',
): number[] {
  const up: number[] = []
  for (let i = from; i <= to; i++) up.push(i)
  const down = [...up].reverse()
  if (direction === 'reverse') return down
  // Ping-pong doesn't repeat the end frames: 0 1 2 1 | 0 1 2 1 …
  if (direction === 'pingpong') return [...up, ...down.slice(1, -1)]
  if (direction === 'pingpong_reverse') return [...down, ...up.slice(1, -1)]
  return up
}

/**
 * `file` is the source-language view; `languages` the same file as drawn in each language
 * ("<name>.<lang>" layers in place, see lang.ts).
 */
export function buildSprite(
  file: AseFile,
  warn: (message: string) => void,
  languages: { lang: string; file: AseFile }[] = [],
): SpriteSheet {
  const draw = (view: AseFile) => {
    const roots = view.roots.filter((layer) => !ignored(layer))
    return view.frames.map((frame) => composite(view, roots, frame.cels))
  }
  const canvases = draw(file)
  const langCanvases = languages.map(({ lang, file: view }) => ({ lang, canvases: draw(view) }))

  // One box for all frames (in every language), so the character doesn't jump around.
  let minX = file.width
  let minY = file.height
  let maxX = -1
  let maxY = -1
  for (const canvas of [...canvases, ...langCanvases.flatMap((l) => l.canvases)]) {
    for (let y = 0; y < file.height; y++) {
      for (let x = 0; x < file.width; x++) {
        if ((canvas[(y * file.width + x) * 4 + 3] ?? 0) === 0) continue
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) throw new Error('every frame is empty')
  const box = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }

  const crop = (canvas: Uint8Array) => {
    const cell = new Uint8Array(box.w * box.h * 4)
    for (let y = 0; y < box.h; y++) {
      const from = ((box.y + y) * file.width + box.x) * 4
      cell.set(canvas.subarray(from, from + box.w * 4), y * box.w * 4)
    }
    return cell
  }
  const cells: Uint8Array[] = []
  const langCells: Record<string, Uint8Array[]> = {}
  for (const { lang } of langCanvases) langCells[lang] = []
  const keys = new Map<string, number>()
  const cellOfFrame = canvases.map((canvas, frame) => {
    const cell = crop(canvas)
    const versions = langCanvases.map((l) => crop(l.canvases[frame] as Uint8Array))
    // Frames are the same cell only when they match in every language.
    const key = [cell, ...versions].map((c) => Buffer.from(c).toString('base64')).join('|')
    let index = keys.get(key)
    if (index === undefined) {
      index = cells.length
      cells.push(cell)
      langCanvases.forEach((l, i) => {
        langCells[l.lang]?.push(versions[i] as Uint8Array)
      })
      keys.set(key, index)
    }
    return index
  })
  // A language that looks the same everywhere needs no sheet of its own.
  for (const lang of Object.keys(langCells)) {
    const own = langCells[lang] as Uint8Array[]
    if (own.every((cell, i) => Buffer.from(cell).equals(Buffer.from(cells[i] as Uint8Array))))
      delete langCells[lang]
  }

  const animations: Record<string, SpriteAnimation> = {}
  const make = (sequence: number[], repeat: number): SpriteAnimation => ({
    frames: sequence.map((f) => cellOfFrame[f] ?? 0),
    durations: sequence.map((f) => Math.max(1, file.frames[f]?.duration ?? 100)),
    repeat,
  })
  for (const tag of file.tags) {
    const name = toId(tag.name)
    if (!name) {
      warn(`tag "${tag.name}": names need letters/digits/_ (starting with a letter), skipped`)
      continue
    }
    if (animations[name]) {
      warn(`tag "${tag.name}": an animation called "${name}" already exists, skipped`)
      continue
    }
    const to = Math.min(tag.to, file.frames.length - 1)
    animations[name] = make(tagSequence(tag.from, to, tag.direction), tag.repeat)
  }
  if (file.tags.length === 0) {
    animations.idle = make(
      file.frames.map((_, i) => i),
      0,
    )
  }
  return {
    width: file.width,
    height: file.height,
    box,
    cells,
    animations,
    ...spriteSlices(file, warn),
    langCells,
  }
}

/** All cells in a grid with 2px gaps (no bleeding when scaled). `cells`: a language's own cells. */
export function packSprite(sheet: SpriteSheet, cells: Uint8Array[] = sheet.cells) {
  const GAP = 2
  const { w, h } = sheet.box
  const columns = Math.max(1, Math.ceil(Math.sqrt(cells.length)))
  const rows = Math.ceil(cells.length / columns)
  const width = GAP + columns * (w + GAP)
  const height = GAP + rows * (h + GAP)
  const pixels = new Uint8Array(width * height * 4)
  const places = cells.map((cell, i) => {
    const x = GAP + (i % columns) * (w + GAP)
    const y = GAP + Math.floor(i / columns) * (h + GAP)
    for (let row = 0; row < h; row++)
      pixels.set(cell.subarray(row * w * 4, (row + 1) * w * 4), ((y + row) * width + x) * 4)
    return { x, y }
  })
  return { width, height, pixels, places }
}

const boxList = (boxes: { x: number; y: number; w: number; h: number }[]) =>
  `[${boxes.map((c) => `{ x: ${c.x}, y: ${c.y}, w: ${c.w}, h: ${c.h} }`).join(', ')}]`

export function renderSpriteModule(
  sourceName: string,
  pngName: string,
  sheet: SpriteSheet,
  packed: ReturnType<typeof packSprite>,
  /** Language -> its own sheet file (same layout), for "<name>.<lang>" layers. */
  langSheets: Record<string, string> = {},
) {
  const names = Object.keys(sheet.animations)
  const { box } = sheet
  const langs = Object.keys(langSheets).sort()
  const lines = [
    `// AUTO-GENERATED from ${sourceName} by vite/aseprite. Do not edit: change the .aseprite file instead.`,
    "import type { AsepriteSpriteData } from '@/core/sprite/types'",
    `import sheet from './${pngName}'`,
    ...langs.map((lang) => `import sheet_${lang} from './${langSheets[lang]}'`),
    '',
    'const data = {',
    '  sheet,',
    ...(langs.length ? [`  sheets: { ${langs.map((l) => `${l}: sheet_${l}`).join(', ')} },`] : []),
    `  sheetWidth: ${packed.width},`,
    `  sheetHeight: ${packed.height},`,
    `  width: ${sheet.width},`,
    `  height: ${sheet.height},`,
    `  box: { x: ${box.x}, y: ${box.y}, w: ${box.w}, h: ${box.h} },`,
    `  cells: [${packed.places.map((p) => `[${p.x}, ${p.y}]`).join(', ')}],`,
    `  origin: { x: ${sheet.origin.x}, y: ${sheet.origin.y} },`,
    `  collision: ${boxList(sheet.collision)},`,
    `  interact: ${boxList(sheet.interact)},`,
    `  triggers: ${boxList(sheet.triggers)},`,
    '  animations: {',
  ]
  for (const name of names) {
    const a = sheet.animations[name] as SpriteAnimation
    lines.push(
      `    ${name}: { frames: [${a.frames.join(', ')}], durations: [${a.durations.join(', ')}], repeat: ${a.repeat} },`,
    )
  }
  const type = names.map((n) => `'${n}'`).join(' | ') || 'never'
  lines.push('  },', '}', '', `export default data as AsepriteSpriteData<${type}>`, '')
  return lines.join('\n')
}
