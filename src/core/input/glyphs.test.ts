// Key and button names come from src/content/look/glyphs.ts; anything it leaves out still has a name.
import { describe, expect, it } from 'vitest'
import { buttonGlyph, keyLabel } from './glyphs'

describe('glyphs', () => {
  it('uses the content names', () => {
    expect(keyLabel('Escape')).toBe('Esc')
    expect(buttonGlyph(0, 'playstation').label).toBe('✕')
    expect(buttonGlyph(12, 'xbox').label).toBe('↑')
  })
  it('falls back for what content leaves out', () => {
    expect(keyLabel('KeyW')).toBe('W')
    expect(keyLabel('Digit3')).toBe('3')
    expect(keyLabel('F13')).toBe('F13')
    expect(buttonGlyph(42, 'xbox')).toEqual({ label: '#42' })
  })
})
