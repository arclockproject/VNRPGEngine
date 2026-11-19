import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  CONTENT_DIR,
  missingRequired,
  renderRegistry,
  routeKeysOf,
  scanAudio,
  scanBackgrounds,
  scanContent,
} from './registry.ts'

let root: string | undefined

function makeContent(files: string[]) {
  root = mkdtempSync(path.join(tmpdir(), 'registry-test-'))
  for (const file of files) {
    const full = path.join(root, CONTENT_DIR, file)
    mkdirSync(path.dirname(full), { recursive: true })
    writeFileSync(full, '')
  }
  return root
}

afterEach(() => {
  if (root) rmSync(root, { recursive: true, force: true })
  root = undefined
})

describe('scanContent', () => {
  it('finds folders with an index file, sorted', () => {
    const dir = makeContent([
      'maps/town/index.tsx',
      'maps/forest/index.ts',
      'windows/shop/index.tsx',
    ])
    const scan = scanContent(dir, () => {})
    expect(scan.maps).toEqual(['forest', 'town'])
    expect(scan.windows).toEqual(['shop'])
    expect(scan.events).toEqual([])
  })

  it('events can be a dialogue script (index.vn), imported from its generated file', () => {
    const dir = makeContent([
      'events/town/sign/index.vn',
      'events/both/index.vn',
      'events/both/index.ts',
      'maps/odd/index.vn', // only events may be scripts
    ])
    const warnings: string[] = []
    const scan = scanContent(dir, (w) => warnings.push(w))
    expect(scan.events).toEqual(['both', 'town/sign'])
    expect(scan.vn).toEqual(['events/town/sign'])
    expect(scan.maps).toEqual([])
    const source = renderRegistry(scan)
    expect(source).toContain(`'town/sign': () => import('@/content/events/town/sign/index.gen'),`)
    expect(source).toContain(`both: () => import('@/content/events/both'),`)
  })

  it('skips helper folders silently and warns about bad entries', () => {
    const dir = makeContent([
      'events/_shared/util.ts',
      'events/no_index/readme.ts',
      'events/Bad-Name/index.ts',
      'events/sudden_encounter_4/index.ts',
    ])
    const warnings: string[] = []
    const scan = scanContent(dir, (w) => warnings.push(w))
    expect(scan.events).toEqual(['sudden_encounter_4'])
    expect(warnings).toHaveLength(2)
  })
})

describe('group folders', () => {
  it('turns nested folders into ids with / for grouped kinds', () => {
    const dir = makeContent([
      'events/anna/flashback/index.ts',
      'events/anna/hello/index.ts',
      'events/intro/index.ts',
      'maps/countryside/town/index.ts',
      'maps/countryside/caves/deep/index.ts',
      'windows/shop/blacksmith/index.tsx',
    ])
    const scan = scanContent(dir, () => {})
    expect(scan.events).toEqual(['anna/flashback', 'anna/hello', 'intro'])
    expect(scan.maps).toEqual(['countryside/caves/deep', 'countryside/town'])
    expect(scan.windows).toEqual(['shop/blacksmith'])
  })

  it("does not look inside an entry's own folders", () => {
    const dir = makeContent(['maps/town/index.ts', 'maps/town/houses/index.ts'])
    expect(scanContent(dir, () => {}).maps).toEqual(['town'])
  })

  it('keeps minigames and characters flat', () => {
    const dir = makeContent(['minigames/cards/poker/index.tsx', 'characters/family/mum/index.ts'])
    const warnings: string[] = []
    const scan = scanContent(dir, (w) => warnings.push(w))
    expect(scan.minigames).toEqual([])
    expect(scan.characters).toEqual([])
    expect(warnings).toHaveLength(2)
  })

  it('warns about empty groups, bad names inside groups and too-deep nesting', () => {
    const dir = makeContent([
      'events/empty/notes.ts',
      'events/anna/Bad-Name/index.ts',
      'events/anna/_shared/util.ts',
      'events/anna/ok/index.ts',
      'events/a/b/c/d/e/index.ts', // 4 group levels: one too many
    ])
    const warnings: string[] = []
    const scan = scanContent(dir, (w) => warnings.push(w))
    expect(scan.events).toEqual(['anna/ok'])
    expect(warnings.some((w) => w.includes('events/empty'))).toBe(true)
    expect(warnings.some((w) => w.includes('Bad-Name'))).toBe(true)
    expect(warnings.some((w) => w.includes('at most'))).toBe(true)
  })
})

describe('renderRegistry', () => {
  it('quotes grouped ids', () => {
    const source = renderRegistry({
      maps: ['countryside/town'],
      events: ['anna/hello'],
      minigames: [],
      windows: [],
      structures: [],
      characters: [],
      items: [],
      quests: [],
      props: [],
      gallery: [],
      movies: [],
      endings: [],
      shops: [],
      achievements: [],
      codex: [],
      enemies: [],
      troops: [],
      skills: [],
      titles: [],
      routes: [],
      lang: [],
    })
    expect(source).toContain(
      "  'countryside/town': () => import('@/content/maps/countryside/town'),",
    )
    expect(source).toContain("  'anna/hello': () => import('@/content/events/anna/hello'),")
  })

  it('writes lazy loaders and eager imports', () => {
    const source = renderRegistry({
      maps: ['town'],
      events: [],
      minigames: [],
      windows: ['shop'],
      structures: [],
      characters: ['anna'],
      items: [],
      quests: [],
      props: [],
      gallery: [],
      movies: [],
      endings: [],
      shops: [],
      achievements: [],
      codex: [],
      enemies: [],
      troops: [],
      skills: [],
      titles: [],
      routes: [],
      lang: [],
    })
    expect(source).toContain("import characters_anna from '@/content/characters/anna'")
    expect(source).toContain("  town: () => import('@/content/maps/town'),")
    expect(source).toContain("  shop: () => import('@/content/windows/shop'),")
    expect(source).toContain('  anna: characters_anna,')
    expect(source).toContain('export const eventLoaders = {\n} as const')
  })
})

describe('scanBackgrounds', () => {
  it('a picture file is a background; a folder with index.ts is one with variants', () => {
    const dir = makeContent([
      'backgrounds/street.png',
      'backgrounds/street.ja.png', // its Japanese version
      'backgrounds/school/classroom.webp',
      'backgrounds/school/roof/index.ts', // variants (defineBackground)
      'backgrounds/school/roof/roof.aseprite',
      'backgrounds/school/roof/roof.gen.png', // its own files: not backgrounds
      'backgrounds/school/notes.txt',
      'backgrounds/_drafts/old.png',
      'lang/ja/index.ts',
    ])
    const warnings: string[] = []
    expect(scanBackgrounds(dir, (w) => warnings.push(w))).toEqual([
      { id: 'school/classroom', file: 'school/classroom.webp' },
      { id: 'school/roof', config: true },
      { id: 'street', file: 'street.png' },
    ])
    expect(warnings).toEqual([])
  })

  it('refuses file-name variants (they come from an .aseprite), duplicates and bad names', () => {
    const dir = makeContent([
      'backgrounds/street.png',
      'backgrounds/street.jpg',
      'backgrounds/street.evening.png',
      'backgrounds/Bad Name.png',
    ])
    const warnings: string[] = []
    expect(scanBackgrounds(dir, (w) => warnings.push(w)).map((b) => b.id)).toEqual(['street'])
    expect(warnings).toHaveLength(3)
    expect(warnings.some((w) => w.includes('defineBackground'))).toBe(true)
  })

  it('writes the table: plain pictures as { image }, folders as their index.ts', () => {
    const source = renderRegistry({
      ...scanContent(makeContent([]), () => {}),
      backgrounds: [
        { id: 'school/roof', config: true },
        { id: 'street', file: 'street.png' },
      ],
    })
    expect(source).toContain("import bg_street from '@/content/backgrounds/street.png'")
    expect(source).toContain(
      "import bg_school__roof from '@/content/backgrounds/school/roof/index'",
    )
    expect(source).toContain("'school/roof': bg_school__roof,")
    expect(source).toContain("'street': { image: bg_street },")
  })
})

describe('scanAudio', () => {
  it('turns sound files into ids without extensions', () => {
    const dir = makeContent([
      'audio/music/town.ogg',
      'audio/sfx/click.wav',
      'audio/voice/anna/hello.mp3',
      'audio/notes.txt', // not audio: ignored
      'audio/_drafts/old.wav', // helper folder: ignored
    ])
    expect(scanAudio(dir, () => {})).toEqual([
      { id: 'music/town', file: 'music/town.ogg' },
      { id: 'sfx/click', file: 'sfx/click.wav' },
      { id: 'voice/anna/hello', file: 'voice/anna/hello.mp3' },
    ])
  })

  it('music in voice-language folders: one id, a file per language (in the config order)', () => {
    const dir = makeContent([
      'audio/music/en/town.ogg',
      'audio/music/ja/town.ogg',
      'audio/music/ja/only_ja.ogg',
      'audio/music/ja/forest/night.ogg',
      'audio/music/plain.ogg',
      'audio/music/en/plain.ogg',
      'audio/sfx/ja/click.wav', // only music has voice-language folders
    ])
    expect(scanAudio(dir, () => {}, [], ['ja', 'en'])).toEqual([
      {
        id: 'music/forest/night',
        file: 'music/ja/forest/night.ogg',
        voiceLangs: [{ lang: 'ja', file: 'music/ja/forest/night.ogg' }],
      },
      {
        id: 'music/only_ja',
        file: 'music/ja/only_ja.ogg',
        voiceLangs: [{ lang: 'ja', file: 'music/ja/only_ja.ogg' }],
      },
      // A plain file stays the sound's own file (the fallback after every language).
      {
        id: 'music/plain',
        file: 'music/plain.ogg',
        voiceLangs: [{ lang: 'en', file: 'music/en/plain.ogg' }],
      },
      {
        id: 'music/town',
        file: 'music/ja/town.ogg',
        voiceLangs: [
          { lang: 'ja', file: 'music/ja/town.ogg' },
          { lang: 'en', file: 'music/en/town.ogg' },
        ],
      },
      { id: 'sfx/ja/click', file: 'sfx/ja/click.wav' },
    ])
  })

  it('warns about duplicates and bad names', () => {
    const dir = makeContent([
      'audio/sfx/click.wav',
      'audio/sfx/click.ogg',
      'audio/sfx/Bad Name.wav',
    ])
    const warnings: string[] = []
    expect(scanAudio(dir, (w) => warnings.push(w)).map((f) => f.id)).toEqual(['sfx/click'])
    expect(warnings).toHaveLength(2)
  })

  it('renders URL imports', () => {
    const source = renderRegistry({
      maps: [],
      events: [],
      minigames: [],
      windows: [],
      structures: [],
      characters: [],
      items: [],
      quests: [],
      props: [],
      gallery: [],
      movies: [],
      endings: [],
      shops: [],
      achievements: [],
      codex: [],
      enemies: [],
      troops: [],
      skills: [],
      titles: [],
      routes: [],
      lang: [],
      audio: [{ id: 'music/town', file: 'music/town.ogg' }],
    })
    expect(source).toContain("import audio_music__town from '@/content/audio/music/town.ogg'")
    expect(source).toContain("  'music/town': audio_music__town,")
  })
})

describe('routeKeysOf', () => {
  it('reads the keys of event() calls in file order, once each, skipping line comments', () => {
    const source = [
      "await event('meeting/special', 'meeting')",
      "// await event('old/thing', 'old')",
      "if (flag('x')) await event(",
      "  'jack/tells_his_story',",
      "  'tells_story',",
      ')',
      'await event("town/leaving", \'meeting\')',
    ].join('\n')
    expect(routeKeysOf(source)).toEqual(['meeting', 'tells_story'])
  })

  it('reads `event <id> as <key>` lines of a .vn route', () => {
    const source =
      "event meeting/special as meeting\nif flag('x'):\n  event town/sign as the_sign\n"
    expect(routeKeysOf(source, true)).toEqual(['meeting', 'the_sign'])
  })

  it('a box without a name is called after the last part of its event id', () => {
    expect(routeKeysOf("await event('common/day1_morning')\nawait event('a/b', 'c')")).toEqual([
      'day1_morning',
      'c',
    ])
    expect(routeKeysOf('event common/day1_morning\n  event a/b as c\n', true)).toEqual([
      'day1_morning',
      'c',
    ])
  })
})

describe('events written as one file', () => {
  it('finds <name>.vn files in events/ and its group folders', () => {
    const dir = makeContent([
      'events/intro.vn',
      'events/common/day1_morning.vn',
      'events/common/day1_lunch/index.vn',
      'events/common/day1_lunch/notes.vn', // inside an entry folder: not an event
      'events/common/_draft.vn',
      'maps/town/index.ts',
      'maps/loose.vn', // only events
    ])
    const scan = scanContent(dir, () => {})
    expect(scan.events).toEqual(['common/day1_lunch', 'common/day1_morning', 'intro'])
    expect(scan.flatVn).toEqual(['events/common/day1_morning', 'events/intro'])
    const source = renderRegistry(scan)
    expect(source).toContain(
      "'common/day1_morning': () => import('@/content/events/common/day1_morning.gen'),",
    )
    expect(source).toContain("intro: () => import('@/content/events/intro.gen'),")
    expect(source).toContain(
      "'common/day1_lunch': () => import('@/content/events/common/day1_lunch/index.gen'),",
    )
  })

  it('warns when a folder has the same name, or the name is bad', () => {
    const dir = makeContent(['events/a/index.vn', 'events/a.vn', 'events/Bad.vn'])
    const warnings: string[] = []
    expect(scanContent(dir, (w) => warnings.push(w)).events).toEqual(['a'])
    expect(warnings).toHaveLength(2)
  })
})

describe('required windows', () => {
  it('pnpm gen names each always-needed window that is missing (src/core/required.ts)', () => {
    expect(missingRequired(['menu', 'confirm', 'saves', 'shop'])).toEqual([])
    const missing = missingRequired(['confirm'])
    expect(missing).toHaveLength(2)
    expect(missing[0]).toContain('src/content/windows/menu is missing')
    expect(missing[1]).toContain('src/content/windows/saves is missing')
  })
})
