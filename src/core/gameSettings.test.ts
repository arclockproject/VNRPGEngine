// src/content/settings.ts: the game's own settings get their defaults, keep stored values of the
// right type, and are read / changed through game.settings.
import { describe, expect, it, vi } from 'vitest'
import { mergeGameSettings } from './gameSettings'

vi.mock('@/content/settings', () => ({
  default: { bigCursor: false, hints: 'on', brightness: 0.5 },
}))

const { gameSettings } = await import('./managers/gameSettings')
const { useSettingsStore } = await import('./stores/settings')

describe('game settings', () => {
  it('starts at the defaults and stores changes', () => {
    expect(useSettingsStore.getState().game).toEqual({
      bigCursor: false,
      hints: 'on',
      brightness: 0.5,
    })
    ;(gameSettings.set as (id: string, value: unknown) => void)('hints', 'off')
    expect((gameSettings.get as (id: string) => unknown)('hints')).toBe('off')
  })

  it('keeps stored values of the right type; new settings get their default', () => {
    const defaults = { bigCursor: false, hints: 'on', brightness: 0.5, added: true }
    const stored = { bigCursor: true, hints: 3, removed: 'x', brightness: 0.8 }
    expect(mergeGameSettings(defaults, stored)).toEqual({
      bigCursor: true,
      hints: 'on',
      brightness: 0.8,
      added: true,
    })
    expect(mergeGameSettings(defaults, 'not an object')).toEqual(defaults)
  })
})
