import { describe, expect, it } from 'vitest'
import { checkVn } from './check.ts'
import { completeVn } from './complete.ts'
import type { VnIds } from './ids.ts'
import { duplicateVoiceNumbers, nextVoiceNumber, numberVnLines, vnVoiceLines } from './voices.ts'

const ids = {
  characters: ['anna', 'jack'],
  poses: { anna: ['happy'], jack: [] },
  audio: [],
  voiceClips: ['town/arrival/anna_0003'],
  voiceDigits: 4,
} as unknown as VnIds

const script = [
  'title Test',
  'anna(0002): Hi!', // number 2
  'anna:happy(italic, voice 5): Wow.', // number 5
  'jack: Yo.', // none
  '"Student A": Eh?', // student_a, none
  '> The wind blows.', // plain narration
  '>(as Radio) Static.', // radio
  'anna(voice town/arrival/anna_0003): Again.', // a clip by name
  'choice:',
  '  * jack: not dialogue (an option)',
  '    jack: Inside the option.',
].join('\n')

describe('voice numbers in .vn', () => {
  it('finds each spoken line with its voice speaker and number', () => {
    const lines = vnVoiceLines(script)
    const voice = (l: (typeof lines)[number]) => l.voices[0]?.number ?? l.voices[0]?.clip ?? null
    expect(lines.map((l) => [l.speakers[0], voice(l), l.plain])).toEqual([
      ['anna', 2, false],
      ['anna', 5, false],
      ['jack', null, false],
      ['student_a', null, false],
      ['narrator', null, true],
      ['radio', null, false],
      ['anna', 'town/arrival/anna_0003', false],
      ['jack', null, false],
    ])
    expect(nextVoiceNumber(lines, 'anna')).toBe(6)
    expect(nextVoiceNumber(lines, 'jack')).toBe(1)
  })

  it('numbers the lines without a voice (not plain narration), never renumbering', () => {
    const { source, added } = numberVnLines(script, 4)
    expect(added).toBe(4)
    expect(source.split('\n')).toEqual([
      'title Test',
      'anna(0002): Hi!',
      'anna:happy(italic, voice 5): Wow.',
      'jack(0001): Yo.',
      '"Student A"(0001): Eh?',
      '> The wind blows.',
      '>(0001, as Radio) Static.',
      'anna(voice town/arrival/anna_0003): Again.',
      'choice:',
      '  * jack: not dialogue (an option)',
      '    jack(0002): Inside the option.',
    ])
    expect(numberVnLines(source, 4).added).toBe(0)
    expect(numberVnLines('anna(): Hi!', 2).source).toBe('anna(01): Hi!')
  })

  it('lines said together and extra voices: a number per speaker', () => {
    const source = [
      'title T',
      'jack & anna:happy(3, 7): Bye!',
      'anna(8, jack 4): Hm.',
      'jack & anna: Again!',
      'jack & anna(jack 5): Once more.',
    ].join('\n')
    const lines = vnVoiceLines(source)
    expect(lines[0]?.speakers).toEqual(['jack', 'anna'])
    expect(lines[0]?.voices.map((v) => [v.speaker, v.number])).toEqual([
      ['jack', 3],
      ['anna', 7],
    ])
    expect(lines[1]?.voices.map((v) => [v.speaker, v.number])).toEqual([
      ['anna', 8],
      ['jack', 4],
    ])
    expect(numberVnLines(source, 4).source.split('\n').slice(3)).toEqual([
      'jack & anna(0006, 0009): Again!',
      'jack & anna(anna 0010, jack 5): Once more.',
    ])
  })

  it('the checker flags a number one speaker uses twice', () => {
    const source = ['title T', 'anna(1): A', 'jack(1): B', 'anna(0001): C'].join('\n')
    expect(duplicateVoiceNumbers(vnVoiceLines(source))).toHaveLength(1)
    const problems = checkVn(source, ids).filter((p) => p.message.includes('voice number'))
    expect(problems).toEqual([
      {
        line: 4,
        column: 5,
        length: 4,
        message: 'voice number 1 of anna is already on line 2: give this line its own number',
      },
    ])
  })

  it('completion offers the next free number of the speaker first', () => {
    const source = ['title T', 'anna(0007): Hi', 'anna('].join('\n')
    const items = completeVn('anna(', 5, ids, source).items
    expect(items[0]).toMatchObject({ label: '0008', detail: 'the next free voice number of anna' })
    expect(completeVn('"Student A"(', 12, ids, source).items[0]?.label).toBe('0001')
    // Without the file there is no number to offer.
    expect(completeVn('anna(', 5, ids).items[0]?.label).not.toMatch(/^\d/)
  })
})

describe('completion on lines said together', () => {
  it('offers a next free number per speaker, in name order', () => {
    const ids = {
      characters: ['anna', 'jack'],
      poses: {},
      audio: [],
      voiceDigits: 4,
    } as unknown as VnIds
    const source = ['title T', 'jack & anna(4, 11): Hi', 'jack & anna:happy('].join('\n')
    const line = 'jack & anna:happy('
    expect(completeVn(line, line.length, ids, source).items[0]).toMatchObject({
      label: '0005, 0012',
      detail: 'the next free voice number of jack & anna',
    })
  })
})
