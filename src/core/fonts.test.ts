// src/content/fonts: 'choice' fonts join Settings → Font after scenes.ts, 'fallback' fonts come after
// every font list, and the current font is always a real choice.
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/content/fonts', () => ({
  default: {
    pixel: { name: 'Pixel', file: '/pixel.woff2' },
    pixelBold: { name: 'Pixel bold', file: '/pixel-bold.woff2', family: 'pixel', weight: 'bold' },
    emoji: { name: 'Emoji', file: '/emoji.ttf', use: 'fallback' },
    special: { name: 'Special', file: '/special.woff2', use: 'internal' },
  },
}))

const { FONT_CHOICES, FALLBACK_FONTS, withFallbacks, DEFAULT_FONT } = await import('./fontList')
const { fonts } = await import('./managers/fonts')
const { useSettingsStore } = await import('./stores/settings')

describe('game fonts', () => {
  it('lists scenes.ts fonts first, then each choice family once; fallbacks are never choices', () => {
    const ids = Object.keys(FONT_CHOICES)
    expect(ids[0]).toBe(DEFAULT_FONT)
    expect(ids.slice(-1)).toEqual(['pixel'])
    expect(ids).not.toContain('pixelBold')
    expect(ids).not.toContain('emoji')
    expect(ids).not.toContain('special')
    expect(FONT_CHOICES.pixel).toEqual({ name: 'Pixel', family: '"pixel", sans-serif' })
  })

  it('puts the fallback fonts after any font list', () => {
    // Internal fonts are only used where the game names them.
    expect(FALLBACK_FONTS).toBe('"emoji"')
    expect(withFallbacks('Georgia, serif')).toBe('Georgia, serif, "emoji"')
    const pixel = fonts.choices().find((choice) => (choice.id as string) === 'pixel')
    expect(pixel?.family).toBe('"pixel", sans-serif, "emoji"')
  })

  it('current() is the picked font, or the default for an id that no longer exists', () => {
    useSettingsStore.setState({ font: 'pixel' })
    expect(fonts.current()).toBe('pixel')
    useSettingsStore.setState({ font: 'removed' })
    expect(fonts.current()).toBe(DEFAULT_FONT)
  })
})
