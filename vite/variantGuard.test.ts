// Variant scenes never leak: what only a variant scene uses is left out of the other builds.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { computeGuard, withoutEntries } from './variantGuard.ts'

function project(files: Record<string, string>) {
  const root = mkdtempSync(path.join(tmpdir(), 'guard-'))
  for (const [file, text] of Object.entries(files)) {
    const full = path.join(root, file)
    mkdirSync(path.dirname(full), { recursive: true })
    writeFileSync(full, text)
  }
  return root
}

const c = 'src/content'
const files = {
  [`${c}/events/park.vn`]: 'title The park\n> A walk in the park.\ncg shared\n',
  [`${c}/events/park.adult.vn`]:
    'title The park\ncg secret\ncg shared\nsfx sfx/moan\nanna(3): A line only the adult park has.\n',
  [`${c}/events/day.adult/index.ts`]:
    "export default defineEvent({ title: 'Day', run: async ({ say }) => { await say('anna', 'Folder scene secret text.').then(() => say('anna', 'Another secret line.', { voice: 'day/anna_0007' })) } })\n",
  [`${c}/gallery/secret/index.ts`]:
    "export default defineGallery({ title: tx('Secret picture'), image })\n",
  [`${c}/gallery/secret/image.png`]: '',
  [`${c}/gallery/shared/index.ts`]:
    "export default defineGallery({ title: tx('Shared picture'), image })\n",
  [`${c}/gallery/shared/image.png`]: '',
  [`${c}/audio/sfx/moan.ogg`]: '',
  [`${c}/audio/sfx/moan.ja.ogg`]: '',
  [`${c}/audio/sfx/door.ogg`]: '',
  [`${c}/audio/voice/en/park/anna_0003.ogg`]: '',
  [`${c}/audio/voice/en/park/anna_0001.ogg`]: '',
  [`${c}/audio/voice/en/day/anna_0007.ogg`]: '',
  [`${c}/variants/adult/strings.ts`]:
    "export default defineVariantStrings({ 'A walk in the park.': tx('A grown up walk.') })\n",
}

describe('variant leak guard', () => {
  const root = project(files)
  const all = ['allages', 'adult']
  const rel = (set: Iterable<string>) =>
    [...set].map((f) => path.relative(path.join(root, c), f)).sort()

  it('a build without the value leaves out what only that version uses', () => {
    const guard = computeGuard(root, all, ['allages'])
    expect(rel(guard.entries.keys())).toEqual(['gallery/secret/index.ts'])
    expect(rel(guard.files)).toEqual([
      'audio/sfx/moan.ja.ogg',
      'audio/sfx/moan.ogg',
      'audio/voice/en/day/anna_0007.ogg',
      'audio/voice/en/park/anna_0003.ogg',
    ])
    expect([...guard.texts].sort()).toEqual([
      'A grown up walk.',
      'A line only the adult park has.',
      'Another secret line.',
      'Day', // the off scene's title
      'Folder scene secret text.',
      'Secret picture',
    ])
    expect(rel(guard.offSources)).toEqual([
      'events/day.adult/index.ts',
      'events/park.adult.vn',
      'gallery/secret/index.ts',
      'variants/adult/strings.ts',
    ])
  })

  it('the build with the value keeps everything', () => {
    const guard = computeGuard(root, all, ['adult'])
    expect(guard.entries.size + guard.files.size + guard.texts.size).toBe(0)
  })

  it('language files lose only those entries', () => {
    const lang = `export default defineLanguage({
  strings: {
    // Park
    'A walk in the park.': 'こうえんをさんぽ。',
    'A line only the adult park has.':
      'おとなだけのセリフ。',
    'Secret picture': { one: 'ひみつ', other: 'ひみつたち' },
    Bare: 'そのまま',
  },
})
`
    const out = withoutEntries(lang, new Set(['A line only the adult park has.', 'Secret picture']))
    expect(out).toBe(`export default defineLanguage({
  strings: {
    // Park
    'A walk in the park.': 'こうえんをさんぽ。',
    Bare: 'そのまま',
  },
})
`)
  })
})
