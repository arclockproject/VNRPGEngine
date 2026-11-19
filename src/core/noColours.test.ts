// Looks belong in src/content/look/: core UI code must not write its own colours.
// Use a palette name ('text.secondary', 'common.black'), a named part (part('cover')) or
// a value from the look instead.
import { describe, expect, it } from 'vitest'

const sources = import.meta.glob<string>('./**/*.tsx', {
  query: '?raw',
  import: 'default',
  eager: true,
})
const COLOUR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/

describe('core UI', () => {
  it('has no hard-coded colours', () => {
    const found: string[] = []
    for (const [file, source] of Object.entries(sources)) {
      // Tests, and the dev panel (a tool, not part of the game), may.
      if (file.includes('.test.') || file.startsWith('./dev/')) continue
      source.split('\n').forEach((line, index) => {
        const code = line.trim()
        // Comments may mention colours as examples.
        if (code.startsWith('//') || code.startsWith('*') || code.startsWith('/*')) return
        if (COLOUR.test(code)) found.push(`${file}:${index + 1}  ${code}`)
      })
    }
    expect(Object.keys(sources).length).toBeGreaterThan(10)
    expect(found).toEqual([])
  })
})
