// "<name>.<lang>.<ext>" files: pictures / videos (virtual:lang-files) and sounds (the registry).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  findLangFiles,
  findVoiceLangFiles,
  renderLangFiles,
  renderVoiceLangFiles,
} from './langFiles.ts'
import { scanAudio } from './registry.ts'

let root = ''
function project(files: string[]) {
  root = mkdtempSync(path.join(tmpdir(), 'lang-files-'))
  for (const lang of ['ja', 'pl'])
    mkdirSync(path.join(root, 'src/content/lang', lang), { recursive: true })
  for (const file of files) {
    const full = path.join(root, 'src/content', file)
    mkdirSync(path.dirname(full), { recursive: true })
    writeFileSync(full, '')
  }
}
afterEach(() => rmSync(root, { recursive: true, force: true }))

describe('files per language', () => {
  it('finds pictures and videos with the file they stand in for, never generated ones', () => {
    project([
      'assets/logo.svg',
      'assets/logo.ja.svg',
      'assets/logo.pl.svg',
      'movies/op/op.webm',
      'movies/op/op.ja.webm',
      'gallery/pond/pond.gen.png',
      'gallery/pond/pond.ja.gen.png', // made from Aseprite language layers: not a file version
      'assets/sign.de.png', // not a language of the game: an ordinary file name
    ])
    const warnings: string[] = []
    const found = findLangFiles(path.join(root, 'src/content'), ['ja', 'pl'], (m) =>
      warnings.push(m),
    )
    const rel = (f: string) => path.relative(path.join(root, 'src/content'), f)
    expect(found.map((f) => [f.lang, rel(f.base), rel(f.file)]).sort()).toEqual([
      ['ja', 'assets/logo.svg', 'assets/logo.ja.svg'],
      ['ja', 'movies/op/op.webm', 'movies/op/op.ja.webm'],
      ['pl', 'assets/logo.svg', 'assets/logo.pl.svg'],
    ])
    expect(warnings).toEqual([])
    const module = renderLangFiles(found)
    expect(module).toContain('ja: {')
    expect(module.match(/^import /gm)).toHaveLength(5) // logo.svg imported once for both languages
  })

  it('a version without its file is left out (with a warning), so nothing missing is asked for', () => {
    project(['assets/title.ja.png'])
    const warnings: string[] = []
    expect(findLangFiles(path.join(root, 'src/content'), ['ja'], (m) => warnings.push(m))).toEqual(
      [],
    )
    expect(warnings).toEqual([expect.stringContaining('no title.png next to it')])
  })

  it('sounds: hello.ja.wav is hello in Japanese, not a sound of its own', () => {
    project([
      'audio/voice/anna/hello.wav',
      'audio/voice/anna/hello.ja.wav',
      'audio/sfx/beep.pl.wav',
    ])
    const warnings: string[] = []
    const audio = scanAudio(root, (m) => warnings.push(m))
    expect(audio).toEqual([
      {
        id: 'voice/anna/hello',
        file: 'voice/anna/hello.wav',
        langs: [{ lang: 'ja', file: 'voice/anna/hello.ja.wav' }],
      },
    ])
    expect(warnings).toEqual([
      expect.stringContaining('audio/sfx/beep.pl.wav: no "sfx/beep" sound'),
    ])
  })
})

describe('movies per voice language', () => {
  it('groups a file with its versions in the other voice-language folders', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'voice-lang-'))
    try {
      for (const file of [
        'op/ja/op.webm',
        'op/en/op.webm',
        'ed/ja/ed.mp4',
        'plain/clip.webm',
        'op/ja/notes.txt',
      ]) {
        mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
        writeFileSync(path.join(dir, file), '')
      }
      const groups = findVoiceLangFiles(dir, ['ja', 'en'])
      const rel = (group: Record<string, string>) =>
        Object.fromEntries(
          Object.entries(group).map(([lang, file]) => [lang, path.relative(dir, file)]),
        )
      expect(groups.map(rel).sort((a, b) => String(a.ja).localeCompare(String(b.ja)))).toEqual([
        { ja: 'ed/ja/ed.mp4' },
        { en: 'op/en/op.webm', ja: 'op/ja/op.webm' },
      ])
      expect(renderVoiceLangFiles([{ ja: '/a.webm', en: '/b.webm' }])).toContain(
        '{ ja: v0, en: v1 }',
      )
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
