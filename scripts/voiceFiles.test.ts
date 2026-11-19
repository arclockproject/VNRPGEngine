import { describe, expect, it } from 'vitest'
import { compileVn } from '../vite/vn/compile.ts'
import { extractLines } from './story.ts'
import {
  clipsOf,
  numberTsLines,
  readVoiceConfig,
  splitVoiceId,
  type VoiceLine,
  voiceReport,
} from './voiceFiles.ts'

const line = (speaker: string | null, text: string, more: Partial<VoiceLine> = {}): VoiceLine => ({
  speaker,
  text,
  ...more,
})
const config = { languages: ['ja', 'en'], digits: 4 }
/** The one clip of a line (null without a voice). */
const clipOf = (event: string, l: VoiceLine, digits: number) =>
  clipsOf(event, l, digits)[0]?.clip ?? null

describe('voice clip names', () => {
  it('are the event, the speaker and the padded number; no number = no clip', () => {
    expect(clipOf('town/sign', line('anna', 'Eh?', { voice: 12 }), 4)).toBe('town/sign/anna_0012')
    expect(clipOf('town/sign', line('anna', 'Eh?', { voice: 12 }), 2)).toBe('town/sign/anna_12')
    expect(clipOf('town/sign', line('anna', 'Eh?', { voice: 12345 }), 4)).toBe(
      'town/sign/anna_12345',
    )
    expect(clipOf('town/sign', line('anna', 'Eh?'), 4)).toBeNull()
    expect(clipOf('e', line(null, 'Hm.', { voice: 1 }), 4)).toBe('e/narrator_0001')
    expect(clipOf('e', line(null, 'Hm.', { as: 'Student A', voice: 1 }), 4)).toBe(
      'e/student_a_0001',
    )
    // A clip by name is used as it is (another event's clip).
    expect(clipOf('e', line('anna', 'Hi', { voice: 'town/sign/anna_0012' }), 4)).toBe(
      'town/sign/anna_0012',
    )
  })

  it('a line with several voices has a clip per speaker', () => {
    expect(
      clipsOf('e', line('jack', 'Bye', { voice: { jack: 3, anna: 'x/anna_0001' } }), 4),
    ).toEqual([
      { clip: 'e/jack_0003', speaker: 'jack', numbered: true },
      { clip: 'x/anna_0001', speaker: 'anna', numbered: false },
    ])
  })

  it('reads lines said together and voice maps from TS', () => {
    const code = "await say(['jack', 'anna:happy'], 'Bye!', { voice: { jack: 3, 'anna': 7 } })"
    expect(extractLines(code)).toEqual([
      { speaker: 'jack', speakers: ['jack', 'anna'], text: 'Bye!', voice: { jack: 3, anna: 7 } },
    ])
  })

  it('.vn lines carry their number into the compiled event', () => {
    const { code } = compileVn('title T\nanna(12): Eh?\njack: Eh?\n"Bob"(0003): Eh?')
    expect(extractLines(code)).toEqual([
      { speaker: 'anna', text: 'Eh?', voice: 12 },
      { speaker: 'jack', text: 'Eh?' },
      { speaker: null, text: 'Eh?', as: 'Bob', voice: 3 },
    ])
  })

  it('reads languages and digits from the text of content/scenes.ts', () => {
    const source =
      "export default defineScenes({\n  voice: {\n    duckMusic: 0.4,\n    languages: ['ja', 'en'],\n    digits: 3,\n  },\n})"
    expect(readVoiceConfig(source)).toEqual({ languages: ['ja', 'en'], digits: 3 })
    expect(readVoiceConfig('nothing here')).toEqual({ languages: ['en'], digits: 4 })
    expect(splitVoiceId('voice/ja/town/sign/anna_0012')).toEqual({
      lang: 'ja',
      clip: 'town/sign/anna_0012',
    })
    expect(splitVoiceId('music/town')).toBeNull()
  })
})

describe('voiceReport', () => {
  const events = [
    {
      id: 'town/sign',
      lines: [
        line('anna', 'One', { voice: 1 }),
        line('anna', 'Two', { voice: 2 }),
        line('jack', 'No voice'),
        line('jack', 'Mine', { voice: 1 }),
      ],
    },
    { id: 'other', lines: [line('anna', 'Again', { voice: 'town/sign/anna_0001' })] },
  ]
  const audio = [
    'music/town',
    'voice/ja/town/sign/anna_0001',
    'voice/ja/town/sign/jack_0001',
    'voice/en/town/sign/anna_0001',
    'voice/ja/town/sign/anna_0009',
    'voice/anna/old',
    'voice/pl/town/sign/anna_0001',
  ]

  it('tells recorded lines from the ones to record (in the default language)', () => {
    const report = voiceReport(events, audio, config)
    expect(report.lines.map((entry) => [entry.clips[0]?.clip ?? null, entry.status])).toEqual([
      ['town/sign/anna_0001', 'recorded'],
      ['town/sign/anna_0002', 'to record'],
      [null, 'no voice'],
      ['town/sign/jack_0001', 'recorded'],
      ['town/sign/anna_0001', 'recorded'],
    ])
  })

  it('lists clips no line plays, sounds that are not clips, and what a language is missing', () => {
    const report = voiceReport(events, audio, config)
    expect(report.unused).toEqual(['voice/ja/town/sign/anna_0009'])
    // Not in a language folder of the config.
    expect(report.stray).toEqual(['voice/anna/old', 'voice/pl/town/sign/anna_0001'])
    expect(report.missing).toEqual({ en: ['town/sign/jack_0001'] })
  })

  it('a number on two lines of one event is reported; a clip named twice is fine', () => {
    const twice = [
      {
        id: 'e',
        lines: [
          line('anna', 'A', { voice: 5 }),
          line('anna', 'B', { voice: 5 }),
          line('jack', 'C', { voice: 5 }),
          line('anna', 'D', { voice: 'e/anna_0005' }),
        ],
      },
    ]
    expect(voiceReport(twice, [], config).duplicates).toEqual([
      { event: 'e', clip: 'e/anna_0005', count: 2 },
    ])
  })
})

describe('numbering TypeScript events', () => {
  it('adds the next free number per speaker, into the options when there are some', () => {
    const code = [
      "await say('anna', 'One', { voice: 4 })",
      "await say('anna:happy', 'Two')",
      "await say('jack', 'Three', { shake: true })",
      "await say('anna', 'Four', {})",
      "await narrate('Plain narration.')",
      "await narrate('Named', { as: 'Student A' })",
      "await say('anna', 'Clip', { voice: 'town/x/anna_0001' })",
      "await say(['jack', 'anna'], 'Together')",
      "// await say('anna', 'commented out')",
      "await say('jack', 'Options from a variable', style)",
      'await say(',
      "  'jack',",
      "  'Long',",
      '  {',
      '    size: "large",',
      '  },',
      ')',
    ].join('\n')
    const { code: out, added, skipped } = numberTsLines(code)
    expect(added).toBe(6)
    expect(skipped).toBe(1)
    expect(out.split('\n')).toEqual([
      "await say('anna', 'One', { voice: 4 })",
      "await say('anna:happy', 'Two', { voice: 5 })",
      "await say('jack', 'Three', { voice: 1, shake: true })",
      "await say('anna', 'Four', { voice: 6 })",
      "await narrate('Plain narration.')",
      "await narrate('Named', { voice: 1, as: 'Student A' })",
      "await say('anna', 'Clip', { voice: 'town/x/anna_0001' })",
      "await say(['jack', 'anna'], 'Together', { voice: { jack: 2, anna: 7 } })",
      "// await say('anna', 'commented out')",
      "await say('jack', 'Options from a variable', style)",
      'await say(',
      "  'jack',",
      "  'Long',",
      '  {',
      '    voice: 3,',
      '    size: "large",',
      '  },',
      ')',
    ])
    expect(numberTsLines(out).added).toBe(0)
  })
})
