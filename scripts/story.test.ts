import { describe, expect, it } from 'vitest'
import { countWords, extractLines, plainText, unreachableVnLines } from './story.ts'

describe('pnpm story', () => {
  it('finds lines with their speaker and voice', () => {
    const code = `
      await say('anna:happy', 'Hello {name}!', { name, voice: 'anna/hello/anna_0001' })
      await narrate("It's late.")
      // await say('jack', 'a comment')
      await say('jack', 'Quiet.', { voice: 12 })
    `
    expect(extractLines(code)).toEqual([
      { speaker: 'anna', text: 'Hello {name}!', voice: 'anna/hello/anna_0001' },
      { speaker: null, text: "It's late." },
      { speaker: 'jack', text: 'Quiet.', voice: 12 },
    ])
  })

  it('counts words without markup, and letters for Japanese', () => {
    expect(plainText('{b}Hi{/b} {name}, wait{w=0.5} here')).toBe('Hi , wait here')
    expect(countWords("{wave}Don't{/wave} go there, {name}!")).toBe(3)
    expect(countWords('{ruby=とうきょう}東京{/ruby}へ')).toBe(3)
  })

  it('reports .vn lines after end', () => {
    const vn = [
      'anna: Hi',
      'if flag("x"):',
      '  end',
      '  anna: never',
      'else:',
      '  anna: fine',
      'end',
      'anna: never',
    ].join('\n')
    expect(unreachableVnLines(vn)).toEqual([4, 8])
  })
})
