// Reads .aseprite / .ase files: layers, groups, pixels, every frame (with durations) and tags.
// Format reference: https://github.com/aseprite/aseprite/blob/main/docs/ase-file-specs.md
import { inflateSync } from 'node:zlib'

export interface AseLayer {
  index: number
  name: string
  /** 0 = image layer, 1 = group, 2 = tilemap (not supported). */
  type: number
  childLevel: number
  visible: boolean
  opacity: number
  blendMode: number
  parent: AseLayer | null
  children: AseLayer[]
}

export interface AseCel {
  layerIndex: number
  x: number
  y: number
  opacity: number
  width: number
  height: number
  /** RGBA, width * height * 4. */
  pixels: Uint8Array
}

export interface AseFile {
  width: number
  height: number
  colorDepth: number
  /** Layers in file order (bottom to top, each group before its children). */
  layers: AseLayer[]
  /** Top-level layers, bottom to top. */
  roots: AseLayer[]
  /** Cels of the first frame, by layer index (same as frames[0].cels). */
  cels: Map<number, AseCel>
  /** Every frame. Linked cels are resolved (they share the linked frame's cel). */
  frames: AseFrame[]
  /** Animation tags, in file order. */
  tags: AseTag[]
  /** Slices (named rectangles), in file order. */
  slices: AseSlice[]
  warnings: string[]
}

export interface AseFrame {
  /** Milliseconds. */
  duration: number
  /** By layer index. */
  cels: Map<number, AseCel>
}

export interface AseSliceKey {
  /** From this frame on (0-based), until the next key. */
  frame: number
  x: number
  y: number
  w: number
  h: number
  /** Pivot point, relative to the slice's top-left. */
  pivot?: { x: number; y: number }
}

export interface AseSlice {
  name: string
  /** Sorted by frame; the first key starts at frame 0 in practice. */
  keys: AseSliceKey[]
}

export interface AseTag {
  name: string
  /** Frame indexes, 0-based, inclusive. */
  from: number
  to: number
  direction: 'forward' | 'reverse' | 'pingpong' | 'pingpong_reverse'
  /** 0 = loop forever, N = play N times. */
  repeat: number
}

class Reader {
  offset = 0
  readonly buf: Buffer
  constructor(buf: Buffer) {
    this.buf = buf
  }
  u8() {
    return this.buf.readUInt8(this.offset++)
  }
  u16() {
    const v = this.buf.readUInt16LE(this.offset)
    this.offset += 2
    return v
  }
  i16() {
    const v = this.buf.readInt16LE(this.offset)
    this.offset += 2
    return v
  }
  u32() {
    const v = this.buf.readUInt32LE(this.offset)
    this.offset += 4
    return v
  }
  i32() {
    const v = this.buf.readInt32LE(this.offset)
    this.offset += 4
    return v
  }
  string() {
    const length = this.u16()
    const text = this.buf.toString('utf8', this.offset, this.offset + length)
    this.offset += length
    return text
  }
  bytes(length: number) {
    const slice = this.buf.subarray(this.offset, this.offset + length)
    this.offset += length
    return slice
  }
}

const HEADER_MAGIC = 0xa5e0
const FRAME_MAGIC = 0xf1fa
const CHUNK = {
  oldPalette: 0x0004,
  layer: 0x2004,
  cel: 0x2005,
  tags: 0x2018,
  slice: 0x2022,
  palette: 0x2019,
} as const

const TAG_DIRECTIONS = ['forward', 'reverse', 'pingpong', 'pingpong_reverse'] as const

interface RawCel {
  frame: number
  layerIndex: number
  x: number
  y: number
  opacity: number
  w: number
  h: number
  data: Uint8Array
}

export function readAseprite(buf: Buffer): AseFile {
  const r = new Reader(buf)
  r.u32() // file size
  if (r.u16() !== HEADER_MAGIC) throw new Error('not an Aseprite file (bad magic number)')
  const frameCount = r.u16()
  const width = r.u16()
  const height = r.u16()
  const colorDepth = r.u16()
  const flags = r.u32()
  r.offset = 28
  const transparentIndex = r.u8()
  r.offset = 128
  if (frameCount < 1) throw new Error('the file has no frames')
  if (![32, 16, 8].includes(colorDepth)) throw new Error(`unsupported color depth ${colorDepth}`)
  const layerOpacityValid = (flags & 1) === 1
  // Groups: their opacity (and blend mode) only count when this flag is set too. Without it
  // Aseprite writes 0 there (seen after re-saving a file), and the group must be drawn fully.
  const groupOpacityValid = (flags & 2) === 2

  const warnings: string[] = []
  const layers: AseLayer[] = []
  const rawCels: RawCel[] = []
  /** Linked cels: [frame, layer] shows the cel of [linkedFrame, layer]. */
  const links: { frame: number; layerIndex: number; linkedFrame: number }[] = []
  const durations: number[] = []
  const tags: AseTag[] = []
  const slices: AseSlice[] = []
  let palette: [number, number, number, number][] = []

  for (let frame = 0; frame < frameCount; frame++) {
    const frameStart = r.offset
    const frameBytes = r.u32()
    if (r.u16() !== FRAME_MAGIC) throw new Error(`bad header in frame ${frame + 1}`)
    const oldChunks = r.u16()
    durations.push(r.u16())
    r.offset += 2
    const newChunks = r.u32()
    const chunkCount = newChunks === 0 ? oldChunks : newChunks

    for (let c = 0; c < chunkCount; c++) {
      const chunkStart = r.offset
      const size = r.u32()
      const type = r.u16()
      if (type === CHUNK.layer) {
        const layerFlags = r.u16()
        const layerType = r.u16()
        const childLevel = r.u16()
        r.u16() // default width
        r.u16() // default height
        const blendMode = r.u16()
        const opacity = r.u8()
        r.offset += 3
        const name = r.string()
        layers.push({
          index: layers.length,
          name,
          type: layerType,
          childLevel,
          visible: (layerFlags & 1) === 1,
          opacity: layerOpacityValid && (layerType !== 1 || groupOpacityValid) ? opacity : 255,
          blendMode,
          parent: null,
          children: [],
        })
      } else if (type === CHUNK.cel) {
        const layerIndex = r.u16()
        const x = r.i16()
        const y = r.i16()
        const opacity = r.u8()
        const celType = r.u16()
        r.i16() // z-index
        r.offset += 5
        if (celType === 0 || celType === 2) {
          const w = r.u16()
          const h = r.u16()
          const data = r.bytes(chunkStart + size - r.offset)
          rawCels.push({
            frame,
            layerIndex,
            x,
            y,
            opacity,
            w,
            h,
            data: celType === 2 ? inflateSync(data) : data,
          })
        } else if (celType === 1) {
          links.push({ frame, layerIndex, linkedFrame: r.u16() })
        } else {
          warnings.push(`layer ${layerIndex}: tilemap cels are not supported`)
        }
      } else if (type === CHUNK.slice) {
        const keyCount = r.u32()
        const sliceFlags = r.u32()
        r.u32() // reserved
        const name = r.string()
        const keys: AseSliceKey[] = []
        for (let k = 0; k < keyCount; k++) {
          const key: AseSliceKey = {
            frame: r.u32(),
            x: r.i32(),
            y: r.i32(),
            w: r.u32(),
            h: r.u32(),
          }
          if (sliceFlags & 1) r.offset += 16 // 9-slice centre (not used)
          if (sliceFlags & 2) key.pivot = { x: r.i32(), y: r.i32() }
          keys.push(key)
        }
        keys.sort((a, b) => a.frame - b.frame)
        slices.push({ name, keys })
      } else if (type === CHUNK.tags) {
        const count = r.u16()
        r.offset += 8
        for (let t = 0; t < count; t++) {
          const from = r.u16()
          const to = r.u16()
          const direction = TAG_DIRECTIONS[r.u8()] ?? 'forward'
          const repeat = r.u16()
          r.offset += 6 + 3 + 1 // reserved, colour, extra byte
          tags.push({ name: r.string(), from, to, direction, repeat })
        }
      } else if (type === CHUNK.palette) {
        const paletteSize = r.u32()
        const from = r.u32()
        const to = r.u32()
        r.offset += 8
        if (palette.length < paletteSize)
          palette = palette.concat(new Array(paletteSize - palette.length).fill([0, 0, 0, 0]))
        for (let i = from; i <= to; i++) {
          const entryFlags = r.u16()
          palette[i] = [r.u8(), r.u8(), r.u8(), r.u8()]
          if (entryFlags & 1) r.string()
        }
      } else if (type === CHUNK.oldPalette && palette.length === 0) {
        const packets = r.u16()
        let index = 0
        for (let p = 0; p < packets; p++) {
          index += r.u8()
          const count = r.u8() || 256
          for (let i = 0; i < count; i++) palette[index++] = [r.u8(), r.u8(), r.u8(), 255]
        }
      }
      r.offset = chunkStart + size
    }
    r.offset = frameStart + frameBytes
  }

  // Build the tree from child levels: each layer's parent is the closest group above it one level up.
  const stack: AseLayer[] = []
  const roots: AseLayer[] = []
  for (const layer of layers) {
    stack.length = layer.childLevel
    const parent = stack[layer.childLevel - 1] ?? null
    layer.parent = parent
    if (parent) parent.children.push(layer)
    else roots.push(layer)
    stack[layer.childLevel] = layer
  }

  // Convert every cel to RGBA.
  const frames: AseFrame[] = durations.map((duration) => ({ duration, cels: new Map() }))
  for (const cel of rawCels) {
    const count = cel.w * cel.h
    const pixels = new Uint8Array(count * 4)
    for (let i = 0; i < count; i++) {
      if (colorDepth === 32) {
        pixels.set(cel.data.subarray(i * 4, i * 4 + 4), i * 4)
      } else if (colorDepth === 16) {
        const value = cel.data[i * 2] ?? 0
        pixels.set([value, value, value, cel.data[i * 2 + 1] ?? 0], i * 4)
      } else {
        const index = cel.data[i] ?? 0
        const color = palette[index] ?? [0, 0, 0, 0]
        pixels.set(index === transparentIndex ? [0, 0, 0, 0] : color, i * 4)
      }
    }
    frames[cel.frame]?.cels.set(cel.layerIndex, {
      layerIndex: cel.layerIndex,
      x: cel.x,
      y: cel.y,
      opacity: cel.opacity,
      width: cel.w,
      height: cel.h,
      pixels,
    })
  }
  // Linked cels always point at an earlier frame, so resolving in order also handles chains.
  for (const link of links) {
    const cel = frames[link.linkedFrame]?.cels.get(link.layerIndex)
    if (cel && link.linkedFrame < link.frame) frames[link.frame]?.cels.set(link.layerIndex, cel)
    else warnings.push(`layer ${link.layerIndex}: broken linked cel in frame ${link.frame + 1}`)
  }

  return {
    width,
    height,
    colorDepth,
    layers,
    roots,
    cels: frames[0]?.cels ?? new Map(),
    frames,
    tags,
    slices,
    warnings,
  }
}
