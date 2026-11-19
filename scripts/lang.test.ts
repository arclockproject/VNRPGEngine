import { describe, expect, it } from 'vitest'
import { emptyKeys, extract, extractCalls, translatedKeys, unquote } from './lang.ts'

describe('pnpm lang: finding game text', () => {
  it('finds dialogue, choices, names, steps and t()/tx() calls', () => {
    const source = `
      // t('Hello {name}') in a comment is ignored
      await say('anna', "Hi! It's me.")
      await narrate('A quiet night.')
      void jack.bark('Over here!')
      defineEvent({ replay: 'The pond', run })
      const pick = await choice({ a: 'Yes', ...(x ? {} : { b: 'Maybe' }), c: 'No' })
      await choice(['One', 'Two'])
      defineQuest({ title: 'Find it', steps: { look: 'Look around', done: 'Go home' } })
      t(done ? 'Done' : 'Failed')
      const P = { keyboard: tx('Press any key') }
      say('jack', \`built \${n}\`)
    `
    expect(extract(source).sort()).toEqual(
      [
        "Hi! It's me.",
        'A quiet night.',
        'Over here!',
        'The pond',
        'Yes',
        'Maybe',
        'No',
        'One',
        'Two',
        'Find it',
        'Look around',
        'Go home',
        'Done',
        'Failed',
        'Press any key',
      ].sort(),
    )
  })

  it('reads only t()/tx() in engine code', () => {
    expect(extractCalls("toast(t('New quest: {title}', { title })); const label = 'x'")).toEqual([
      'New quest: {title}',
    ])
  })

  it('reads translated keys, quoted or bare, not values', () => {
    const file = `defineLanguage({ name: 'Deutsch', strings: {
      // comment: 'not a key'
      Inventory: 'Inventar',
      "It's: odd": 'Seltsam: ja, wirklich',
      'Multi': 'a,
        b',
    } })`
    expect([...translatedKeys(file)]).toEqual(['Inventory', "It's: odd", 'Multi'])
  })

  it('plural entries count as one key (their forms are not keys)', () => {
    const file = `export default { name: 'X', strings: {
      '{count} apples': { one: '{count} jabłko', few: '{count} jabłka', other: '{count} jabłek' },
      Next: 'Dalej',
    } }`
    expect([...translatedKeys(file)]).toEqual(['{count} apples', 'Next'])
  })

  it('lists entries that are still empty', () => {
    const file = `export default { name: 'X', strings: {
      Next: 'Dalej',
      Later: '',
      "It's: odd":
        '',
    } }`
    expect(emptyKeys(file)).toEqual(['Later', "It's: odd"])
  })

  it('finds the question of an input()', () => {
    expect(extract("const n = await input('Your name?', { placeholder: 'Name' })")).toEqual([
      'Your name?',
      'Name',
    ])
    expect(extract("game.input.on('confirm', go)")).toEqual([])
  })

  it('unquotes escapes', () => {
    expect(unquote(String.raw`'It\'s'`)).toBe("It's")
  })
})
