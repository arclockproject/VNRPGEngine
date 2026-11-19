// Writes simple .aseprite files (RGBA, layers + groups, frames + tags). Used by tests and art scripts.
// Format reference: https://github.com/aseprite/aseprite/blob/main/docs/ase-file-specs.md
import { deflateSync } from 'node:zlib'

export interface WriteLayer {
  name: string
  /** Groups have children instead of pixels. */
  children?: WriteLayer[]
  /** Full-canvas RGBA (width * height * 4) for frame 1. Empty areas are trimmed automatically. */
  pixels?: Uint8Array
  /** Per frame instead of `pixels`: full-canvas RGBA, a frame index (linked cel) or null (empty). */
  frames?: (Uint8Array | number | null)[]
  visible?: boolean
  opacity?: number
}

class Writer {
  parts: Buffer[] = []
  u8(v: number) {
    this.parts.push(Buffer.from([v & 255]))
  }
  u16(v: number) {
    const b = Buffer.alloc(2)
    b.writeUInt16LE(v)
    this.parts.push(b)
  }
  i16(v: number) {
    const b = Buffer.alloc(2)
    b.writeInt16LE(v)
    this.parts.push(b)
  }
  u32(v: number) {
    const b = Buffer.alloc(4)
    b.writeUInt32LE(v)
    this.parts.push(b)
  }
  i32(v: number) {
    const b = Buffer.alloc(4)
    b.writeInt32LE(v)
    this.parts.push(b)
  }
  string(text: string) {
    const bytes = Buffer.from(text, 'utf8')
    this.u16(bytes.length)
    this.parts.push(bytes)
  }
  zeros(n: number) {
    this.parts.push(Buffer.alloc(n))
  }
  bytes(b: Uint8Array) {
    this.parts.push(Buffer.from(b))
  }
  done() {
    return Buffer.concat(this.parts)
  }
}

function chunk(type: number, body: Buffer) {
  const w = new Writer()
  w.u32(body.length + 6)
  w.u16(type)
  w.bytes(body)
  return w.done()
}

/** Bounding box of non-transparent pixels, or null. */
function bounds(pixels: Uint8Array, width: number, height: number) {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((pixels[(y * width + x) * 4 + 3] ?? 0) === 0) continue
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

export interface WriteTag {
  name: string
  from: number
  to: number
  direction?: 'forward' | 'reverse' | 'pingpong' | 'pingpong_reverse'
  repeat?: number
}

export interface WriteSlice {
  name: string
  keys: {
    frame: number
    x: number
    y: number
    w: number
    h: number
    pivot?: { x: number; y: number }
  }[]
}

export interface WriteOptions {
  /** One duration (ms) per frame. Default: one frame of 100ms. */
  durations?: number[]
  tags?: WriteTag[]
  slices?: WriteSlice[]
}

const DIRECTIONS = ['forward', 'reverse', 'pingpong', 'pingpong_reverse']

/** One cel chunk: pixels (trimmed + compressed) or a link to an earlier frame. */
function celChunk(index: number, cel: Uint8Array | number, width: number, height: number) {
  const w = new Writer()
  w.u16(index)
  if (typeof cel === 'number') {
    w.i16(0)
    w.i16(0)
    w.u8(255)
    w.u16(1) // linked cel
    w.i16(0)
    w.zeros(5)
    w.u16(cel)
    return chunk(0x2005, w.done())
  }
  const box = bounds(cel, width, height)
  if (!box) return null
  const cropped = new Uint8Array(box.w * box.h * 4)
  for (let y = 0; y < box.h; y++) {
    const from = ((box.y + y) * width + box.x) * 4
    cropped.set(cel.subarray(from, from + box.w * 4), y * box.w * 4)
  }
  w.i16(box.x)
  w.i16(box.y)
  w.u8(255)
  w.u16(2) // compressed image
  w.i16(0) // z-index
  w.zeros(5)
  w.u16(box.w)
  w.u16(box.h)
  w.bytes(deflateSync(cropped))
  return chunk(0x2005, w.done())
}

export function writeAseprite(
  width: number,
  height: number,
  roots: WriteLayer[],
  palette: [number, number, number][] = [],
  options: WriteOptions = {},
): Buffer {
  // Flatten: each group comes before its children; bottom-most first.
  const flat: { layer: WriteLayer; level: number }[] = []
  const walk = (layers: WriteLayer[], level: number) => {
    for (const layer of layers) {
      flat.push({ layer, level })
      if (layer.children) walk(layer.children, level + 1)
    }
  }
  walk(roots, 0)
  const durations = options.durations ?? [100]

  const header: Buffer[] = []
  if (palette.length > 0) {
    const w = new Writer()
    w.u32(palette.length)
    w.u32(0)
    w.u32(palette.length - 1)
    w.zeros(8)
    for (const [r, g, b] of palette) {
      w.u16(0)
      w.u8(r)
      w.u8(g)
      w.u8(b)
      w.u8(255)
    }
    header.push(chunk(0x2019, w.done()))
  }
  for (const { layer, level } of flat) {
    const w = new Writer()
    const visible = layer.visible ?? true
    w.u16((visible ? 1 : 0) | 2) // visible + editable
    w.u16(layer.children ? 1 : 0)
    w.u16(level)
    w.u16(0)
    w.u16(0)
    w.u16(0) // normal blend
    w.u8(layer.opacity ?? 255)
    w.zeros(3)
    w.string(layer.name)
    header.push(chunk(0x2004, w.done()))
  }
  if (options.tags?.length) {
    const w = new Writer()
    w.u16(options.tags.length)
    w.zeros(8)
    for (const tag of options.tags) {
      w.u16(tag.from)
      w.u16(tag.to)
      w.u8(Math.max(0, DIRECTIONS.indexOf(tag.direction ?? 'forward')))
      w.u16(tag.repeat ?? 0)
      w.zeros(6)
      w.zeros(3) // colour
      w.u8(0)
      w.string(tag.name)
    }
    header.push(chunk(0x2018, w.done()))
  }

  for (const slice of options.slices ?? []) {
    const w = new Writer()
    const hasPivot = slice.keys.some((k) => k.pivot)
    w.u32(slice.keys.length)
    w.u32(hasPivot ? 2 : 0)
    w.u32(0)
    w.string(slice.name)
    for (const key of slice.keys) {
      w.u32(key.frame)
      w.i32(key.x)
      w.i32(key.y)
      w.u32(key.w)
      w.u32(key.h)
      if (hasPivot) {
        w.i32(key.pivot?.x ?? 0)
        w.i32(key.pivot?.y ?? 0)
      }
    }
    header.push(chunk(0x2022, w.done()))
  }

  const frames = durations.map((duration, f) => {
    const chunks = f === 0 ? [...header] : []
    flat.forEach(({ layer }, index) => {
      const cel = layer.frames ? layer.frames[f] : f === 0 ? layer.pixels : undefined
      if (cel === undefined || cel === null) return
      const c = celChunk(index, cel, width, height)
      if (c) chunks.push(c)
    })
    const body = Buffer.concat(chunks)
    const frame = new Writer()
    frame.u32(16 + body.length)
    frame.u16(0xf1fa)
    frame.u16(Math.min(chunks.length, 0xffff))
    frame.u16(duration)
    frame.zeros(2)
    frame.u32(chunks.length)
    return Buffer.concat([frame.done(), body])
  })
  const frameBytes = Buffer.concat(frames)

  const head = new Writer()
  head.u32(128 + frameBytes.length)
  head.u16(0xa5e0)
  head.u16(durations.length) // frames
  head.u16(width)
  head.u16(height)
  head.u16(32) // RGBA
  head.u32(1) // layer opacity is valid
  head.u16(100) // speed (deprecated)
  head.u32(0)
  head.u32(0)
  head.u8(0) // transparent index
  head.zeros(3)
  head.u16(palette.length || 256)
  head.u8(1) // pixel width
  head.u8(1) // pixel height
  head.i16(0) // grid x
  head.i16(0) // grid y
  head.u16(16) // grid width
  head.u16(16) // grid height
  head.zeros(84)
  return Buffer.concat([head.done(), frameBytes])
}
