import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSystemStore } from '../stores/system'

// Fake world + fake maps: tests the transition logic without PixiJS or real content.
const built: { title: string; spawn: unknown }[] = []
vi.mock('../world/getWorld', () => ({
  peekWorld: () => undefined,
  getWorld: async () => ({
    preload: async (_def: unknown, onProgress?: (p: number) => void) => {
      onProgress?.(1)
      return []
    },
    preloadSprites: async () => [],
    addProp: () => {},
    build: (def: { title: string }, _layout: unknown, spawn: unknown) =>
      built.push({ title: def.title, spawn }),
    api: () => ({}),
  }),
}))
const log: string[] = []
/** A blank 6×6 Tiled map with these spawns (tile positions). */
const tiled = (spawns: Record<string, { x: number; y: number }>) => ({
  width: 6,
  height: 6,
  tileWidth: 16,
  tileHeight: 16,
  properties: {},
  tilesets: [],
  layers: [
    {
      kind: 'objects',
      name: 'Objects',
      visible: true,
      properties: {},
      objects: Object.entries(spawns).map(([name, at], i) => ({
        id: i + 1,
        name,
        type: 'spawn',
        x: at.x * 16 + 8,
        y: at.y * 16 + 8,
        width: 0,
        height: 0,
        point: true,
        visible: true,
        properties: {},
      })),
    },
  ],
})
const fakeMaps: Record<string, unknown> = {
  a: {
    title: 'A',
    tiled: tiled({ first: { x: 1, y: 1 }, second: { x: 2, y: 2 } }),
    setup: () => {
      log.push('A setup')
      return () => log.push('A cleanup')
    },
    onEnter: () => log.push('A enter'),
    onExit: () => log.push('A exit'),
  },
  b: {
    title: 'B',
    tiled: tiled({ only: { x: 5, y: 5 } }),
    onEnter: () => log.push('B enter'),
  },
}
vi.mock('../registry', () => ({
  loadMap: async (id: string) => fakeMaps[id],
  props: {},
  onHotUpdate: () => () => {},
}))
vi.mock('../gameRef', () => ({ getGame: () => ({}) }))

const { maps, FADE_MS } = await import('./maps')
const go = maps.go as (id: string, options?: object) => Promise<void>
const initial = useSystemStore.getState()

beforeEach(() => {
  useSystemStore.setState(initial, true)
  built.length = 0
  log.length = 0
  vi.useRealTimers()
})

describe('maps.go', () => {
  it('uses the first spawn by default, or the named one', async () => {
    await go('a', { transition: 'instant' })
    await go('a', { transition: 'instant', spawn: 'second' })
    expect(built.map((b) => b.spawn)).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    ])
    expect(useSystemStore.getState().map).toEqual({ id: 'a', params: undefined, spawn: 'second' })
  })

  it('runs hooks in order: setup, enter, then exit + cleanup when leaving', async () => {
    await go('a', { transition: 'instant' })
    await go('b', { transition: 'instant' })
    // (An earlier test's map may still be cleaned up first, so check the last five.)
    expect(log.slice(-5)).toEqual(['A setup', 'A enter', 'A exit', 'A cleanup', 'B enter'])
  })

  it('fades out, then in, and is idle afterwards', async () => {
    vi.useFakeTimers()
    await go('a', { transition: 'instant' })
    const phases: (string | null)[] = []
    const stop = useSystemStore.subscribe((s) => {
      if (phases.at(-1) !== s.mapTransition) phases.push(s.mapTransition)
    })
    const done = go('b')
    await vi.advanceTimersByTimeAsync(FADE_MS * 3)
    await done
    stop()
    expect(phases).toEqual(['out', 'in', null])
    expect(useSystemStore.getState().mapTransition).toBeNull()
  })

  it('queues a go() made during a transition', async () => {
    const first = go('a', { transition: 'instant' })
    const second = go('b', { transition: 'instant' })
    await Promise.all([first, second])
    expect(built.map((b) => b.title)).toEqual(['A', 'B'])
  })
})
