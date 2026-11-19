// @vitest-environment happy-dom
// VN mode routes: playing, branching, changing routes, ending, and saves made inside a route.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const toTitle = vi.fn(async () => {})
vi.mock('@/content/config/mode', () => ({ default: { vnOnly: true } }))
vi.mock('@/content/flags', () => ({ default: { agreed: false, met_anna: false, points: 0 } }))
vi.mock('../managers/maps', () => ({
  maps: {
    go: async () => {},
    snapshot: () => null,
    onChange: () => () => {},
    unload: async () => {},
  },
}))
vi.mock('../platform', () => ({ onBeforeClose: () => {}, saveTextFile: async () => true }))
const gameStub: Record<string, unknown> = { session: { toTitle } }
vi.mock('../gameRef', () => ({ getGame: () => gameStub }))
vi.mock('@/content/save/data', () => ({ initialData: () => ({ flags: {} }) }))
vi.mock('@/content/save', () => ({
  default: {
    initial: () => ({ flags: {} }),
    newGame: () => {
      throw new Error('VN mode must not run the map newGame')
    },
    slots: 5,
    autosave: { mapChange: false, eventEnd: false, windowsClosed: false },
  },
}))

type Ctx = { say: (who: string, text: string) => Promise<void> }
const said = (text: string) => async (ctx: Ctx) => ctx.say('anna', text)
const givePoints = (n: number) => () => flags.set('points' as never, (points() + n) as never)
const scripts: Record<
  string,
  { title: string; run: (ctx: never) => unknown; leaves?: { run: () => void } }
> = {
  // Gives 2 points; what a .vn script would work out by itself says the same (or, wrong, 5).
  'x/gift': {
    title: 'Gift',
    run: async (ctx: Ctx) => {
      givePoints(2)()
      await ctx.say('anna', 'gift')
    },
    leaves: { run: givePoints(2) },
  },
  // Sets a stage and leaves it there; the next event says something on it.
  'x/set_stage': {
    title: 'Stage',
    run: async (ctx: Ctx & { background: (v: string) => void; show: (who: string) => void }) => {
      ctx.background('#123456')
      ctx.show('anna')
      await ctx.say('anna', 'staged')
    },
  },
  'x/gift_wrong': {
    title: 'Gift',
    run: async (ctx: Ctx) => {
      givePoints(2)()
      await ctx.say('anna', 'gift')
    },
    leaves: { run: givePoints(5) },
  },
  'x/one': { title: 'One', run: said('one') },
  'x/choice': {
    title: 'Choice',
    run: async (ctx: Ctx) => {
      await ctx.say('anna', 'choose')
      flags.set('agreed' as never, true as never)
      await ctx.say('anna', 'agreed')
    },
  },
  'x/yes': { title: 'Yes', run: said('yes') },
  'x/no': { title: 'No', run: said('no') },
  'x/anna': { title: 'Anna', run: said('anna route') },
  'extras/choice': {
    title: 'Choice',
    run: async (ctx: {
      choice: (o: Record<string, string>) => Promise<string>
      params: { options: Record<string, string>; onPick: (k: string) => void }
    }) => ctx.params.onPick(await ctx.choice(ctx.params.options)),
  },
}
type R = {
  event: (id: string, key: string) => Promise<void>
  flag: (id: string) => boolean
  startRoute: (id: string) => unknown
  choice: (options: Record<string, string>, ask?: object) => Promise<string>
  chapter: (id: string) => void
  ending: (id: string) => unknown
}
const routeDefs: Record<
  string,
  {
    title: string
    run: (ctx: R) => unknown
    afterStory?: { requiresEnding: string[]; order?: number }
  }
> = {
  common: {
    title: 'Common',
    run: async ({ event, flag, startRoute }) => {
      await event('x/one', 'one')
      await event('x/choice', 'choice')
      if (flag('agreed')) await event('x/yes', 'yes')
      else await event('x/no', 'no')
      if (flag('agreed')) return startRoute('anna')
    },
  },
  anna: { title: 'Anna', run: async ({ event }) => event('x/anna', 'start') },
  secret: {
    title: 'Secret',
    run: async ({ event, choice, ending }) => {
      await event('x/one', 'one')
      const p = await choice(
        { a: 'Go A', s: 'Secret' },
        { hidden: { s: { requiresEnding: ['anna', 'other'] } } },
      )
      if (p === 's') {
        await event('x/yes', 'yes')
        return ending('secret_end')
      }
      await event('x/no', 'no')
    },
  },
  chaptered: {
    title: 'Chaptered',
    run: async ({ event, chapter }) => {
      chapter('first')
      await event('x/one', 'one')
      chapter('second')
      await event('x/yes', 'yes')
    },
  },
  staged: {
    title: 'Staged',
    run: async ({ event }) => {
      await event('x/set_stage', 'set')
      await event('x/yes', 'yes')
      await event('x/no', 'no')
    },
  },
  gifted: {
    title: 'Gifted',
    run: async ({ event }) => {
      await event('x/one', 'one')
      await event('x/gift', 'gift')
      await event('x/gift_wrong', 'wrong')
      await event('x/yes', 'yes')
    },
  },
  // A choice whose option does something by itself (points for picking it).
  pointed: {
    title: 'Pointed',
    run: async ({ event, choice }) => {
      await event('x/one', 'one')
      const p = await choice(
        { a: 'Go A', b: 'Go B' },
        { effects: { a: () => flags.set('points' as never, (points() + 1) as never) } },
      )
      if (p === 'a') await event('x/yes', 'yes')
      else await event('x/no', 'no')
    },
  },
  // After stories: opened by endings, started from the title screen; after_a moves on to anna_more.
  after_a: {
    title: 'After A',
    afterStory: { requiresEnding: ['anna'] },
    run: async ({ event, startRoute }) => {
      await event('x/yes', 'yes')
      return startRoute('anna_more')
    },
  },
  after_b: {
    title: 'After B',
    afterStory: { requiresEnding: ['anna', 'other'], order: 0 },
    run: async ({ event }) => event('x/no', 'no'),
  },
  anna_more: { title: 'More', run: async ({ event }) => event('x/anna', 'more') },
  chooser: {
    title: 'Chooser',
    run: async ({ event, choice }) => {
      await event('x/one', 'one')
      if ((await choice({ a: 'Go A', b: 'Go B' })) === 'a') await event('x/yes', 'yes')
      else await event('x/no', 'no')
    },
  },
}
const before = vi.fn()
const flowDefs: Record<string, { route: string; nodes: Record<string, object> }> = {
  common: {
    route: 'common',
    nodes: {
      one: { sets: () => flags.set('met_anna' as never, true as never) },
      yes: { before },
    },
  },
}
vi.mock('../registry', async (importOriginal) => {
  const original = await importOriginal<{ registry: object }>()
  return {
    ...original,
    registry: { ...original.registry, routes: ['common', 'anna'] },
    loadEvent: async (id: string) => scripts[id],
    loadedEntry: (_kind: string, id: string) => scripts[id],
    loadRoute: async (id: string) => routeDefs[id],
    loadFlow: async (id: string) => flowDefs[id] ?? null,
    characters: { anna: { name: 'Anna' } },
  }
})

const { save } = await import('../save/manager')
const { events } = await import('./events')
const { flags } = await import('./flags')
const { routes } = await import('./routes')
const { advance } = await import('../scene/director')
const { resetReplay } = await import('../scene/replay')
const { useGameStore } = await import('../stores/game')
const { useSystemStore } = await import('../stores/system')
const { usePersistentStore } = await import('../stores/persistent')
gameStub.save = save
/** Endings reached (game.extras stub). */
const endingsReached = new Set<string>()
gameStub.extras = {
  endingReached: (id: string) => endingsReached.has(id),
  reachEnding: (id: string) => endingsReached.add(id),
}
const { isFastForward } = await import('../scene/replay')
/** chapter() calls, and whether each was quiet (replayed: no toast). */
const reached: [string, boolean][] = []
gameStub.chapters = { reach: (id: string) => reached.push([id, isFastForward()]) }
const systemInitial = useSystemStore.getState()
const flush = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0))
}
const line = () => useSystemStore.getState().scene.line?.text
function points(): number {
  return (flags.get('points' as never) as number | undefined) ?? 0
}
const next = async () => {
  advance()
  await flush()
}

beforeEach(() => {
  localStorage.clear()
  routes.stop()
  events.abort()
  resetReplay()
  toTitle.mockClear()
  before.mockClear()
  useSystemStore.setState(systemInitial, true)
  useSystemStore.setState((s) => {
    s.title = null
  })
  useGameStore.setState({ data: { flags: {} } as never, playtimeMs: 0, route: null })
  usePersistentStore.setState({ routes: { seen: {}, picked: {} } })
})

describe('routes in VN mode', () => {
  it('plays the events in order, branches on the live flags, and moves to the next route', async () => {
    await routes.start('common' as never)
    await flush()
    expect(line()).toBe('one')
    await next()
    expect(line()).toBe('choose')
    await next()
    expect(line()).toBe('agreed')
    await next()
    expect(line()).toBe('yes')
    expect(useGameStore.getState().route).toMatchObject({
      id: 'common',
      answers: [true],
      visited: ['one', 'choice', 'yes'],
      done: false,
    })
    await next()
    expect(line()).toBe('anna route')
    expect(useGameStore.getState().route).toMatchObject({ id: 'anna', from: ['common'] })
    const seen = Object.keys(usePersistentStore.getState().routes?.seen ?? {})
    expect(seen).toEqual(
      expect.arrayContaining(['common/one', 'common/choice', 'common/yes', 'common/@route:anna']),
    )
    expect(seen).not.toContain('common/no')
  })

  it('goes back to the title when a route ends without starting another', async () => {
    await routes.start('common' as never)
    await flush()
    await next() // one -> choice
    // The player does not agree: the flag is set back while "agreed" shows.
    await next()
    flags.set('agreed' as never, false as never)
    await next()
    expect(line()).toBe('no')
    await next()
    expect(toTitle).toHaveBeenCalledOnce()
    expect(useGameStore.getState().route).toBeNull()
  })

  it('a mid-scene save in a route loads at the same line and keeps the same way', async () => {
    await routes.start('common' as never)
    await flush()
    await next()
    await next()
    await next()
    expect(line()).toBe('yes')
    expect(save.save('slot1')).toBe(true)

    // Later the flag changes; the save must still be on the "yes" way.
    routes.stop()
    events.abort()
    flags.set('agreed' as never, false as never)
    await save.load('slot1')
    await flush()
    expect(line()).toBe('yes')
    expect(useGameStore.getState().route?.visited).toEqual(['one', 'choice', 'yes'])
    await next()
    expect(line()).toBe('anna route')
  })

  it('a save made between two boxes carries on after the box that ended', async () => {
    await routes.resume(
      { id: 'common', from: [], answers: [true], visited: ['one', 'choice', 'yes'], done: true },
      null,
    )
    await flush()
    // The second flag() is asked live: agreed is false in this game, so the route ends.
    expect(toTitle).toHaveBeenCalledOnce()
    expect(line()).toBeUndefined()
  })

  it('a new game starts the common route, not the map newGame', async () => {
    await save.newGame()
    await flush()
    expect(line()).toBe('one')
    expect(routes.current()).toEqual({ route: 'common', key: 'one' })
  })

  it('a save is refused only where it would be anyway (no map is needed in a route)', async () => {
    await routes.start('common' as never)
    await flush()
    expect(save.whyCantSave()).toBeNull()
  })
})

describe('hidden choice options and ending()', () => {
  beforeEach(() => endingsReached.clear())
  const choices = () => useSystemStore.getState().scene.choices?.map((c) => c.label)
  it('a hidden option that cannot show leaves one option: it plays without asking', async () => {
    void routes.start('secret' as never)
    await flush()
    await next()
    expect(line()).toBe('no')
    expect(useGameStore.getState().route?.answers).toEqual(['a'])
    // It counts as the player's pick (solid line on the flowchart).
    const seen = Object.keys(usePersistentStore.getState().routes?.seen ?? {})
    expect(seen).toContain('secret/?a_s=a')
    // Ended without ending(): no ending reached.
    await next()
    await flush()
    expect([...endingsReached]).toEqual([])
    expect(toTitle).toHaveBeenCalled()
  })

  it('only one of its endings reached: the option stays hidden', async () => {
    endingsReached.add('anna')
    void routes.start('secret' as never)
    await flush()
    await next()
    expect(line()).toBe('no')
  })

  it('once every ending it needs is reached the option shows; ending() reaches its ending', async () => {
    endingsReached.add('anna')
    endingsReached.add('other')
    const { pick } = await import('../scene/director')
    void routes.start('secret' as never)
    await flush()
    await next()
    expect(choices()).toEqual(['Go A', 'Secret'])
    pick(1)
    await flush()
    expect(line()).toBe('yes')
    expect(endingsReached.has('secret_end')).toBe(false)
    await next()
    await flush()
    expect(endingsReached.has('secret_end')).toBe(true)
    expect(toTitle).toHaveBeenCalled()
  })
})

describe('chapters in a route', () => {
  it('chapter() reaches the chapter live; skipping to a box sets the ones on the way quietly', async () => {
    reached.length = 0
    void routes.start('chaptered' as never)
    await flush()
    expect(reached).toEqual([['first', false]])
    await next()
    expect(reached).toEqual([
      ['first', false],
      ['second', false],
    ])
    routes.stop()
    events.abort()
    reached.length = 0
    // Skipping to a box (what saves and flowchart jumps do): the chapters on the way, quietly.
    void routes.start('chaptered' as never, { target: 'yes', jump: true })
    await flush()
    expect(line()).toBe('yes')
    expect(reached).toEqual([
      ['first', true],
      ['second', true],
    ])
  })
})

describe('the stage carries over between the events of a route', () => {
  const stage = () => {
    const s = useSystemStore.getState().scene
    return { background: s.background, actors: s.actors.map((a) => a.id) }
  }

  it('the next event starts on the stage the last one left, also after a save is loaded', async () => {
    void routes.start('staged' as never)
    await flush()
    expect(line()).toBe('staged')
    await next()
    expect(line()).toBe('yes')
    expect(stage()).toEqual({ background: '#123456', actors: ['anna'] })
    // A mid-scene save in the second event keeps the stage it started on.
    expect(save.save('slot1')).toBe(true)
    expect(save.snapshot().engine.stage).toMatchObject({ background: '#123456' })
    routes.stop()
    events.abort()
    useSystemStore.setState((s) => {
      s.scene.background = null
      s.scene.actors = []
    })
    await save.load('slot1')
    await flush()
    expect(line()).toBe('yes')
    expect(stage()).toEqual({ background: '#123456', actors: ['anna'] })
  })

  it('a flowchart jump starts on the stage the box before ended on (last time it played)', async () => {
    const { forgetGraphs } = await import('./routes')
    const common = routeDefs.common as (typeof routeDefs)[string]
    routeDefs.common = routeDefs.staged as (typeof routeDefs)[string]
    forgetGraphs()
    try {
      void routes.start('common' as never)
      await flush()
      await next() // set ends: its stage is remembered on this device
      routes.stop()
      events.abort()
      const { markSeen } = await import('../routes/progress')
      for (const key of ['yes', 'no']) markSeen('common', key)
      expect(await routes.jump('common' as never, 'no')).toBe(true)
      await flush()
      expect(line()).toBe('no')
      // 'yes' never played on this device: the stage comes from 'set', the box before it.
      expect(stage()).toEqual({ background: '#123456', actors: ['anna'] })
    } finally {
      routeDefs.common = common
      forgetGraphs()
    }
  })

  it('outside a route every event starts on an empty stage (the map game)', async () => {
    void events.start('x/set_stage' as never)
    await flush()
    await next()
    await flush()
    expect(stage()).toEqual({ background: null, actors: [] })
  })
})

describe('Back across the scenes of a route', () => {
  const choices = () => useSystemStore.getState().scene.choices?.map((c) => c.label)

  it('Back on the first line of a scene goes to the last line of the scene before', async () => {
    void routes.start('common' as never)
    await flush()
    expect(line()).toBe('one')
    await next()
    expect(line()).toBe('choose')
    expect(save.canRollback()).toBe(false) // nothing earlier in this scene
    expect(await save.rollback()).toBe(true)
    await flush()
    expect(line()).toBe('one')
    expect(useGameStore.getState().route).toMatchObject({ visited: ['one'], done: false })
    // The story goes on from there as usual.
    await next()
    expect(line()).toBe('choose')
    await next()
    expect(line()).toBe('agreed')
    // The log can jump into the scene before, too (its line "one").
    const log = useSystemStore.getState().scene.log
    const one = log.findLast((entry) => entry.text === 'one')
    expect(save.canJumpTo(one?.at)).toBe(true)
    expect(await save.rollbackTo(one?.at)).toBe(true)
    await flush()
    expect(line()).toBe('one')
    // Each line shows once in the log after going back.
    const texts = useSystemStore.getState().scene.log.map((entry) => entry.text)
    expect(texts.filter((text) => text === 'one')).toHaveLength(1)
    expect(texts).not.toContain('choose')
  })

  it('Back from the scene after a route choice asks the choice again, then the scene before', async () => {
    const { pick } = await import('../scene/director')
    void routes.start('chooser' as never)
    await flush()
    await next()
    expect(choices()).toEqual(['Go A', 'Go B'])
    pick(1)
    await flush()
    expect(line()).toBe('no')
    expect(await save.rollback()).toBe(true)
    await flush()
    expect(choices()).toEqual(['Go A', 'Go B'])
    expect(await save.rollback()).toBe(true)
    await flush()
    expect(line()).toBe('one')
  })

  it('a real load forgets the scenes before (Back stays inside the loaded scene)', async () => {
    void routes.start('common' as never)
    await flush()
    await next()
    expect(line()).toBe('choose')
    expect(save.save('slot1')).toBe(true)
    await save.load('slot1')
    await flush()
    expect(line()).toBe('choose')
    expect(await save.rollback()).toBe(false)
  })

  it('outside a route Back never leaves the running scene (the map game)', async () => {
    void events.start('x/one' as never)
    await flush()
    await next()
    void events.start('x/choice' as never)
    await flush()
    expect(line()).toBe('choose')
    expect(await save.rollback()).toBe(false)
  })
})

describe('flowchart jumps', () => {
  it('loads a box through seen boxes: sets on the way, branch flags, before, then it plays', async () => {
    const { markSeen } = await import('../routes/progress')
    for (const key of ['one', 'choice', 'no', 'yes']) markSeen('common', key)
    flags.set('agreed' as never, false as never)

    expect(await routes.jump('common' as never, 'yes')).toBe(true)
    await flush()
    expect(line()).toBe('yes')
    // one's sets ran (it did not play), the way's answer set the flag, yes's before ran.
    expect(flags.get('met_anna' as never)).toBe(true)
    expect(flags.get('agreed' as never)).toBe(true)
    expect(before).toHaveBeenCalledOnce()
    expect(events.finished('x/one' as never)).toBe(true)
    expect(useGameStore.getState().route).toMatchObject({
      id: 'common',
      answers: [true],
      visited: ['one', 'choice', 'yes'],
    })
    // The story carries on normally from there.
    await next()
    expect(line()).toBe('anna route')
  })

  it('jumps into a later route through the earlier one', async () => {
    const { markSeen } = await import('../routes/progress')
    for (const key of ['one', 'choice', 'yes', '@route:anna']) markSeen('common', key)
    markSeen('anna', 'start')
    expect(await routes.jump('anna' as never, 'start')).toBe(true)
    await flush()
    expect(line()).toBe('anna route')
    expect(flags.get('agreed' as never)).toBe(true)
    expect(useGameStore.getState().route).toMatchObject({ id: 'anna', from: ['common'] })
    expect(before).not.toHaveBeenCalled()
  })

  it('a box without flow.ts sets runs what its event works out by itself (leaves)', async () => {
    // Jumps start at the common route: play this one as the common route for the test.
    const { markSeen } = await import('../routes/progress')
    const { forgetGraphs } = await import('./routes')
    const common = routeDefs.common as (typeof routeDefs)[string]
    routeDefs.common = routeDefs.gifted as (typeof routeDefs)[string]
    forgetGraphs()
    try {
      for (const key of ['one', 'gift', 'wrong', 'yes']) markSeen('common', key)
      expect(await routes.jump('common' as never, 'yes')).toBe(true)
      await flush()
      expect(line()).toBe('yes')
      expect(points()).toBe(7) // 2 + 5: neither gift played
    } finally {
      routeDefs.common = common
      forgetGraphs()
    }
  })

  it('refuses a box that was never reached', async () => {
    expect(await routes.jump('common' as never, 'yes')).toBe(false)
  })
})

describe('DEV check of flow.ts sets', () => {
  it('warns when sets does not leave what the event left; branch flags are left out', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { forgetGraphs } = await import('./routes')
    forgetGraphs()
    await routes.start('common' as never)
    await flush()
    await next() // one ends: its sets says met_anna = true, the event changed nothing
    const messages = warn.mock.calls.map((call) => String(call[0]))
    expect(
      messages.some((m) => m.includes('"common/one"') && m.includes('data.flags.met_anna')),
    ).toBe(true)
    await next()
    await next() // choice ends: it set agreed, a flag the route branches on (no sets needed)
    expect(
      warn.mock.calls.map((call) => String(call[0])).some((m) => m.includes('common/choice')),
    ).toBe(false)
    // The real game was put back after the comparison.
    expect(flags.get('met_anna' as never)).toBe(false)
    warn.mockRestore()
  })

  it('checks what an event works out by itself too, and says when it is wrong', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await routes.start('gifted' as never)
    await flush()
    await next() // one
    await next() // gift: right
    await next() // wrong: says 5, gave 2
    const messages = warn.mock.calls.map((call) => String(call[0]))
    expect(messages.some((m) => m.includes('"gifted/gift"'))).toBe(false)
    expect(
      messages.some((m) => m.includes('"gifted/wrong"') && m.includes('works out from the event')),
    ).toBe(true)
    warn.mockRestore()
  })
})

describe('choices in a route', () => {
  it('asks over the last stage, follows the pick, and a save while it waits asks again on load', async () => {
    const { pick } = await import('../scene/director')
    await routes.start('chooser' as never)
    await flush()
    expect(line()).toBe('one')
    await next()
    const choices = () => useSystemStore.getState().scene.choices?.map((c) => c.label)
    expect(choices()).toEqual(['Go A', 'Go B'])
    expect(useGameStore.getState().route?.choosing).toBe(true)
    // Saved while the choice waits: no scene in the save.
    expect(save.save('slot1')).toBe(true)
    expect(save.snapshot().engine.event).toBeUndefined()
    pick(1)
    await flush()
    expect(line()).toBe('no')
    expect(useGameStore.getState().route?.answers).toEqual(['b'])
    // The live pick is remembered for the flowchart (solid line); the other option is not.
    const seen = usePersistentStore.getState().routes?.seen ?? {}
    expect(Object.keys(seen)).toContain('chooser/?a_b=b')
    expect(Object.keys(seen)).not.toContain('chooser/?a_b=a')

    routes.stop()
    events.abort()
    await save.load('slot1')
    await flush()
    expect(choices()).toEqual(['Go A', 'Go B'])
    pick(0)
    await flush()
    expect(line()).toBe('yes')
  })
})

describe('what a choice option does by itself (effects)', () => {
  it('runs when the player picks it, not for the other option', async () => {
    const { pick } = await import('../scene/director')
    await routes.start('pointed' as never)
    await flush()
    await next()
    expect(points()).toBe(0)
    pick(0)
    await flush()
    expect(line()).toBe('yes')
    expect(points()).toBe(1)

    routes.stop()
    events.abort()
    useGameStore.setState({ data: { flags: {} } as never, route: null })
    await routes.start('pointed' as never)
    await flush()
    await next()
    pick(1)
    await flush()
    expect(line()).toBe('no')
    expect(points()).toBe(0)
  })

  it('runs again on a flowchart jump that passes the pick, but not when a save is loaded', async () => {
    // A jump starts from a new game: the pick on the way gives its points again.
    await routes.start('pointed' as never, { answers: ['a'], target: 'yes', jump: true })
    await flush()
    expect(line()).toBe('yes')
    expect(points()).toBe(1)
    // A save holds the points already: loading it must not add them a second time.
    expect(save.save('slot1')).toBe(true)
    routes.stop()
    events.abort()
    await save.load('slot1')
    await flush()
    expect(line()).toBe('yes')
    expect(points()).toBe(1)
  })
})

describe('a choice box on the flowchart', () => {
  it('a jump to it skips the boxes before (they do not play) and asks the choice', async () => {
    // What game.routes.jump does once it has the way: run to the target box, skipping the rest.
    await routes.start('chooser' as never, { answers: [], target: '?a_b', jump: true })
    await flush()
    expect(useSystemStore.getState().scene.choices?.map((c) => c.label)).toEqual(['Go A', 'Go B'])
    expect(useGameStore.getState().route).toMatchObject({
      visited: ['one', '?a_b'],
      choosing: true,
    })
    expect(events.finished('x/one' as never)).toBe(true) // skipped, counted as played
  })
})

describe('after stories', () => {
  const ids = ['after_a', 'after_b', 'anna_more']
  const withAfterStories = async (run: () => Promise<void>) => {
    const { registry } = await import('../registry')
    const list = registry.routes as string[]
    list.push(...ids)
    endingsReached.clear()
    try {
      await run()
    } finally {
      list.splice(list.length - ids.length, ids.length)
      endingsReached.clear()
    }
  }

  it('lists them by their endings (order first), and only an available one starts', () =>
    withAfterStories(async () => {
      let menu = await routes.afterStories()
      expect(menu.available).toEqual([])
      expect(menu.locked.map((a) => a.id)).toEqual(['after_b', 'after_a'])
      expect(await routes.startAfterStory('after_a' as never)).toBe(false)

      endingsReached.add('anna')
      menu = await routes.afterStories()
      expect(menu.available).toMatchObject([
        { id: 'after_a', title: 'After A', requiresEnding: ['anna'], played: false },
      ])
      expect(menu.locked.map((a) => a.id)).toEqual(['after_b'])
      // Not an after story at all: refused.
      expect(await routes.startAfterStory('anna' as never)).toBe(false)

      expect(await routes.startAfterStory('after_a' as never)).toBe(true)
      await flush()
      expect(line()).toBe('yes')
      expect(useGameStore.getState().route).toMatchObject({ id: 'after_a', from: [] })
      expect((await routes.afterStories()).available[0]?.played).toBe(true)
    }))

  it('groups them (and the routes they move on to) apart from the main story', () =>
    withAfterStories(async () => {
      const group = await routes.afterStoryRoutes()
      expect([...group].sort()).toEqual(['after_a', 'after_b', 'anna_more'])
    }))

  it('a flowchart jump inside one starts from the after story, not from common', () =>
    withAfterStories(async () => {
      const { markSeen } = await import('../routes/progress')
      markSeen('after_a', 'yes')
      markSeen('after_a', '@route:anna_more')
      markSeen('anna_more', 'more')
      const plan = await routes.way('anna_more' as never, 'more')
      expect(plan?.map((w) => w.route)).toEqual(['after_a', 'anna_more'])
      expect(await routes.jump('anna_more' as never, 'more')).toBe(true)
      await flush()
      expect(line()).toBe('anna route')
      expect(useGameStore.getState().route).toMatchObject({ id: 'anna_more', from: ['after_a'] })
    }))
})
