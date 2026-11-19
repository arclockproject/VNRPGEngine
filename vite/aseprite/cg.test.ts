import { describe, expect, it } from 'vitest'
import { buildCg, cgFileNames, isCgSource, renderCgModule } from './cg.ts'
import { readAseprite } from './read.ts'
import { type WriteLayer, writeAseprite } from './write.ts'

const W = 8
const H = 8
function dot(x: number, y: number) {
  const px = new Uint8Array(W * H * 4)
  px.set([255, 0, 0, 255], (y * W + x) * 4)
  return px
}
const alphaAt = (pixels: Uint8Array, x: number, y: number) => pixels[(y * W + x) * 4 + 3]

describe('isCgSource', () => {
  it('is any Aseprite file under src/content/gallery', () => {
    expect(isCgSource('/p/src/content/gallery/pond/pond.aseprite')).toBe(true)
    expect(isCgSource('/p/src/content/backgrounds/town/street/street.aseprite')).toBe(true)
    expect(isCgSource('/p/src/content/characters/jack/portraits/jack.aseprite')).toBe(false)
  })
})

describe('buildCg', () => {
  const layers: WriteLayer[] = [
    { name: 'Sky', pixels: dot(0, 0) },
    { name: '+full moon', pixels: dot(1, 0), visible: false }, // hidden in Aseprite: still a toggle
    { name: 'Hair', pixels: dot(2, 0) },
    { name: '+Crying', children: [{ name: 'tears', pixels: dot(3, 0) }] },
    { name: '_sketch', pixels: dot(4, 0) },
  ]

  it('splits always-drawn runs and toggles in draw order, flattens the base', () => {
    const warnings: string[] = []
    const build = buildCg(readAseprite(writeAseprite(W, H, layers)), (m) => warnings.push(m))
    expect(warnings).toEqual([])
    expect(build.parts.map((p) => p.toggle)).toEqual([null, 'full_moon', null, 'crying'])
    // Flat: Sky + Hair, no toggles, no _sketch.
    expect([0, 1, 2, 3, 4].map((x) => alphaAt(build.flat, x, 0))).toEqual([255, 0, 255, 0, 0])
    // Parts are trimmed to their pixels, with their place on the canvas.
    const moon = build.parts[1]?.image
    expect([moon?.x, moon?.y, moon?.width, moon?.height]).toEqual([1, 0, 1, 1])
  })

  it('names the files; a single base run reuses the flattened picture', () => {
    const interleaved = buildCg(readAseprite(writeAseprite(W, H, layers)), () => {})
    expect(cgFileNames('pond', interleaved)).toEqual([
      'pond.base1.part.gen.png',
      'pond.full_moon.part.gen.png',
      'pond.base2.part.gen.png',
      'pond.crying.part.gen.png',
    ])
    const simple = buildCg(
      readAseprite(
        writeAseprite(W, H, [
          { name: 'Base', pixels: dot(0, 0) },
          { name: '+rain', pixels: dot(1, 1) },
        ]),
      ),
      () => {},
    )
    const files = cgFileNames('pond', simple)
    expect(files).toEqual([null, 'pond.rain.part.gen.png'])
    const module = renderCgModule('pond.aseprite', 'pond.gen.png', simple, files)
    expect(module).toContain("const cg: LayeredCg<'rain'> = {")
    expect(module).toContain('{ toggle: null, src: image, x: 0, y: 0, w: 8, h: 8 },')
    expect(module).toContain("{ toggle: 'rain', src: part1, x: 1, y: 1, w: 1, h: 1 },")
  })

  it('warns about bad or repeated toggle names and portrait @parts', () => {
    const warnings: string[] = []
    buildCg(
      readAseprite(
        writeAseprite(W, H, [
          { name: '+9lives', pixels: dot(0, 0) },
          { name: '+rain', pixels: dot(1, 0) },
          { name: '+Rain', pixels: dot(2, 0) },
          { name: '@eyes', children: [{ name: 'open', pixels: dot(3, 0) }] },
        ]),
      ),
      (m) => warnings.push(m),
    )
    expect(warnings).toHaveLength(3)
  })
})
