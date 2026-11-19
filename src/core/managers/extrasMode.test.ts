// Visual novel mode (content/config/mode.ts vnOnly): achievements are left out of Extras (no tab), so
// they neither make Extras appear in the title menu nor count towards "Found N%".
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mode = vi.hoisted(() => ({ vnOnly: false }))
vi.mock('@/content/config/mode', () => ({ default: mode }))
vi.mock('../registry', () => ({
  audioFiles: {},
  characters: {},
  gallery: {},
  endings: {},
  movies: {},
  registry: { endings: [], achievements: ['first'], gallery: [], movies: [], events: [] },
}))
vi.mock('../gameRef', () => ({ getGame: () => ({ save: { unlockNewGamePlus: vi.fn() } }) }))

const { extras } = await import('./extras')
const { resetPersistent, usePersistentStore } = await import('../stores/persistent')

const earnAchievement = () =>
  usePersistentStore.setState((s) => ({ achievements: { ...s.achievements, first: 'now' } }))

beforeEach(() => resetPersistent())

describe('achievements and visual novel mode', () => {
  it('normal game: an achievement shows Extras and counts towards completion', () => {
    mode.vnOnly = false
    earnAchievement()
    expect(extras.anyUnlocked()).toBe(true)
    expect(extras.completion().parts.achievements).toEqual({ found: 1, total: 1 })
  })

  it('visual novel mode: achievements neither show Extras nor count', () => {
    mode.vnOnly = true
    earnAchievement()
    expect(extras.anyUnlocked()).toBe(false)
    expect(extras.completion().parts.achievements).toBeUndefined()
  })
})
