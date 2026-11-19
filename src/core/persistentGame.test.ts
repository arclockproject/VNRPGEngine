// src/content/save/persistent.ts: the game's own cross-save data starts at its values, survives a
// backup restore and a reset, and drops values of the wrong kind.
import { describe, expect, it, vi } from 'vitest'
import { mergePersistentGame } from './persistentGame'

vi.mock('@/content/save/persistent', () => ({
  default: { clearedOnce: false, endingsSeen: 0, seen: [] as string[] },
}))

const { persistentGame } = await import('./managers/persistentGame')
const store = await import('./stores/persistent')

const set = persistentGame.set as (id: string, value: unknown) => void
const get = persistentGame.get as (id: string) => unknown

describe('game persistent data', () => {
  it('starts at its values, changes, and is reset with the rest', () => {
    expect(store.usePersistentStore.getState().game).toEqual({
      clearedOnce: false,
      endingsSeen: 0,
      seen: [],
    })
    set('clearedOnce', true)
    expect(get('clearedOnce')).toBe(true)
    store.resetPersistent()
    expect(get('clearedOnce')).toBe(false)
  })

  it('a restored backup without the game part gets the starting values', () => {
    set('endingsSeen', 3)
    store.replacePersistent({ read: {}, unlocked: {}, achievements: {} } as never)
    expect(get('endingsSeen')).toBe(0)
    store.replacePersistent({
      read: {},
      unlocked: {},
      achievements: {},
      game: { endingsSeen: 2, clearedOnce: 'yes' },
    } as never)
    expect(get('endingsSeen')).toBe(2)
    expect(get('clearedOnce')).toBe(false)
  })

  it('keeps stored values of the same kind only', () => {
    const defaults = { a: 0, list: [] as number[], note: null as string | null, gone: true }
    expect(mergePersistentGame(defaults, { a: 5, list: 'x', note: 'hi', extra: 1 })).toEqual({
      a: 5,
      list: [],
      note: 'hi',
      gone: true,
    })
  })
})
