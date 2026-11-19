// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Fake game pieces, so this tests the save manager only.
const go = vi.fn(async (_id: string, _options?: object) => {})
let changeListener: (() => void) | undefined
const snapshot = { id: 'town', params: undefined, x: 3.5, y: 4.25, facing: 'left' as const }
// The normal game (maps): these tests check its newGame, whatever src/content/config/mode.ts says.
vi.mock('@/content/config/mode', () => ({ default: { vnOnly: false } }))
vi.mock('../managers/maps', () => ({
  maps: {
    go: (id: string, options?: object) => go(id, options),
    snapshot: () => snapshot,
    onChange: (listener: () => void) => {
      changeListener = listener
      return () => {}
    },
  },
}))
const exported: { name: string; text: string }[] = []
vi.mock('../platform', () => ({
  onBeforeClose: () => {},
  saveTextFile: async (name: string, text: string) => {
    exported.push({ name, text })
    return true
  },
}))
vi.mock('../gameRef', () => ({ getGame: () => ({ maps: { go } }) }))
vi.mock('@/content/save/data', () => ({
  initialData: () => ({ stats: { health: 100, hunger: 0 }, flags: {} }),
}))
vi.mock('@/content/save', () => ({
  default: {
    initial: () => ({ stats: { health: 100, hunger: 0 }, flags: {} }),
    newGame: (game: { maps: { go: typeof go } }) => game.maps.go('start_map'),
    beforeLoad: (save: { data: { flags: Record<string, unknown> } }) => {
      save.data.flags.checked = true
      return save
    },
    slots: 30,
    autosave: { mapChange: true, eventEnd: true, windowsClosed: true },
  },
}))
vi.mock('@/generated/registry.gen', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  saveMigrations: {
    3: ({
      engine,
      data,
    }: {
      engine: unknown
      data: { stats: { hp: number; hunger: number } }
    }) => ({
      engine,
      data: { ...data, stats: { health: data.stats.hp } },
    }),
    4: ({ engine, data }: { engine: unknown; data: { stats: object } }) => ({
      engine,
      data: { ...data, stats: { ...data.stats, hunger: 0 } },
    }),
  },
}))

const { save, SAVE_VERSION } = await import('./manager')
const { useGameStore } = await import('../stores/game')
const { useSystemStore } = await import('../stores/system')
const { usePersistentStore } = await import('../stores/persistent')
const systemInitial = useSystemStore.getState()

const onMap = () =>
  useSystemStore.setState((s) => {
    s.map = { id: 'town' as never, params: undefined, spawn: 'start' }
  })

beforeEach(() => {
  localStorage.clear()
  go.mockClear()
  useSystemStore.setState(systemInitial, true)
  useGameStore.setState({
    data: { stats: { health: 100, hunger: 0 }, flags: {} } as never,
    playtimeMs: 0,
  })
})

describe('a full browser storage', () => {
  /** Storage too full for keys with `refused` in them. Returns the way back to normal. */
  const fillFor = (refused: string) => {
    const real = localStorage
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => real.getItem(key),
      setItem: (key: string, value: string) => {
        if (key.includes(refused)) throw new Error('quota')
        real.setItem(key, value)
      },
      removeItem: (key: string) => real.removeItem(key),
      key: (index: number) => real.key(index),
      clear: () => real.clear(),
      get length() {
        return real.length
      },
    })
    return { mockRestore: () => vi.unstubAllGlobals() }
  }

  it('puts every slot back when a backup does not fit', async () => {
    onMap()
    save.save('slot1')
    save.save('slot2')
    await save.exportBackup()
    const backup = (exported.at(-1) as { text: string }).text
    save.delete('slot2')
    save.save('slot5')
    const slot5 = localStorage.getItem('INSERTGAMENAMEHERE:save:slot5')
    const plan = save.readBackup(backup)
    const full = fillFor('save:slot2') // slot1 is written, slot2 no longer fits
    expect(() => save.applyBackup(plan)).toThrow(/storage is full/)
    full.mockRestore()
    expect(save.list().map((s) => s.slot)).toEqual(['slot1', 'slot5'])
    expect(localStorage.getItem('INSERTGAMENAMEHERE:save:slot5')).toBe(slot5)
  })
})

describe('where saves are kept', () => {
  it('reports the browser, and shows a notice only once', () => {
    expect(save.storage()).toEqual({ kind: 'browser', failing: false, limited: false })
    expect(save.noticeSeen('web-slots')).toBe(false)
    expect(save.noticeSeen('web-slots')).toBe(true)
  })
})

describe('a note and a lock on a save', () => {
  it('are kept in the save, shown in its info, and a locked save is never overwritten or deleted', () => {
    onMap()
    expect(save.save('slot1')).toBe(true)
    expect(save.setNote('slot1', '  Before the festival  ')).toBe(true)
    expect(save.setLocked('slot1', true)).toBe(true)
    const info = () =>
      save.list().find((s) => s.slot === 'slot1') as { note: string | null; locked: boolean }
    expect(info()).toMatchObject({ note: 'Before the festival', locked: true })
    const before = localStorage.getItem('INSERTGAMENAMEHERE:save:slot1')
    expect(save.save('slot1')).toBe(false)
    expect(save.delete('slot1')).toBe(false)
    expect(localStorage.getItem('INSERTGAMENAMEHERE:save:slot1')).toBe(before)
    // Unlocked: it can be overwritten again, and a new save starts without a note.
    expect(save.setLocked('slot1', false)).toBe(true)
    expect(save.save('slot1')).toBe(true)
    expect(info()).toMatchObject({ note: null, locked: false })
    expect(save.setNote('slot1', 'x'.repeat(100))).toBe(true)
    expect(info()?.note).toHaveLength(40)
    expect(save.setNote('slot1', '')).toBe(true)
    expect(info()?.note).toBeNull()
    expect(save.setNote('slot9', 'nothing there')).toBe(false)
  })
})

describe('backups', () => {
  it('exports every slot plus persistent data, and restores exactly that on another device', async () => {
    onMap()
    save.save('slot1')
    save.save('slot2')
    usePersistentStore.setState({
      read: { a: true },
      unlocked: {},
      achievements: { win: '2026-05-01T00:00:00.000Z' },
    })
    expect(await save.exportBackup()).toBe(true)
    const backup = exported.at(-1) as { name: string; text: string }
    expect(backup.name).toMatch(/^INSERTGAMENAMEHERE-backup-\d{4}-\d\d-\d\d\.json$/)
    expect(save.fileKind(backup.text)).toBe('backup')

    // "Another device": slot1 taken, other progress, an earlier date for the same achievement.
    localStorage.clear()
    useGameStore.setState((g) => {
      ;(g.data as { flags: Record<string, boolean> }).flags.otherDevice = true
    })
    save.save('slot1')
    const mine = localStorage.getItem('INSERTGAMENAMEHERE:save:slot1')
    usePersistentStore.setState({
      read: { b: true },
      unlocked: { pic: true },
      achievements: { win: '2026-06-01T00:00:00.000Z' },
    })
    save.save('slot3')
    const plan = save.readBackup(backup.text)
    expect(plan.slots.map((s) => s.slot)).toEqual(['slot1', 'slot2'])
    expect(plan.existing).toEqual(['slot1', 'slot3'])

    // Exactly the backup: slot3 (not in it) is emptied, progress from this device is gone.
    expect(save.applyBackup(plan)).toEqual(['slot1', 'slot2'])
    expect(localStorage.getItem('INSERTGAMENAMEHERE:save:slot1')).not.toBe(mine)
    expect(localStorage.getItem('INSERTGAMENAMEHERE:save:slot3')).toBeNull()
    expect(usePersistentStore.getState()).toEqual({
      read: { a: true },
      unlocked: {},
      achievements: { win: '2026-05-01T00:00:00.000Z' },
      // The game's own part (src/content/save/persistent.ts) at its starting values.
      game: {},
    })
    // Written at once, with its version.
    expect(JSON.parse(localStorage.getItem('INSERTGAMENAMEHERE:persistent') ?? '{}')).toEqual({
      version: 1,
      read: { a: true },
      unlocked: {},
      achievements: { win: '2026-05-01T00:00:00.000Z' },
      game: {},
    })
  })

  it('upgrades old saves inside a backup, and refuses the whole backup if one is unusable', () => {
    const old = {
      format: 'INSERTGAMENAMEHERE-save',
      version: 2,
      savedAt: '2026-01-01T00:00:00.000Z',
      engine: { map: null, playtimeMs: 0 },
      data: { stats: { hp: 42, hunger: 9 }, flags: {} },
    }
    const backup = (saves: object) =>
      JSON.stringify({
        format: 'INSERTGAMENAMEHERE-backup',
        version: 1,
        savedAt: '2026-01-01T00:00:00.000Z',
        saves,
        persistent: { read: { x: true, bad: 'yes' } },
      })
    const plan = save.readBackup(backup({ slot3: old }))
    expect(plan.slots[0]).toMatchObject({ slot: 'slot3', version: SAVE_VERSION })
    expect(plan.persistent.read).toEqual({ x: true }) // the broken entry is dropped

    expect(() => save.readBackup(backup({ slot1: old, slot2: { ...old, version: 99 } }))).toThrow(
      /slot2: .*newer version/,
    )
    expect(() =>
      save.readBackup(JSON.stringify({ ...JSON.parse(backup({})), version: 9 })),
    ).toThrow(/newer version/)
    expect(() => save.readBackup('{"format":"INSERTGAMENAMEHERE-save"}')).toThrow(/not a backup/)
  })
})

describe('save manager', () => {
  it('only saves while walking around a map', () => {
    expect(save.save('slot1')).toBe(false) // no map yet
    onMap()
    useSystemStore.setState((s) => {
      s.event = { id: 'x' as never, stack: [] }
    })
    expect(save.save('slot1')).toBe(false) // during an event
    useSystemStore.setState((s) => {
      s.event = null
    })
    expect(save.save('slot1')).toBe(true)
  })

  it('lists slots and finds the latest', async () => {
    onMap()
    save.save('slot1')
    await new Promise((r) => setTimeout(r, 5))
    save.save('slot3')
    expect(save.list().map((s) => s.slot)).toEqual(['slot1', 'slot3'])
    expect(save.latest()?.slot).toBe('slot3')
    expect(save.latest()).toMatchObject({ version: SAVE_VERSION, mapId: 'town' })
    // Every save records the game version (package.json) that wrote it.
    expect(save.latest()?.gameVersion).toMatch(/^\d+\.\d+\.\d+/)
  })

  it('loads an old (v2) save through the migrations and beforeLoad, at the exact position', async () => {
    const old = {
      format: 'INSERTGAMENAMEHERE-save',
      version: 2,
      savedAt: '2026-01-01T00:00:00.000Z',
      engine: {
        map: { id: 'forest', params: undefined, x: 7.25, y: 2.5, facing: 'up' },
        playtimeMs: 60000,
      },
      data: { stats: { hp: 42, hunger: 9 }, flags: {} },
    }
    localStorage.setItem('INSERTGAMENAMEHERE:save:slot2', JSON.stringify(old))
    await save.load('slot2')
    expect(useGameStore.getState().data).toEqual({
      stats: { health: 42, hunger: 0 },
      flags: { checked: true },
    })
    expect(useGameStore.getState().playtimeMs).toBe(60000)
    expect(go).toHaveBeenCalledWith('forest', {
      params: undefined,
      position: { x: 7.25, y: 2.5, facing: 'up' },
      transition: 'fade',
    })
  })

  it('autosaves after a map change', () => {
    save.start()
    onMap()
    changeListener?.()
    expect(save.list().map((s) => s.slot)).toEqual(['auto'])
  })

  it('autosaves when a scene ends and when the last window closes', async () => {
    vi.useFakeTimers()
    try {
      save.start()
      onMap()
      useSystemStore.setState((s) => {
        s.event = { id: 'intro' as never, stack: ['intro' as never] }
      })
      await vi.advanceTimersByTimeAsync(1)
      expect(save.list()).toEqual([]) // nothing ended yet
      useSystemStore.setState((s) => {
        s.event = null
      })
      await vi.advanceTimersByTimeAsync(1)
      expect(save.list().map((s) => s.slot)).toEqual(['auto'])

      save.delete('auto')
      useSystemStore.setState((s) => {
        s.windows = [{ id: 'shop' as never, params: undefined }]
      })
      useSystemStore.setState((s) => {
        s.windows = []
      })
      await vi.advanceTimersByTimeAsync(1)
      expect(save.list().map((s) => s.slot)).toEqual(['auto'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not autosave while a save is loading', async () => {
    save.start()
    onMap()
    save.save('slot1')
    // The map change of the load itself must not write the autosave.
    go.mockImplementationOnce(async () => changeListener?.())
    await save.load('slot1')
    expect(save.list().map((s) => s.slot)).toEqual(['slot1'])
  })

  it('quick save writes its own slot; quick load asks first', async () => {
    const { dialog } = await import('../managers/dialog')
    expect(save.hasQuickSave()).toBe(false)
    expect(await save.quickLoad()).toBe(false) // nothing to load yet
    expect(save.quickSave()).toBe(false) // not on a map
    onMap()
    expect(save.quickSave()).toBe(true)
    expect(save.hasQuickSave()).toBe(true)
    expect(save.list(['quick']).map((s) => s.slot)).toEqual(['quick'])
    const ask = vi.spyOn(dialog, 'ask').mockResolvedValue('cancel' as never)
    expect(await save.quickLoad()).toBe(false)
    expect(ask).toHaveBeenCalledTimes(1)
    ask.mockRestore()
  })

  it('has as many manual slots as the game asks for', () => {
    expect(save.manualSlots).toHaveLength(30)
    expect(save.slots.slice(0, 3)).toEqual(['auto', 'quick', 'slot1'])
    onMap()
    expect(save.save('slot30')).toBe(true)
    expect(save.list(['slot30', 'slot2']).map((s) => s.slot)).toEqual(['slot30'])
  })

  it('single saves are not imported: only backups; an old "import" slot is ignored', async () => {
    onMap()
    save.save('slot1')
    const single = localStorage.getItem('INSERTGAMENAMEHERE:save:slot1') as string
    expect(save.fileKind(single)).toBe('save') // the Saves window refuses these
    await save.exportBackup()
    // A backup made while the "Imported" box existed: its save there is left out.
    const old = JSON.parse((exported.at(-1) as { text: string }).text)
    old.saves.import = old.saves.slot1
    const plan = save.readBackup(JSON.stringify(old))
    expect(plan.slots.map((s) => s.slot)).toEqual(['slot1'])
    // A leftover save of that box is emptied at start.
    localStorage.setItem('INSERTGAMENAMEHERE:save:import', single)
    save.start()
    expect(localStorage.getItem('INSERTGAMENAMEHERE:save:import')).toBeNull()
  })

  it('new game resets the data and runs newGame', async () => {
    useGameStore.setState((s) => {
      s.data.stats.health = 5
      s.playtimeMs = 999
    })
    await save.newGame()
    expect(useGameStore.getState().data.stats.health).toBe(100)
    expect(useGameStore.getState().playtimeMs).toBe(0)
    expect(go).toHaveBeenCalledWith('start_map')
  })
})
