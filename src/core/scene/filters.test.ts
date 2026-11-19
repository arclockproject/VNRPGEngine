import { describe, expect, it } from 'vitest'
import {
  backdropCss,
  backgroundTint,
  filterCss,
  parseColour,
  tintScale,
  tintScales,
} from './filters'

describe('scene filters and tints', () => {
  it('reads colours', () => {
    expect(parseColour('#fff')).toEqual([1, 1, 1])
    expect(parseColour('#ff000080')).toEqual([1, 0, 0])
    expect(parseColour('rgb(0, 51, 255)')).toEqual([0, 0.2, 1])
    expect(parseColour('red')).toBeNull()
  })

  it('a tint multiplies by its colour, scaled by strength', () => {
    expect(tintScale({ color: '#000000', strength: 0.5 })).toEqual([0.5, 0.5, 0.5])
    expect(tintScale({ color: '#ffffff' })).toEqual([1, 1, 1])
    expect(tintScale({ css: 'blur(1px)' })).toBeNull()
  })

  it('presets, tints and own values become CSS', () => {
    expect(filterCss('blur')).toBe('blur(6px)')
    expect(filterCss(null)).toBeUndefined()
    expect(filterCss({ css: 'grayscale(1)' })).toBe('grayscale(1)')
    expect(filterCss({ color: '#000', strength: 1, css: 'saturate(2)' })).toBe(
      'url(#tint-0-0-0) saturate(2)',
    )
    // The map behind only gets the css part (no url() in backdrop-filter).
    expect(backdropCss({ color: '#000', css: 'saturate(2)' })).toBe('saturate(2)')
    expect(backdropCss({ color: '#000' })).toBeUndefined()
    expect(tintScales([{ color: '#000' }, { color: '#000' }, 'blur', null])).toHaveLength(1)
  })

  it('background variants tint the characters (content/scenes.ts tintByBackground)', () => {
    expect(backgroundTint('evening')).toBe('evening')
    expect(backgroundTint('crying.evening')).toBe('evening')
    expect(backgroundTint('day')).toBeNull()
    expect(backgroundTint(undefined)).toBeNull()
  })
})
