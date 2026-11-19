import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { asepritePlugin } from './plugin.ts'
import { buildSlots, findFace, pack, renderModule, slotBitmaps, toId } from './portrait.ts'
import { readAseprite } from './read.ts'
import { type WriteLayer, writeAseprite } from './write.ts'

const W = 16
const H = 16
/** A full canvas with one coloured pixel at (x, y). */
function dot(x: number, y: number, color = [255, 0, 0]) {
  const px = new Uint8Array(W * H * 4)
  px.set([...color, 255], (y * W + x) * 4)
  return px
}

describe('readAseprite', () => {
  it('reads a real Aseprite 1.3.17 file (grayscale) like Aseprite exports it', () => {
    const file = readAseprite(
      readFileSync(path.join(import.meta.dirname, 'fixtures/real-aseprite-1.3.17.aseprite')),
    )
    expect([file.width, file.height, file.colorDepth]).toEqual([128, 128, 16])
    // Same positions/sizes as Aseprite's own JSON export of this file (spriteSourceSize).
    const cels = file.layers.map((l) => {
      const c = file.cels.get(l.index)
      return [l.name, c?.x, c?.y, c?.width, c?.height]
    })
    expect(cels).toEqual([
      ['Head', 22, 25, 88, 79],
      ['Eyes', 47, 49, 43, 13],
      ['Mouth', 12, 65, 108, 23],
    ])
  })

  it('round-trips layers, groups and pixels through the writer', () => {
    const buf = writeAseprite(W, H, [
      { name: 'Folder', children: [{ name: 'A', pixels: dot(1, 2) }] },
      { name: 'Hidden', pixels: dot(3, 3), visible: false },
    ])
    const file = readAseprite(buf)
    expect(file.layers.map((l) => [l.name, l.type, l.childLevel, l.visible])).toEqual([
      ['Folder', 1, 0, true],
      ['A', 0, 1, true],
      ['Hidden', 0, 0, false],
    ])
    expect(file.roots.map((l) => l.name)).toEqual(['Folder', 'Hidden'])
    expect(file.cels.get(1)).toMatchObject({ x: 1, y: 2, width: 1, height: 1 })
    expect([...(file.cels.get(1)?.pixels ?? [])]).toEqual([255, 0, 0, 255])
  })
})

describe('buildSlots (the @part rules)', () => {
  const layers: WriteLayer[] = [
    { name: 'Body', pixels: dot(0, 0) },
    {
      name: 'Shirt',
      children: [
        { name: 'Buttons', pixels: dot(1, 0) },
        { name: 'Base', pixels: dot(2, 0) },
      ],
    },
    {
      name: '@Outfit',
      children: [
        {
          name: 'Casual',
          children: [
            { name: 'Shirt', pixels: dot(0, 5) },
            { name: 'Jacket', pixels: dot(5, 5) },
          ],
        },
        { name: 'Half Closed', pixels: dot(1, 5) },
      ],
    },
    { name: 'Head', pixels: dot(0, 9) },
    { name: '_sketch', pixels: dot(9, 9) },
    { name: '@Eyes', children: [{ name: 'Open', pixels: dot(4, 4) }] },
  ]

  it('folders are base, @groups are parts, plain groups inside parts are multi-layer options', () => {
    const slots = buildSlots(readAseprite(writeAseprite(W, H, layers)), () => {})
    expect(
      slots.map((s) =>
        s.kind === 'static' ? 'static' : `${s.name}:${s.options.map((o) => o.name)}`,
      ),
    ).toEqual([
      'static', // Body + Shirt folder merged into one image
      'outfit:casual,half_closed',
      'static', // Head (_sketch ignored)
      'eyes:open',
    ])
    const [base, outfit] = slots
    expect(base?.kind === 'static' && [base.image.x, base.image.width]).toEqual([0, 3]) // 3 dots merged
    const casual = outfit?.kind === 'part' ? outfit.options[0]?.image : undefined
    expect([casual?.x, casual?.y, casual?.width]).toEqual([0, 5, 6]) // 2 layers drawn together
  })

  it('draws hidden layers; "#face" is read (even hidden) and never drawn', () => {
    /** A full canvas with a filled black square. */
    const square = (x: number, y: number, size: number) => {
      const pixels = new Uint8Array(W * H * 4)
      for (let row = y; row < y + size; row++)
        for (let col = x; col < x + size; col++) pixels[(row * W + col) * 4 + 3] = 255
      return pixels
    }
    const file = readAseprite(
      writeAseprite(W, H, [
        { name: 'Body', pixels: dot(2, 2) },
        { name: 'Sketch', pixels: dot(9, 9), visible: false },
        { name: '#face', pixels: square(4, 5, 6), visible: false },
      ]),
    )
    const slots = buildSlots(file, () => {})
    const base = slots[0]
    // Body and the hidden layer together; the #face square is not in the picture.
    expect(base?.kind === 'static' && [base.image.x, base.image.y, base.image.width]).toEqual([
      2, 2, 8,
    ])
    const warn = vi.fn()
    expect(findFace(file, warn)).toEqual({ x: 4, y: 5, w: 6, h: 6 })
    expect(warn).not.toHaveBeenCalled()
    expect(
      findFace(readAseprite(writeAseprite(W, H, [{ name: 'A', pixels: dot(1, 1) }])), warn),
    ).toBeNull()
  })

  it('group opacity counts only when the file says so (re-saved files write 0 there)', () => {
    // The test writer sets "layer opacity valid" but not "group opacity valid".
    const file = readAseprite(
      writeAseprite(W, H, [
        { name: '@Outfit', opacity: 0, children: [{ name: 'Coat', pixels: dot(3, 3) }] },
      ]),
    )
    expect(file.layers[0]?.opacity).toBe(255)
    expect(buildSlots(file, () => {})).toHaveLength(1)
  })

  it('warns about parts in parts, bad/duplicate names and empty options', () => {
    const warnings: string[] = []
    buildSlots(
      readAseprite(
        writeAseprite(W, H, [
          {
            name: '@A',
            children: [
              { name: '@Inner', children: [{ name: 'X', pixels: dot(0, 0) }] },
              { name: '1bad', pixels: dot(1, 1) },
            ],
          },
          {
            name: '@B',
            children: [
              { name: 'One', pixels: dot(2, 2) },
              { name: 'one', pixels: dot(3, 3) },
              { name: 'Empty' },
            ],
          },
        ]),
      ),
      (w) => warnings.push(w),
    )
    expect(warnings.join('\n')).toMatch(/can't contain parts/)
    expect(warnings.join('\n')).toMatch(/option names need/)
    expect(warnings.join('\n')).toMatch(/already an option/)
    expect(warnings.join('\n')).toMatch(/is empty/)
    expect(warnings.join('\n')).toMatch(/"@A" has no options/)
  })

  it('turns layer names into ids', () => {
    expect(toId('Eyes')).toBe('eyes')
    expect(toId(' Half Closed ')).toBe('half_closed')
    expect(toId('look-left')).toBe('look_left')
    expect(toId('2nd')).toBeNull()
  })
})

describe('pack and module', () => {
  it('packs images without overlaps and writes typed part names', () => {
    const file = readAseprite(
      writeAseprite(W, H, [
        { name: 'Base', pixels: dot(0, 0) },
        {
          name: '@Mouth',
          children: [
            { name: 'Smile', pixels: dot(5, 5) },
            { name: 'Open', pixels: dot(6, 6) },
          ],
        },
      ]),
    )
    const slots = buildSlots(file, () => {})
    const bitmaps = slotBitmaps(slots)
    const packed = pack(bitmaps)
    const boxes = bitmaps.map((b, i) => ({ ...packed.places[i], w: b.width, h: b.height }))
    for (const [i, a] of boxes.entries()) {
      for (const b of boxes.slice(i + 1)) {
        const apart =
          (a.x ?? 0) + a.w <= (b.x ?? 0) ||
          (b.x ?? 0) + b.w <= (a.x ?? 0) ||
          (a.y ?? 0) + a.h <= (b.y ?? 0) ||
          (b.y ?? 0) + b.h <= (a.y ?? 0)
        expect(apart).toBe(true)
      }
    }
    const source = renderModule('x.aseprite', 'x.gen.png', file, slots, packed)
    expect(source).toContain("import sheet from './x.gen.png'")
    expect(source).toContain("AsepritePortraitData<{ mouth: 'smile' | 'open' }>")
  })
})

describe('build guard', () => {
  it('fails the build if an .aseprite file would be shipped', () => {
    const plugin = asepritePlugin()
    const error = vi.fn()
    const hook = plugin.generateBundle as unknown as (
      this: unknown,
      o: unknown,
      bundle: Record<string, unknown>,
    ) => void
    hook.call({ error }, {}, { 'assets/index.js': {}, 'assets/jack.png': {} })
    expect(error).not.toHaveBeenCalled()
    hook.call({ error }, {}, { 'assets/jack-abc123.aseprite': {} })
    expect(error).toHaveBeenCalledWith(expect.stringContaining('jack-abc123.aseprite'))
  })
})

describe('import guard', () => {
  it('refuses any import of an .aseprite file (also ?url, ?raw, ?inline)', () => {
    const plugin = asepritePlugin()
    const error = vi.fn()
    const hook = plugin.resolveId as unknown as (
      this: unknown,
      source: string,
      importer?: string,
    ) => unknown
    hook.call({ error }, './portraits/jack.gen', '/x/index.ts')
    expect(error).not.toHaveBeenCalled()
    for (const source of [
      './jack.aseprite',
      './jack.aseprite?url',
      './jack.ase?raw',
      './Jack.ASEPRITE?inline',
    ]) {
      hook.call({ error }, source, '/x/index.ts')
    }
    expect(error).toHaveBeenCalledTimes(4)
  })
})
