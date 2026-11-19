import { describe, expect, it } from 'vitest'
import { checkVn } from './check.ts'
import { completeVn } from './complete.ts'
import { topLevelKeys, type VnIds } from './ids.ts'

const ids: VnIds = {
  characters: ['anna', 'hero'],
  poses: { anna: ['neutral', 'happy'], hero: [] },
  flags: ['met_anna'],
  items: ['apple', 'bread'],
  events: ['anna/flashback'],
  windows: ['inventory'],
  shops: ['anna'],
  enemies: ['slime', 'bat'],
  troops: ['wolf_pack'],
  achievements: ['builder'],
  codex: ['town'],
  gallery: ['pond_memory'],
  audio: ['music/town', 'sfx/click'],
  quests: { jacks_letter: ['mailbox', 'read'] },
  cgVariants: { pond_memory: ['crying', 'crying.full_moon'] },
  stages: ['left', 'center', 'right'],
  filters: ['flashback'],
  transitions: ['wipeLeft', 'irisOut'],
  moves: ['hop', 'nod'],
  weather: ['rain', 'snow'],
  endings: ['tour_complete'],
}

describe('checkVn', () => {
  it('underlines unknown ids with a guess', () => {
    const problems = checkVn(
      [
        'ana: Hi', // 1
        'anna:hapy: Yay', // 2
        'hero:whatever: placeholder portraits accept any pose', // 3
        'show anna at middle pose happy', // 4
        'give aple 2', // 5
        'battle slime, bta', // 6
        'if flag(\'met_ana\') and has("apple"):', // 7
        '  > fine', // 8
        'quest step jacks_letter reed', // 9
        'music none', // 10
        'set met_anna = true', // 11
        '$ say(\'nobody\', "TypeScript checks this")', // 12
        'cg pond_memory cryin', // 13
        'cg pond_memory crying.full_moon', // 14
      ].join('\n'),
      ids,
    )
    expect(problems.map((p) => [p.line, p.column, p.length])).toEqual([
      [1, 0, 3],
      [2, 5, 4],
      [4, 13, 6],
      [5, 5, 4],
      [6, 14, 3],
      [7, 9, 7],
      [9, 24, 4],
      [13, 15, 5],
    ])
    expect(problems[0]?.message).toBe('unknown character "ana" (did you mean "anna"?)')
    expect(problems[1]?.message).toContain('poses: neutral, happy')
  })
})

describe('checkVn: scene commands added later', () => {
  it('checks move, weather and ending ids', () => {
    const problems = checkVn(
      [
        'move anna hop',
        'move ana hopp',
        'weather snow 0.5',
        'weather sno',
        'weather none',
        'ending tour_complet',
      ].join('\n'),
      ids,
    )
    expect(problems.map((p) => [p.line, p.column, p.message.split(' (')[0]])).toEqual([
      [2, 5, 'unknown character "ana"'],
      [2, 9, 'unknown move "hopp"'],
      [4, 8, 'unknown weather "sno"'],
      [6, 7, 'unknown ending "tour_complet"'],
    ])
  })

  it('suggests them', () => {
    const labels = (text: string) => completeVn(text, text.length, ids).items.map((i) => i.label)
    expect(labels('move anna ')).toEqual(['hop', 'nod'])
    expect(labels('weather ')).toEqual(['rain', 'snow', 'none'])
    expect(labels('ending ')).toEqual(['tour_complete'])
    expect(labels('nvl ')).toEqual(['on', 'off', 'clear'])
    expect(labels('image letter /a.png layer ')).toEqual(['back', 'front', 'top'])
  })
})

describe('completeVn', () => {
  const labels = (line: string, column = line.length) =>
    completeVn(line, column, ids).items.map((i) => i.label)

  it('suggests by context', () => {
    expect(labels('')).toEqual(expect.arrayContaining(['anna:', 'show', 'choice:', 'if']))
    expect(labels('  sh')).toContain('show')
    expect(labels('anna:')).toEqual(['neutral', 'happy'])
    expect(labels('show ')).toEqual(['anna', 'hero'])
    expect(labels('show anna ')).toEqual(['at', 'pose', 'distance', 'tint', 'frame', 'flip'])
    expect(labels('show anna at ')).toEqual(['left', 'center', 'right'])
    expect(labels('show anna pose ha')).toEqual(['neutral', 'happy'])
    expect(labels('give ')).toEqual(['apple', 'bread'])
    expect(labels('battle slime, ')).toEqual(['wolf_pack', 'slime', 'bat'])
    expect(labels('music ')).toEqual(['music/town', 'sfx/click', 'none'])
    expect(labels('cg pond_memory ')).toEqual(['crying', 'crying.full_moon', 'with'])
    expect(labels('bg #000 with ')).toEqual(['wipeLeft', 'irisOut'])
    expect(labels('cg pond_memory crying with ')).toEqual(['wipeLeft', 'irisOut'])
    expect(labels("if flag('")).toEqual(['met_anna'])
    expect(labels('quest step jacks_letter ')).toEqual(['mailbox', 'read'])
    expect(labels('anna: Hello {')).toContain('wave')
  })

  it('after "meanwhile" suggests commands only, then their arguments', () => {
    const after = labels('meanwhile ')
    expect(after).toContain('fade')
    expect(after).not.toContain('anna:')
    expect(after).not.toContain('wait')
    expect(labels('meanwhile sfx ')).toEqual(['music/town', 'sfx/click'])
    expect(labels('to')).toContain('together:')
  })

  it('checks ids after "meanwhile" at the right column; together: is fine', () => {
    expect(checkVn('together:\n  meanwhile sfx sfx/clik', ids)).toMatchObject([
      { line: 2, column: 16, length: 8 },
    ])
  })

  it('replaces the word being typed (ids may contain "/")', () => {
    expect(completeVn('event anna/fl', 13, ids).start).toBe(6)
  })
})

describe('topLevelKeys', () => {
  it('reads keys of an object literal, skipping nesting, strings and comments', () => {
    const text = `({ a: 1, 'b c': { x: 2 }, // d: no
      e, f() {}, g: [1, { h: 3 }], /* i: no */ j: 'k: no' })`
    expect(topLevelKeys(text, 1)).toEqual(['a', 'b c', 'e', 'f', 'g', 'j'])
  })
})
