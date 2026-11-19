import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { languageViews, variantLayers } from './aseprite/lang.ts'
import { type AseFile, readAseprite } from './aseprite/read.ts'
import { writeAseprite } from './aseprite/write.ts'
import { findLangFiles, findVoiceLangFiles } from './langFiles.ts'
import { scanAudio, scanBackgrounds, scanContent, scanTitleAssets } from './registry.ts'
import {
  activeVariants,
  isVariantName,
  onlyValue,
  readVariants,
  variantFile,
  versionPath,
} from './variants.ts'

/** A project with a variants config and the given files (path -> text). */
function project(files: Record<string, string>) {
  const root = mkdtempSync(path.join(tmpdir(), 'variants-'))
  const all = {
    'src/content/config/variants.ts': `export default defineVariants({
  rating: { values: ['allages', 'adult'], default: 'allages' },
  region: { values: ['global', 'cn'], default: 'global' },
})`,
    ...files,
  }
  for (const [file, text] of Object.entries(all)) {
    const full = path.join(root, file)
    mkdirSync(path.dirname(full), { recursive: true })
    writeFileSync(full, text)
  }
  return root
}

describe('content variants (build)', () => {
  it('reads the groups and picks defaults, or GAME_VARIANTS', () => {
    const root = project({})
    expect(readVariants(root).groups).toEqual({
      rating: ['allages', 'adult'],
      region: ['global', 'cn'],
    })
    expect(activeVariants(root, undefined)).toEqual({ rating: 'allages', region: 'global' })
    expect(activeVariants(root, 'region=cn, rating=adult')).toEqual({
      rating: 'adult',
      region: 'cn',
    })
    expect(() => activeVariants(root, 'rating=r18')).toThrow(/no value "r18"/)
    expect(() => activeVariants(root, 'age=adult')).toThrow(/no group "age"/)
  })

  it('names and versions', () => {
    const values = ['adult', 'cn']
    expect(isVariantName('logo.cn.png', values)).toBe(true)
    expect(isVariantName('park.adult', values)).toBe(true)
    expect(isVariantName('logo.ja.png', values)).toBe(false)
    expect(isVariantName('cn.png', values)).toBe(false)
    expect(versionPath('/a/logo.png', 'cn')).toBe('/a/logo.cn.png')
    expect(versionPath('/a/park.gen.ts', 'adult')).toBe('/a/park.adult.gen.ts')
    expect(onlyValue("export default defineGallery({\n  only: 'adult',\n  title: 'x',\n})")).toBe(
      'adult',
    )
    expect(onlyValue("const x = { inner: { only: 'adult' } }")).toBeNull()
  })

  it('an active value swaps in its file or folder; others are left alone', () => {
    const root = project({
      'src/content/backgrounds/park.png': '',
      'src/content/backgrounds/park.cn.png': '',
      'src/content/events/day/index.ts': '',
      'src/content/events/day.adult/index.ts': '',
    })
    const c = (p: string) => path.join(root, 'src/content', p)
    expect(variantFile(c('backgrounds/park.png'), ['cn'])).toBe(c('backgrounds/park.cn.png'))
    expect(variantFile(c('backgrounds/park.png'), ['adult'])).toBe(c('backgrounds/park.png'))
    expect(variantFile(c('events/day/index.ts'), ['adult'])).toBe(c('events/day.adult/index.ts'))
  })

  it('files and folders named for a value are never content of their own', () => {
    const root = project({
      'src/content/events/park.vn': '',
      'src/content/events/park.adult.vn': '',
      'src/content/events/day/index.ts': '',
      'src/content/events/day.adult/index.ts': '',
      'src/content/audio/sfx/smoke.ogg': '',
      'src/content/audio/sfx/smoke.cn.ogg': '',
      'src/content/backgrounds/park.png': '',
      'src/content/backgrounds/park.cn.png': '',
    })
    const warnings: string[] = []
    const warn = (m: string) => warnings.push(m)
    expect(scanContent(root, warn).events).toEqual(['day', 'park'])
    expect(scanAudio(root, warn, [], []).map((a) => a.id)).toEqual(['sfx/smoke'])
    expect(scanBackgrounds(root, warn, []).map((b) => b.id)).toEqual(['park'])
    expect(warnings).toEqual([])
  })
})

describe('content variants with languages (every file type)', () => {
  /** A project with ja / pl language folders too. */
  const withLangs = (files: Record<string, string>) => {
    const root = project(files)
    for (const lang of ['ja', 'pl'])
      mkdirSync(path.join(root, 'src/content/lang', lang), { recursive: true })
    return root
  }

  it('the order is F.v.L, else F.v (a variant beats a language), else F.L, else F', () => {
    const root = withLangs({
      'src/content/a/sign.png': '',
      'src/content/a/sign.ja.png': '',
      'src/content/a/sign.cn.png': '',
      'src/content/a/sign.cn.pl.png': '',
      'src/content/a/hello.ogg': '',
      'src/content/a/hello.ja.ogg': '',
    })
    const c = (p: string) => path.join(root, 'src/content/a', p)
    const langs = ['ja', 'pl']
    // The "cn" build.
    expect(variantFile(c('sign.png'), ['cn'], langs)).toBe(c('sign.cn.png'))
    expect(variantFile(c('sign.pl.png'), ['cn'], langs)).toBe(c('sign.cn.pl.png'))
    expect(variantFile(c('sign.ja.png'), ['cn'], langs)).toBe(c('sign.cn.png')) // no cn+ja: cn
    expect(variantFile(c('hello.ja.ogg'), ['cn'], langs)).toBe(c('hello.ja.ogg')) // no cn version
    // The "global" build: the plain files.
    expect(variantFile(c('sign.ja.png'), ['global'], langs)).toBe(c('sign.ja.png'))
  })

  it('pictures and videos per language: the map follows the build', () => {
    const root = withLangs({
      'src/content/a/sign.png': '',
      'src/content/a/sign.ja.png': '',
      'src/content/a/sign.pl.png': '',
      'src/content/a/sign.cn.png': '',
      'src/content/a/sign.cn.pl.png': '',
      'src/content/a/sign.adult.ja.png': '',
    })
    const content = path.join(root, 'src/content')
    const all = ['allages', 'adult', 'global', 'cn']
    const rel = (list: { lang: string; base: string; file: string }[]) =>
      list.map((f) => `${f.lang}: ${path.basename(f.base)} -> ${path.basename(f.file)}`).sort()
    // Global, all-ages: plain language files only; no other version is imported (shipped).
    expect(
      rel(findLangFiles(content, ['ja', 'pl'], () => {}, { all, active: ['allages', 'global'] })),
    ).toEqual(['ja: sign.png -> sign.ja.png', 'pl: sign.png -> sign.pl.png'])
    // cn: Polish has its own cn picture; Japanese has none, so it keeps the cn one (no entry).
    expect(
      rel(findLangFiles(content, ['ja', 'pl'], () => {}, { all, active: ['allages', 'cn'] })),
    ).toEqual(['pl: sign.png -> sign.cn.pl.png'])
    // adult + global: the adult Japanese file (no plain adult file needed: the plain one keys it).
    expect(
      rel(findLangFiles(content, ['ja', 'pl'], () => {}, { all, active: ['adult', 'global'] })),
    ).toEqual(['ja: sign.png -> sign.adult.ja.png', 'pl: sign.png -> sign.pl.png'])
  })

  it('sounds: a variant language file without the plain language file is reported', () => {
    const root = withLangs({
      'src/content/audio/sfx/smoke.ogg': '',
      'src/content/audio/sfx/smoke.cn.ogg': '',
      'src/content/audio/sfx/smoke.cn.ja.ogg': '',
    })
    const warnings: string[] = []
    const ids = scanAudio(root, (m) => warnings.push(m), ['ja', 'pl'], []).map((a) => a.id)
    expect(ids).toEqual(['sfx/smoke'])
    expect(warnings).toEqual([expect.stringContaining('add smoke.ja.ogg next to it')])
  })

  it('title screen folders and movies in voice-language folders list no versions', () => {
    const root = withLangs({
      'src/content/titles/main/art.png': '',
      'src/content/titles/main/art.cn.png': '',
      'src/content/movies/op/en/op.webm': '',
      'src/content/movies/op/en/op.adult.webm': '',
    })
    expect(scanTitleAssets(root, ['main'])).toEqual({ main: ['art.png'] })
    const movies = findVoiceLangFiles(
      path.join(root, 'src/content/movies'),
      ['en'],
      ['adult', 'cn'],
    )
    expect(movies.map((m) => path.basename(m.en as string))).toEqual(['op.webm'])
  })
})

describe('Aseprite layers per content variant and language', () => {
  const names = (file: AseFile) => file.roots.map((l) => l.name)
  const px = new Uint8Array(4 * 4 * 4)
  const file = readAseprite(
    writeAseprite(4, 4, [
      { name: 'Sign', pixels: px },
      { name: 'Sign.cn', pixels: px },
      { name: 'Sign.ja', pixels: px },
      { name: 'Sign.cn.ja', pixels: px },
      { name: 'Smoke.adult', pixels: px },
      { name: 'Smoke', pixels: px },
    ]),
  )
  const root = project({})
  for (const lang of ['ja', 'pl'])
    mkdirSync(path.join(root, 'src/content/lang', lang), { recursive: true })

  it('the build keeps only its own values; "<name>.<value>.<lang>" becomes "<name>.<lang>"', () => {
    const quiet = () => {}
    process.env.GAME_VARIANTS = 'region=cn'
    try {
      const cn = variantLayers(file, root, quiet)
      // Sign.cn took Sign's place, Sign.cn.ja took Sign.ja's; Smoke.adult left out.
      expect(names(cn)).toEqual(['Sign', 'Sign.ja', 'Smoke'])
      const views = languageViews(cn, ['ja', 'pl'], quiet)
      expect(views.langs).toEqual(['ja'])
    } finally {
      delete process.env.GAME_VARIANTS
    }
    const plain = variantLayers(file, root, quiet)
    expect(names(plain)).toEqual(['Sign', 'Sign.ja', 'Smoke'])
  })
})

describe('Aseprite: a variant layer beats a plain language layer', () => {
  it('Open + Open.cn + Open.ja (no Open.cn.ja): Japanese players of the cn build see Open.cn', () => {
    const px = new Uint8Array(4 * 4 * 4)
    const file = readAseprite(
      writeAseprite(4, 4, [
        { name: 'Open', pixels: px },
        { name: 'Open.cn', pixels: px },
        { name: 'Open.ja', pixels: px },
      ]),
    )
    const root = project({})
    for (const lang of ['ja', 'pl'])
      mkdirSync(path.join(root, 'src/content/lang', lang), { recursive: true })
    process.env.GAME_VARIANTS = 'region=cn'
    try {
      expect(variantLayers(file, root, () => {}).roots.map((l) => l.name)).toEqual(['Open'])
    } finally {
      delete process.env.GAME_VARIANTS
    }
    // Every other build: Open and its Japanese layer as before.
    expect(variantLayers(file, root, () => {}).roots.map((l) => l.name)).toEqual([
      'Open',
      'Open.ja',
    ])
  })
})
