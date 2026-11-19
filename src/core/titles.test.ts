import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetPersistent, setPersistentFrozen, usePersistentStore } from './stores/persistent'
import {
  allTitles,
  currentTitle,
  isTitleUnlocked,
  lockTitle,
  prepareTitle,
  readyTitle,
  releaseTitles,
  selectTitle,
  stepTitle,
  unlockedTitles,
  unlockTitle,
} from './titles'

// Uses the real content: titles/default (unlocked from the start) and titles/starlit.
beforeEach(() => resetPersistent())

describe('title screen variants', () => {
  it('starts with the ones marked unlocked, in switcher order', () => {
    expect(allTitles()).toEqual(['default', 'starlit'])
    expect(unlockedTitles()).toEqual(['default'])
    expect(currentTitle()).toBe('default')
  })

  it('a new unlock is kept across saves and becomes the current one', () => {
    unlockTitle('starlit')
    expect(isTitleUnlocked('starlit')).toBe(true)
    expect(usePersistentStore.getState().unlocked['title:starlit']).toBe(true)
    expect(currentTitle()).toBe('starlit')
  })

  it("unlocking again keeps the player's own pick", () => {
    unlockTitle('starlit')
    selectTitle('default')
    unlockTitle('starlit') // the ending is reached a second time
    expect(currentTitle()).toBe('default')
  })

  it('switches through unlocked ones only, wrapping around', () => {
    stepTitle(1) // only one unlocked: nothing to switch to
    expect(currentTitle()).toBe('default')
    selectTitle('starlit') // locked: ignored
    expect(currentTitle()).toBe('default')
    unlockTitle('starlit')
    stepTitle(1)
    expect(currentTitle()).toBe('default')
    stepTitle(-1)
    expect(currentTitle()).toBe('starlit')
  })

  it('locking (dev) falls back to the newest unlocked one', () => {
    unlockTitle('starlit')
    lockTitle('starlit')
    expect(currentTitle()).toBe('default')
    lockTitle('default') // `unlocked: true` in its file: stays
    expect(isTitleUnlocked('default')).toBe(true)
  })

  it('is not unlocked by watching a locked scene from Extras (frozen)', () => {
    setPersistentFrozen(true)
    unlockTitle('starlit')
    setPersistentFrozen(false)
    expect(isTitleUnlocked('starlit')).toBe(false)
    expect(currentTitle()).toBe('default')
  })

  it('warns about unknown ids instead of saving them', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    unlockTitle('nope' as never)
    expect(warn).toHaveBeenCalled()
    expect(usePersistentStore.getState().unlocked).toEqual({})
    warn.mockRestore()
  })

  it('loads the screen and its files once, then draws it at once', async () => {
    const Screen = await prepareTitle('starlit')
    expect(typeof Screen).toBe('function')
    expect(prepareTitle('starlit')).toBe(prepareTitle('starlit'))
    expect(readyTitle('starlit')).toBe(Screen)
    releaseTitles()
    expect(readyTitle('starlit')).toBeUndefined()
  })
})
