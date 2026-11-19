// unlockable(): the one unlock-once flow of achievements, codex, endings and title screens.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetPersistent, setPersistentFrozen } from './stores/persistent'
import { toast as showToast, useToastStore } from './ui/toast'
import { persistentFlags, type UnlockableConfig, unlockable, unlockKey } from './unlocks'

const make = (extra: Partial<UnlockableConfig<string>> = {}) =>
  unlockable<string>({
    name: 'thing',
    exists: (id) => id !== 'nope',
    store: persistentFlags(unlockKey.ending),
    toast: (id) => ({ text: `Got ${id}` }),
    ...extra,
  })
const toasts = () => useToastStore.getState().toasts.map((t) => t.text)

beforeEach(() => {
  resetPersistent()
  setPersistentFrozen(false)
  useToastStore.setState({ toasts: [] })
})

describe('unlockable', () => {
  it('unlocks once: true the first time, one toast', () => {
    const things = make()
    expect(things.unlock('a')).toBe(true)
    expect(things.unlock('a')).toBe(false)
    expect(things.has('a')).toBe(true)
    expect(toasts()).toEqual(['Got a'])
  })

  it('passes the kind and params from config.toast; a plain toast is a message', () => {
    make({
      toast: (id) => ({ text: id, kind: 'ending', params: { ending: id as never } }),
    }).unlock('b')
    showToast('hi')
    expect(useToastStore.getState().toasts.map(({ kind, params }) => ({ kind, params }))).toEqual([
      { kind: 'ending', params: { ending: 'b' } },
      { kind: 'message', params: {} },
    ])
  })

  it('an unknown id warns and unlocks nothing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const things = make()
    expect(things.unlock('nope')).toBe(false)
    expect(things.has('nope')).toBe(false)
    expect(warn).toHaveBeenCalledWith('[unlock] unknown thing "nope"')
    warn.mockRestore()
  })

  it('notify: false unlocks without a toast', () => {
    expect(make().unlock('a', { notify: false })).toBe(true)
    expect(toasts()).toEqual([])
  })

  it('nothing is earned while persistent data is frozen, unless it is kept per save', () => {
    setPersistentFrozen(true)
    expect(make().unlock('a')).toBe(false)
    expect(toasts()).toEqual([])
    const saved = new Set<string>()
    const perSave = make({
      perSave: true,
      store: {
        has: (id) => saved.has(id),
        add: (id) => saved.add(id),
        remove: (id) => saved.delete(id),
      },
    })
    expect(perSave.unlock('a')).toBe(true)
  })

  it('lock takes it back', () => {
    const things = make()
    things.unlock('a')
    things.lock('a')
    expect(things.has('a')).toBe(false)
    expect(things.unlock('a')).toBe(true)
  })
})
