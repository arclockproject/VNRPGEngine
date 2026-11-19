import { describe, expect, it, vi } from 'vitest'
import { readAseprite } from './read.ts'
import { buildSprite, packSprite, renderSpriteModule, tagSequence } from './sprite.ts'
import { writeAseprite } from './write.ts'

const W = 8
const H = 8
function dot(x: number, y: number, color = [255, 0, 0]) {
  const px = new Uint8Array(W * H * 4)
  px.set([...color, 255], (y * W + x) * 4)
  return px
}

describe('reading frames and tags', () => {
  it('reads every frame, durations, tags and linked cels', () => {
    const buf = writeAseprite(
      W,
      H,
      [
        { name: 'Shadow', frames: [dot(0, 7), 0, 0] },
        { name: 'Body', frames: [dot(2, 2), dot(3, 2), null] },
      ],
      [],
      {
        durations: [100, 200, 300],
        tags: [
          { name: 'Walk Left', from: 0, to: 1, direction: 'pingpong' },
          { name: 'wave', from: 2, to: 2, repeat: 2 },
        ],
      },
    )
    const file = readAseprite(buf)
    expect(file.frames.map((f) => f.duration)).toEqual([100, 200, 300])
    expect(file.tags).toEqual([
      { name: 'Walk Left', from: 0, to: 1, direction: 'pingpong', repeat: 0 },
      { name: 'wave', from: 2, to: 2, direction: 'forward', repeat: 2 },
    ])
    // Linked cels share the cel of the frame they link to.
    expect(file.frames[2]?.cels.get(0)).toBe(file.frames[0]?.cels.get(0))
    expect(file.frames[1]?.cels.get(1)).toMatchObject({ x: 3, y: 2 })
    expect(file.frames[2]?.cels.has(1)).toBe(false)
    expect(file.cels).toBe(file.frames[0]?.cels)
    expect(file.warnings).toEqual([])
  })
})

describe('tagSequence', () => {
  it('follows the tag direction', () => {
    expect(tagSequence(2, 5, 'forward')).toEqual([2, 3, 4, 5])
    expect(tagSequence(2, 5, 'reverse')).toEqual([5, 4, 3, 2])
    expect(tagSequence(0, 3, 'pingpong')).toEqual([0, 1, 2, 3, 2, 1])
    expect(tagSequence(0, 3, 'pingpong_reverse')).toEqual([3, 2, 1, 0, 1, 2])
    expect(tagSequence(4, 4, 'pingpong')).toEqual([4])
  })
})

describe('buildSprite', () => {
  const file = readAseprite(
    writeAseprite(
      W,
      H,
      [
        { name: 'Body', frames: [dot(2, 2), dot(4, 5), 0] },
        { name: '_guide', frames: [dot(7, 0), null, null] },
        { name: '#marker', frames: [dot(0, 0), null, null] },
      ],
      [],
      {
        durations: [100, 150, 200],
        tags: [
          { name: 'idle-down', from: 0, to: 2 },
          { name: 'bad name!', from: 0, to: 0 },
          { name: 'Idle Down', from: 1, to: 1 },
        ],
      },
    ),
  )

  it('crops all frames to one box, stores repeated frames once, makes tags animations', () => {
    const warn = vi.fn()
    const sheet = buildSprite(file, warn)
    // "_" and "#" layers are never drawn: only the Body dots count.
    expect(sheet.box).toEqual({ x: 2, y: 2, w: 3, h: 4 })
    expect(sheet.cells).toHaveLength(2) // frame 3 is a link to frame 1
    expect(sheet.animations).toEqual({
      idle_down: { frames: [0, 1, 0], durations: [100, 150, 200], repeat: 0 },
    })
    expect(warn).toHaveBeenCalledTimes(2) // bad name + duplicate
  })

  it('makes one "idle" animation when there are no tags', () => {
    const plain = readAseprite(
      writeAseprite(W, H, [{ name: 'A', frames: [dot(1, 1), dot(2, 2)] }], [], {
        durations: [80, 90],
      }),
    )
    expect(buildSprite(plain, vi.fn()).animations).toEqual({
      idle: { frames: [0, 1], durations: [80, 90], repeat: 0 },
    })
  })

  it('packs cells and writes a typed module', () => {
    const sheet = buildSprite(file, vi.fn())
    const packed = packSprite(sheet)
    expect(packed.places).toEqual([
      { x: 2, y: 2 },
      { x: 7, y: 2 },
    ])
    const module = renderSpriteModule('x.aseprite', 'x.gen.png', sheet, packed)
    expect(module).toContain("import sheet from './x.gen.png'")
    expect(module).toContain("export default data as AsepriteSpriteData<'idle_down'>")
  })

  it('refuses a sprite with nothing drawn', () => {
    const empty = readAseprite(writeAseprite(W, H, [{ name: 'A', frames: [null] }]))
    expect(() => buildSprite(empty, vi.fn())).toThrow('every frame is empty')
  })
})

describe('slices: origin and collision', () => {
  const make = (slices: Parameters<typeof writeAseprite>[4] extends infer O ? O : never) =>
    readAseprite(writeAseprite(W, H, [{ name: 'A', pixels: dot(3, 3) }], [], slices))

  it('reads slices with keys and pivots', () => {
    const file = make({
      slices: [
        { name: 'origin', keys: [{ frame: 0, x: 2, y: 6, w: 4, h: 2, pivot: { x: 2, y: 2 } }] },
        { name: 'collision', keys: [{ frame: 0, x: 1, y: 5, w: 6, h: 3 }] },
      ],
    })
    expect(file.slices).toEqual([
      { name: 'origin', keys: [{ frame: 0, x: 2, y: 6, w: 4, h: 2, pivot: { x: 2, y: 2 } }] },
      { name: 'collision', keys: [{ frame: 0, x: 1, y: 5, w: 6, h: 3 }] },
    ])
  })

  it('uses the origin pivot, else the slice bottom centre, else the canvas bottom centre', () => {
    const pivot = make({
      slices: [
        { name: 'Origin', keys: [{ frame: 0, x: 2, y: 2, w: 4, h: 4, pivot: { x: 1, y: 3 } }] },
      ],
    })
    expect(buildSprite(pivot, vi.fn()).origin).toEqual({ x: 3, y: 5 })
    const rect = make({
      slices: [{ name: 'origin', keys: [{ frame: 0, x: 2, y: 2, w: 4, h: 4 }] }],
    })
    expect(buildSprite(rect, vi.fn()).origin).toEqual({ x: 4, y: 6 })
    expect(buildSprite(make({}), vi.fn())).toMatchObject({ origin: { x: 4, y: 8 }, collision: [] })
  })

  it('reads interact and trigger slices', () => {
    const file = make({
      slices: [
        { name: 'interact', keys: [{ frame: 0, x: 0, y: 4, w: 8, h: 4 }] },
        { name: 'trigger_plate', keys: [{ frame: 0, x: 2, y: 6, w: 4, h: 2 }] },
      ],
    })
    expect(buildSprite(file, vi.fn())).toMatchObject({
      interact: [{ x: -4, y: -4, w: 8, h: 4 }],
      triggers: [{ x: -2, y: -2, w: 4, h: 2 }],
    })
  })

  it('makes every collision slice a box relative to the origin; warns about the rest', () => {
    const warn = vi.fn()
    const file = make({
      slices: [
        { name: 'collision', keys: [{ frame: 0, x: 2, y: 6, w: 4, h: 2 }] },
        { name: 'collision_left', keys: [{ frame: 0, x: 0, y: 7, w: 2, h: 1 }] },
        { name: 'hat', keys: [{ frame: 0, x: 0, y: 0, w: 1, h: 1 }] },
        {
          name: 'collision_moving',
          keys: [
            { frame: 0, x: 0, y: 0, w: 1, h: 1 },
            { frame: 1, x: 1, y: 0, w: 1, h: 1 },
          ],
        },
      ],
    })
    expect(buildSprite(file, warn).collision).toEqual([
      { x: -2, y: -2, w: 4, h: 2 },
      { x: -4, y: -1, w: 2, h: 1 },
      { x: -4, y: -8, w: 1, h: 1 },
    ])
    expect(warn.mock.calls.map((c) => c[0])).toEqual([
      'slice "hat" ignored (sprites use "origin", "collision…", "interact…" and "trigger…" slices)',
      'slice "collision_moving" changes between frames; only frame 1 is used for now',
    ])
  })
})
