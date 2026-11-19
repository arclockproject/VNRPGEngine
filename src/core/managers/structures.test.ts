import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGameStore } from '../stores/game'
import { useSystemStore } from '../stores/system'

const added: [string, { x: number; y: number }][] = []
const removed: string[] = []
vi.mock('../world/getWorld', () => ({
  getWorld: async () => ({
    size: () => ({ width: 20, height: 20 }),
    api: () => ({ player: { x: 0.5, y: 0.5 } }),
    preload: async () => [],
    addStructure: (id: string, _layout: unknown, at: { x: number; y: number }) =>
      added.push([id, at]),
    removeStructure: (id: string) => removed.push(id),
  }),
}))
vi.mock('../registry', () => ({
  loadStructure: async () => ({
    tiled: {
      width: 2,
      height: 2,
      tileWidth: 16,
      tileHeight: 16,
      properties: {},
      tilesets: [],
      layers: [],
    },
  }),
}))

const { structures } = await import('./structures')
const place = structures.place as (s: string, o: object) => Promise<string>

beforeEach(() => {
  added.length = 0
  removed.length = 0
  useGameStore.setState({ structures: {} })
  useSystemStore.setState((s) => {
    s.map = { id: 'town' as never, params: undefined, spawn: 'start' }
  })
})

describe('game.structures', () => {
  it('places into the current map: stamped now and remembered for later', async () => {
    expect(await place('house', { at: { x: 5, y: 3 }, id: 'jacks_house' })).toBe('jacks_house')
    expect(added).toEqual([['jacks_house', { x: 5, y: 3 }]])
    expect(useGameStore.getState().structures).toEqual({
      town: [{ id: 'jacks_house', structure: 'house', at: { x: 5, y: 3 } }],
    })
    expect(structures.has('jacks_house')).toBe(true)
  })

  it('placing the same id again moves it instead of duplicating it', async () => {
    await place('house', { at: { x: 5, y: 3 }, id: 'a' })
    await place('house', { at: { x: 8, y: 3 }, id: 'a' })
    expect(structures.list().map((p) => p.at)).toEqual([{ x: 8, y: 3 }])
  })

  it('places into another map without touching the current one', async () => {
    await place('house', { at: { x: 1, y: 1 }, map: 'forest' })
    expect(added).toEqual([])
    expect(structures.has('house', { map: 'forest' as never })).toBe(true)
    expect(structures.has('house')).toBe(false)
  })

  it('refuses a spot that would trap the player, and remove() takes it away', async () => {
    useSystemStore.setState((s) => {
      s.map = { id: 'town' as never, params: undefined, spawn: 'start' }
    })
    await expect(place('house', { at: { x: 30, y: 0 } })).rejects.toThrow("doesn't fit")
    await place('house', { at: { x: 2, y: 2 }, id: 'x' })
    await structures.remove('x')
    expect(removed).toEqual(['x'])
    expect(structures.list()).toEqual([])
  })
})

describe('force', () => {
  it('places even where it does not fit or would trap the player', async () => {
    await expect(place('house', { at: { x: 30, y: 0 } })).rejects.toThrow('force: true')
    await expect(place('house', { at: { x: 30, y: 0 }, id: 'f', force: true })).resolves.toBe('f')
    expect(added).toEqual([['f', { x: 30, y: 0 }]])
    expect(structures.has('f')).toBe(true)
  })
})
