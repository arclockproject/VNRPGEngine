// Language layers ("<name>.<lang>") in portraits, CGs and sprites.
import { describe, expect, it } from 'vitest'
import { buildCg, cgLanguage } from './cg.ts'
import { languageViews } from './lang.ts'
import { addLanguageSlots, buildSlots, pack, renderModule, slotBitmaps } from './portrait.ts'
import { readAseprite } from './read.ts'
import { buildSprite } from './sprite.ts'
import { type WriteLayer, writeAseprite } from './write.ts'

const W = 8
const H = 8
const LANGS = ['ja', 'pl']
function dot(x: number, y: number, color = [255, 0, 0]) {
  const px = new Uint8Array(W * H * 4)
  px.set([...color, 255], (y * W + x) * 4)
  return px
}
const read = (layers: WriteLayer[]) => readAseprite(writeAseprite(W, H, layers))

describe('language layers', () => {
  it('"<name>.<lang>" takes its sibling\'s place in that language only, even when hidden', () => {
    const warnings: string[] = []
    const views = languageViews(
      read([
        { name: 'Body', pixels: dot(0, 0) },
        { name: 'Body.ja', pixels: dot(1, 1), visible: false },
        { name: 'Sign.pl', pixels: dot(2, 2) }, // nothing to stand in for
      ]),
      LANGS,
      (m) => warnings.push(m),
    )
    expect(views.langs).toEqual(['ja'])
    expect(views.view(null).roots.map((l) => l.name)).toEqual(['Body'])
    const ja = views.view('ja').roots
    expect(ja.map((l) => [l.name, l.visible])).toEqual([['Body', true]])
    expect(warnings).toEqual([expect.stringContaining('"Sign.pl": no layer "Sign"')])
  })

  it('portraits: only the options whose picture changes get a language image', () => {
    const file = read([
      { name: 'Head', pixels: dot(0, 7) },
      {
        name: '@Eyes',
        children: [
          { name: 'open', pixels: dot(2, 2) },
          { name: 'open.ja', pixels: dot(3, 3, [0, 0, 255]) },
          { name: 'closed', pixels: dot(5, 2) },
        ],
      },
    ])
    const views = languageViews(file, LANGS, () => {})
    const slots = buildSlots(views.view(null), () => {})
    for (const lang of views.langs)
      addLanguageSlots(
        slots,
        lang,
        buildSlots(views.view(lang), () => {}),
        () => {},
      )
    const eyes = slots[1]
    expect(
      eyes?.kind === 'part' && eyes.options.map((o) => [o.name, Object.keys(o.langs ?? {})]),
    ).toEqual([
      ['open', ['ja']],
      ['closed', []],
    ])
    // Packed into the same sheet, and written into the module next to the option.
    const module = renderModule('x.aseprite', 'x.gen.png', file, slots, pack(slotBitmaps(slots)))
    expect(module).toMatch(
      /open: \{ x: \d+, y: \d+, w: 1, h: 1, at: \{ x: 2, y: 2 \}, langs: \{ ja: \{ .*at: \{ x: 3, y: 3 \} \} \} \}/,
    )
    expect(module).toMatch(/closed: \{ x: \d+, y: \d+, w: 1, h: 1, at: \{ x: 5, y: 2 \} \},/)
  })

  it('CGs: a language gets its own flattened picture and only the parts that change', () => {
    const views = languageViews(
      read([
        { name: 'Sky', pixels: dot(0, 0) },
        { name: 'Sky.ja', pixels: dot(0, 1) },
        { name: '+tears', pixels: dot(4, 4) },
      ]),
      LANGS,
      () => {},
    )
    const build = buildCg(views.view(null), () => {})
    const ja = cgLanguage(
      'pond',
      build,
      'ja',
      buildCg(views.view('ja'), () => {}),
      () => {},
    )
    expect(ja?.flat).toBe('pond.ja.gen.png')
    // Part 0 is the flattened picture itself (one run); the toggle didn't change.
    expect(ja?.files).toEqual([null, null])
  })

  it('sprites: the same layout in every language, a sheet only for languages that differ', () => {
    const views = languageViews(
      read([
        { name: 'Body', pixels: dot(1, 1) },
        { name: 'Shirt', pixels: dot(2, 2) },
        { name: 'Shirt.ja', pixels: dot(3, 3) },
      ]),
      LANGS,
      () => {},
    )
    const sheet = buildSprite(
      views.view(null),
      () => {},
      views.langs.map((lang) => ({ lang, file: views.view(lang) })),
    )
    // One box around every language's pixels, so the frames line up.
    expect(sheet.box).toEqual({ x: 1, y: 1, w: 3, h: 3 })
    expect(Object.keys(sheet.langCells)).toEqual(['ja'])
    expect(sheet.langCells.ja?.length).toBe(sheet.cells.length)
  })
})
