import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSystemStore } from '../stores/system'

type Ctx = {
  event: (id: string, params?: unknown) => Promise<void>
  show: (id: string) => void
  params: unknown
}
const log: string[] = []
const seen: { scene: number; stack: string[] }[] = []
const record = () => {
  const s = useSystemStore.getState()
  seen.push({ scene: s.scene.actors.length, stack: [...(s.event?.stack ?? [])] })
}
const fakeEvents: Record<string, { run: (ctx: Ctx) => Promise<void> }> = {
  outer: {
    run: async ({ event, show }) => {
      show('kim')
      log.push('outer start')
      await event('inner', { n: 2 })
      record()
      log.push('outer end')
    },
  },
  inner: {
    run: async ({ params }) => {
      record()
      log.push(`inner ${(params as { n: number }).n}`)
    },
  },
  self: { run: async ({ event }) => event('self') },
  ping: { run: async ({ event }) => event('pong') },
  pong: { run: async ({ event }) => event('ping') },
  deep: {
    run: async ({ event, params }) => {
      const n = (params as number | undefined) ?? 0
      // Different ids each level: deep_0 → deep_1 → … (no loop, just depth).
      if (n < 20) await event(`deep_${n + 1}`, n + 1)
    },
  },
}
vi.mock('../registry', () => ({
  characters: { kim: { name: 'Kim' } },
  loadEvent: async (id: string) =>
    fakeEvents[id] ?? (id.startsWith('deep_') ? fakeEvents.deep : undefined),
}))
vi.mock('../gameRef', () => ({ getGame: () => ({}) }))

const { events, EventLoopError, EventDepthError, MAX_EVENT_DEPTH } = await import('./events')
const start = events.start as (id: string, params?: unknown) => Promise<void>

beforeEach(() => {
  log.length = 0
  seen.length = 0
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('event() inside an event', () => {
  it('runs the other event right away, in the same scene, then continues', async () => {
    await start('outer')
    expect(log).toEqual(['outer start', 'inner 2', 'outer end'])
    // The portrait shown by "outer" is still on stage inside "inner".
    expect(seen).toEqual([
      { scene: 1, stack: ['outer', 'inner'] },
      { scene: 1, stack: ['outer'] },
    ])
    // Afterwards everything is cleared.
    expect(useSystemStore.getState().event).toBeNull()
    expect(useSystemStore.getState().scene.actors).toEqual([])
  })

  it('refuses an event that runs itself', async () => {
    await expect(start('self')).rejects.toThrow(EventLoopError)
    await expect(start('self')).rejects.toThrow('self → self')
    expect(useSystemStore.getState().event).toBeNull()
  })

  it('refuses loops through other events', async () => {
    await expect(start('ping')).rejects.toThrow('ping → pong → ping')
  })

  it('stops chains deeper than the limit', async () => {
    const error = await start('deep').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(EventDepthError)
    expect((error as InstanceType<typeof EventDepthError>).chain).toHaveLength(MAX_EVENT_DEPTH + 1)
  })

  it('a failed event does not block the next one', async () => {
    await start('self').catch(() => {})
    await start('inner', { n: 7 })
    expect(log).toEqual(['inner 7'])
  })
})

describe('game.events.start during an event', () => {
  it('queues it after the current event and warns', async () => {
    fakeEvents.queuer = {
      run: async () => {
        void start('inner', { n: 1 })
        log.push('queuer end')
      },
    }
    await start('queuer')
    await start('inner', { n: 3 }) // after the queued one
    expect(log).toEqual(['queuer end', 'inner 1', 'inner 3'])
    expect(console.warn).toHaveBeenCalledOnce()
  })
})
