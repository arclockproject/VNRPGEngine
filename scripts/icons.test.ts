// pnpm icons: which file makes each Android icon, hand-made sizes, errors, and a real run.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterEach, describe, expect, it } from 'vitest'
import {
  adaptiveIconXml,
  androidColour,
  generateIcons,
  type IconFile,
  parseIconName,
  planIcons,
} from './icons.ts'

const png = (name: string, px: number): IconFile => ({
  name,
  ...(parseIconName(name) as NonNullable<ReturnType<typeof parseIconName>>),
  width: px,
  height: px,
})
const svg = (name: string): IconFile => ({
  name,
  ...(parseIconName(name) as NonNullable<ReturnType<typeof parseIconName>>),
  width: null,
  height: null,
})
const all = [svg('icon.square.svg'), svg('icon.round.svg'), svg('icon.foreground.svg')]

describe('icon names', () => {
  it('reads kind and hand-made size; other files are not Android icons', () => {
    expect(parseIconName('icon.round.png')).toEqual({ kind: 'round', size: null })
    expect(parseIconName('icon.round.96.png')).toEqual({ kind: 'round', size: 96 })
    expect(parseIconName('icon.png')).toBeNull()
    expect(parseIconName('icon.sparkle.png')).toBeNull()
    expect(parseIconName('icon.round.gif')).toBeNull()
  })
})

describe('planIcons', () => {
  it('scales every size down from the biggest file, and uses a hand-made size as it is', () => {
    const { outputs, errors } = planIcons([
      png('icon.square.png', 512),
      png('icon.square.96.png', 96),
      ...all.slice(1),
    ])
    expect(errors).toEqual([])
    const square = outputs.filter((o) => o.path.endsWith('/ic_launcher.png'))
    expect(square.map((o) => [o.px, o.from, o.scale])).toEqual([
      [48, 'icon.square.png', true],
      [72, 'icon.square.png', true],
      [96, 'icon.square.96.png', false],
      [144, 'icon.square.png', true],
      [192, 'icon.square.png', true],
    ])
    expect(outputs.find((o) => o.path === 'mipmap-xxxhdpi/ic_launcher_foreground.png')?.px).toBe(
      432,
    )
  })

  it('names what is wrong: missing kind, too small, wrong size in the name, not square', () => {
    const { errors } = planIcons([
      png('icon.square.png', 100),
      { ...png('icon.round.png', 300), height: 200 },
      png('icon.round.48.png', 50),
    ])
    expect(errors.join('\n')).toContain('icon.round.png is 300x200: icons must be square')
    expect(errors.join('\n')).toContain('icon.round.48.png is 50x50, but its name says 48')
    expect(errors.join('\n')).toContain(
      'needs 144x144 px, but the biggest square icon (icon.square.png) is 100x100',
    )
    expect(errors.join('\n')).toContain('icon.foreground.png (or .svg / .webp) is missing')
  })

  it('background and monochrome are optional', () => {
    expect(planIcons(all).errors).toEqual([])
    expect(adaptiveIconXml(false, false)).toContain('@color/ic_launcher_background')
    expect(adaptiveIconXml(true, true)).toContain('@mipmap/ic_launcher_background')
    expect(adaptiveIconXml(true, true)).toContain('<monochrome')
  })

  it('colours become Android colours', () => {
    expect(androidColour('#0d1117', 'x')).toBe('#0D1117')
    expect(androidColour('#fff', 'x')).toBe('#FFFFFF')
    expect(androidColour('#11223380', 'x')).toBe('#80112233')
    expect(() => androidColour('black', 'splashBackground')).toThrow('splashBackground')
  })
})

describe('generateIcons', () => {
  let dir = ''
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('writes every size from real files, keeps a hand-made one, and skips when nothing changed', async () => {
    dir = mkdtempSync(join(tmpdir(), 'icons-'))
    const source = join(dir, 'icon')
    const res = join(dir, 'res')
    mkdirSync(source)
    mkdirSync(join(res, 'values'), { recursive: true })
    const solid = (px: number, colour: string) =>
      sharp({ create: { width: px, height: px, channels: 4, background: colour } }).png()
    await solid(512, '#ff0000').toFile(join(source, 'icon.square.png'))
    await solid(96, '#00ff00').toFile(join(source, 'icon.square.96.png'))
    await solid(512, '#0000ff').toFile(join(source, 'icon.round.png'))
    await solid(432, '#ffffff').toFile(join(source, 'icon.foreground.png'))
    const paths = { source, res, stamp: join(dir, 'stamp') }
    const colours = { iconBackground: '#123456', splashBackground: '#000' }

    expect(await generateIcons(paths, colours)).toBe(true)
    const size = async (file: string) => (await sharp(join(res, file)).metadata()).width
    expect(await size('mipmap-mdpi/ic_launcher.png')).toBe(48)
    expect(await size('mipmap-xxxhdpi/ic_launcher_round.png')).toBe(192)
    expect(await size('mipmap-hdpi/ic_launcher_foreground.png')).toBe(162)
    // The hand-made 96 px one (green), not the big red one scaled.
    const { data } = await sharp(join(res, 'mipmap-xhdpi/ic_launcher.png'))
      .raw()
      .toBuffer({ resolveWithObject: true })
    expect([data[0], data[1], data[2]]).toEqual([0, 255, 0])
    expect(readdirSync(join(res, 'mipmap-mdpi')).sort()).toEqual([
      'ic_launcher.png',
      'ic_launcher_foreground.png',
      'ic_launcher_round.png',
    ])
    expect(readFileSync(join(res, 'values/game_colors.xml'), 'utf8')).toContain('#123456')
    expect(existsSync(join(res, 'mipmap-anydpi-v26/ic_launcher_round.xml'))).toBe(true)

    expect(await generateIcons(paths, colours)).toBe(false)
    expect(await generateIcons(paths, { ...colours, splashBackground: '#111' })).toBe(true)
  })
})
