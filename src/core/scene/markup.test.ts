import { describe, expect, it } from 'vitest'
import { AUTO_PAUSE_MS, parseMarkup, stripMarkup } from './markup'

describe('parseMarkup', () => {
  it('styles characters and nests tags', () => {
    const { chars, plain } = parseMarkup('a{b}b{color=red}c{/color}d{/b}e')
    expect(plain).toBe('abcde')
    expect(chars.map((c) => c.style)).toEqual([
      {},
      { bold: true },
      { bold: true, color: 'red' },
      { bold: true },
      {},
    ])
  })

  it('{/} closes the latest tag; closing an outer tag closes inner ones', () => {
    expect(parseMarkup('{i}{shake}x{/}y{/i}z').chars.map((c) => c.style)).toEqual([
      { italic: true, shake: true },
      { italic: true },
      {},
    ])
    expect(parseMarkup('{b}{wave}x{/b}y').chars.map((c) => c.style)).toEqual([
      { bold: true, wave: true },
      {},
    ])
  })

  it('pauses before the next character, or after the text', () => {
    const parsed = parseMarkup('Well{w=0.5}… {w}no{w=1}')
    expect(parsed.chars.map((c) => c.pauseBefore)).toEqual([0, 0, 0, 0, 500, 0, 500, 0])
    expect(parsed.pauseAfter).toBe(1000)
  })

  it('keeps {{ and broken braces, drops unknown tags', () => {
    const parsed = parseMarkup('{{x} {nope}ok {oops')
    expect(parsed.plain).toBe('{x} ok {oops')
    expect(parsed.unknown).toEqual(['nope'])
  })

  it('keeps emoji together', () => {
    expect(parseMarkup('hi 👋').chars.map((c) => c.char)).toEqual(['h', 'i', ' ', '👋'])
    expect(stripMarkup('{b}Hey{/b}!')).toBe('Hey!')
  })
})

describe('automatic pause after . ! ?', () => {
  const pauses = (text: string) => {
    const parsed = parseMarkup(text, { autoPause: true })
    return [...parsed.chars.map((c) => c.pauseBefore), parsed.pauseAfter]
  }
  const total = (text: string) => pauses(text).reduce((a, b) => a + b, 0)

  it('pauses after a sentence end followed by a space or the end of the text', () => {
    expect(total('Hey! What?')).toBe(AUTO_PAUSE_MS * 2)
    expect(total('Done.')).toBe(AUTO_PAUSE_MS)
    // The pause comes after the punctuation, before the next character.
    expect(pauses('Hi. Yo')[3]).toBe(AUTO_PAUSE_MS)
  })

  it('pauses once for "?!" and "..." runs', () => {
    expect(total('What?!')).toBe(AUTO_PAUSE_MS)
    expect(total('Wait...')).toBe(AUTO_PAUSE_MS)
  })

  it('ignores dots inside words and numbers', () => {
    expect(total('v1.5 and 2.0x')).toBe(0)
    expect(total('3.14')).toBe(0)
  })

  it('looks through closing quotes and markup', () => {
    expect(total('"Thanks!" she said')).toBe(AUTO_PAUSE_MS)
    expect(total('{b}Hey!{/b} you')).toBe(AUTO_PAUSE_MS)
  })

  it('supports full-width punctuation for translations', () => {
    expect(total('こんにちは。元気？')).toBe(AUTO_PAUSE_MS * 2)
  })

  it('is off unless asked for', () => {
    expect(parseMarkup('Hey! What?').pauseAfter).toBe(0)
    expect(parseMarkup('Hey! What?').chars.every((c) => c.pauseBefore === 0)).toBe(true)
  })

  it('adds to explicit {w=} pauses', () => {
    expect(parseMarkup('Hey!{w=1} Yo', { autoPause: true }).chars[4]?.pauseBefore).toBe(
      1000 + AUTO_PAUSE_MS,
    )
  })
})

describe('ruby text', () => {
  it('marks the letters under a reading and keeps runs apart', () => {
    const parsed = parseMarkup('{ruby=とうきょう}東京{/ruby}と{ruby=きょうと}京都{/ruby}')
    expect(parsed.plain).toBe('東京と京都')
    expect(parsed.unknown).toEqual([])
    const [a, b, c, d] = parsed.chars
    expect(a?.style.ruby).toBe('とうきょう')
    expect(b?.style.rubyGroup).toBe(a?.style.rubyGroup)
    expect(c?.style.ruby).toBeUndefined()
    expect(d?.style.ruby).toBe('きょうと')
    expect(d?.style.rubyGroup).not.toBe(a?.style.rubyGroup)
  })
})
