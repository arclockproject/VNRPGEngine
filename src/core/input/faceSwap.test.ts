// "Confirm with": Nintendo controllers confirm with the right face button; prompts follow.
import { afterEach, describe, expect, it } from 'vitest'
import { useSettingsStore } from '../stores/settings'
import { faceSwapped, swapFace } from './faceSwap'
import { buttonGlyph } from './glyphs'

afterEach(() => useSettingsStore.setState({ confirmButton: 'auto' }))

describe('confirm button', () => {
  it('automatic: swapped on Nintendo controllers only', () => {
    expect(faceSwapped('nintendo')).toBe(true)
    expect(faceSwapped('xbox')).toBe(false)
    expect(swapFace(0, 'nintendo')).toBe(1)
    expect(swapFace(1, 'nintendo')).toBe(0)
    expect(swapFace(3, 'nintendo')).toBe(3)
    // Confirm (bound to the bottom button) is named A on Nintendo: the right one, as it acts.
    expect(buttonGlyph(0, 'nintendo').label).toBe('A')
    expect(buttonGlyph(0, 'playstation').label).toBe('✕')
  })

  it('the player can pick either button on any controller', () => {
    useSettingsStore.setState({ confirmButton: 'right' })
    expect(swapFace(0, 'xbox')).toBe(1)
    expect(buttonGlyph(0, 'xbox').label).toBe('B')
    useSettingsStore.setState({ confirmButton: 'bottom' })
    expect(swapFace(0, 'nintendo')).toBe(0)
    expect(buttonGlyph(0, 'nintendo').label).toBe('B')
  })
})
