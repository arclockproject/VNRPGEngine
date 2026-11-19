import { describe, expect, it } from 'vitest'
import { checkVn } from './check.ts'
import { compileVn } from './compile.ts'
import { completeVn } from './complete.ts'
import { parseDialogue } from './dialogue.ts'
import type { VnIds } from './ids.ts'

const body = (source: string) => {
  const { code, errors } = compileVn(`title T\n${source}`, 'test.vn')
  const lines = code
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^(await |void )?(say|narrate)\(/.test(l))
    .map((l) => l.replace(/\s*\/\/ test\.vn:\d+$/, ''))
  return { lines, errors: errors.map((e) => e.message) }
}

const ids: VnIds = {
  characters: ['anna', 'hero'],
  poses: { anna: ['neutral', 'happy'], hero: [] },
  flags: [],
  items: [],
  events: [],
  windows: [],
  shops: [],
  enemies: [],
  troops: [],
  achievements: [],
  codex: [],
  gallery: [],
  audio: ['voice/en/anna/hi/anna_0001'],
  voiceClips: ['anna/hi/anna_0001'],
  quests: {},
  cgVariants: {},
  stages: [],
  filters: [],
  transitions: [],
  lineStyles: ['thought', 'whisper'],
}

describe('parseDialogue', () => {
  it('takes speaker lines apart, with columns', () => {
    expect(parseDialogue('anna:happy(italic, voice 0012): Hi!')).toMatchObject({
      who: 'anna',
      pose: 'happy',
      poseColumn: 5,
      text: 'Hi!',
      options: [
        { key: 'italic', value: '', keyColumn: 11 },
        { key: 'voice', value: '0012', keyColumn: 19, valueColumn: 25 },
      ],
    })
    expect(parseDialogue('"Student A": Hello')).toMatchObject({ who: null, name: 'Student A' })
    expect(parseDialogue('> (in brackets) is narration text')).toMatchObject({
      who: null,
      options: [],
      text: '(in brackets) is narration text',
    })
    expect(parseDialogue('>(italic) Soft.')).toMatchObject({ options: [{ key: 'italic' }] })
  })

  it('leaves commands, blocks and code alone', () => {
    for (const line of [
      'show anna at left',
      'if flag("a"):',
      'else:',
      'set talks += 1',
      '>no space',
    ])
      expect(parseDialogue(line)).toBeNull()
  })
})

describe('.vn line options', () => {
  it('compiles options into the say() / narrate() options', () => {
    const { lines, errors } = body(
      [
        'anna(italic, speed 0.5, auto 800, nopause): Hi!',
        'anna:happy(as ???, voice anna/hi/anna_0001, face happy): Guess who.',
        'hero(thought): I wonder...',
        'anna(as "Anna, the baker", size small, color #ffcc00, voice 0012): Bread?',
        'anna:happy(7, italic): A number alone is the voice number.',
        '>(shake) The ground moves.',
        'anna(whisper): You have [money()] coins.',
      ].join('\n'),
    )
    expect(errors).toEqual([])
    expect(lines).toEqual([
      'await say("anna", "Hi!", { italic: true, speed: 0.5, autoAdvance: 800, noAutoPause: true })',
      'await say("anna:happy", "Guess who.", { as: "???", face: "happy", voice: "anna/hi/anna_0001" })',
      'await say("hero", "I wonder...", { style: "thought" })',
      'await say("anna", "Bread?", { as: "Anna, the baker", size: "small", color: "#ffcc00", voice: 12 })',
      'await say("anna:happy", "A number alone is the voice number.", { italic: true, voice: 7 })',
      'await narrate("The ground moves.", { shake: true })',
      'await say("anna", "You have {money} coins.", { style: "whisper", money: money() })',
    ])
  })

  it('a quoted name is a speaker without a character', () => {
    const { lines, errors } = body('"Student A": Hello!\n"Student B"(italic): Hi.')
    expect(errors).toEqual([])
    expect(lines).toEqual([
      'await narrate("Hello!", { as: "Student A" })',
      'await narrate("Hi.", { as: "Student B", italic: true })',
    ])
  })

  it('reports bad options', () => {
    expect(body('anna(speed fast): Hi').errors[0]).toMatch(/use: speed/)
    expect(body('anna(italic yes): Hi').errors[0]).toMatch(/takes no value/)
    expect(body('anna(thought, whisper): Hi').errors[0]).toMatch(/only one named line style/)
    expect(body('"Bob"(as Rob): Hi').errors[0]).toMatch(/leave out "as"/)
    expect(body('anna(bad thing): Hi').errors[0]).toMatch(/unknown line option/)
  })
})

describe('bg with a background id', () => {
  const bgIds: VnIds = { ...ids, backgrounds: { 'school/classroom': ['evening'], street: [] } }
  const compiled = (line: string) => {
    const { code, errors } = compileVn(`title T\n${line}`, 'test.vn')
    const found = code.split('\n').find((l) => /^\s*(bg|background)\(/.test(l)) ?? ''
    return errors.length ? errors[0]?.message : found.trim().replace(/\s*\/\/ test\.vn:\d+$/, '')
  }

  it('ids go to the typed bg(); colours, files and none stay background()', () => {
    expect(compiled('bg school/classroom')).toBe('bg("school/classroom")')
    expect(compiled('bg school/classroom evening')).toBe('bg("school/classroom", "evening")')
    expect(compiled('bg street with wipeLeft 800')).toBe(
      'bg("street", null, { transition: "wipeLeft", duration: 800 })',
    )
    expect(compiled('bg #203040')).toBe('background("#203040")')
    expect(compiled('bg black')).toBe('background("black")')
    expect(compiled('bg none')).toBe('background(null)')
    expect(compiled('bg /img/sky.png with irisOut')).toBe(
      'background("/img/sky.png", { transition: "irisOut" })',
    )
    expect(compiled('bg rgba(0,0,0,0.5)')).toBe('background("rgba(0,0,0,0.5)")')
    expect(compiled('bg street evening extra')).toMatch(/use: bg/)
  })

  it('checks and completes ids and variants', () => {
    expect(checkVn('bg school/clasroom', bgIds)).toMatchObject([
      { column: 3, length: 15, message: expect.stringContaining('school/classroom') },
    ])
    expect(checkVn('bg school/classroom night', bgIds)).toMatchObject([{ column: 20, length: 5 }])
    expect(checkVn('bg #000\nbg none\nbg black\nbg street', bgIds)).toEqual([])
    const labels = (line: string) => completeVn(line, line.length, bgIds).items.map((i) => i.label)
    expect(labels('bg ')).toEqual(['school/classroom', 'street', 'none'])
    expect(labels('bg school/classroom ')).toEqual(['evening', 'with'])
  })
})

describe('checking and completing line options', () => {
  it('checks the voice id, the face pose and the style name', () => {
    expect(checkVn('anna(voice anna/hi/anna_0002): Hi', ids)).toMatchObject([
      { line: 1, column: 11, length: 17, message: expect.stringContaining('anna/hi/anna_0001') },
    ])
    // A number is never checked against the files: the clip may not be recorded yet.
    expect(checkVn('anna(99): Hi\nanna(voice 98, italic): Hi', ids)).toEqual([])
    expect(checkVn('anna(face hapy): Hi', ids)).toMatchObject([{ column: 10, length: 4 }])
    expect(checkVn('anna(thougt): Hi', ids)).toMatchObject([
      { column: 5, length: 6, message: expect.stringContaining('thought') },
    ])
    expect(checkVn('"Student A"(italic): Hi\n>(thought) Hm.\nanna(12): x', ids)).toEqual([])
    expect(checkVn('bob(italic): Hi', ids)).toMatchObject([{ column: 0, length: 3 }])
  })

  it('suggests options, then their values', () => {
    const labels = (line: string) => completeVn(line, line.length, ids).items.map((i) => i.label)
    expect(labels('anna(')).toEqual(expect.arrayContaining(['italic', 'voice', 'as', 'thought']))
    expect(labels('anna(italic, fa')).toContain('face')
    expect(labels('anna(face ')).toEqual(['neutral', 'happy'])
    expect(labels('anna(voice ')).toEqual(['anna/hi/anna_0001'])
    expect(labels('"Bob"(size ')).toEqual(['small', 'normal', 'large'])
    expect(labels('>(')).toContain('whisper')
  })
})

describe('lines said together, several voices', () => {
  it('compiles to say([...]) with a voice per speaker', () => {
    const { lines, errors } = body(
      [
        'jack & anna:happy(3, 7): Bye!',
        'anna(8, jack 4): Hm.',
        'anna(voice 9, jack town/x/jack_0001): Both.',
        'jack & anna(italic): No voices.',
      ].join('\n'),
    )
    expect(errors).toEqual([])
    expect(lines).toEqual([
      'await say(["jack", "anna:happy"], "Bye!", { voice: { jack: 3, anna: 7 } })',
      'await say("anna", "Hm.", { voice: { anna: 8, jack: 4 } })',
      'await say("anna", "Both.", { voice: { anna: 9, jack: "town/x/jack_0001" } })',
      'await say(["jack", "anna"], "No voices.", { italic: true })',
    ])
  })

  it('more numbers than speakers, or two voices for one, is an error', () => {
    expect(body('anna(1, 2): Hi').errors[0]).toContain('2 voice numbers for 1 speaker')
    expect(body('anna(1, anna 2): Hi').errors[0]).toContain('two voices for anna')
  })

  it('checks every member of a group (character and pose)', () => {
    const ids = {
      characters: ['anna', 'jack'],
      poses: { anna: ['happy'], jack: [] },
      audio: [],
    } as unknown as VnIds
    expect(checkVn('jack & ana: Hi', ids)).toMatchObject([{ column: 7, length: 3 }])
    expect(checkVn('jack & anna:hapy: Hi', ids)).toMatchObject([{ column: 12, length: 4 }])
    expect(parseDialogue('jack & anna: Hi')).toMatchObject({ who: null, bracketColumn: 11 })
  })
})
