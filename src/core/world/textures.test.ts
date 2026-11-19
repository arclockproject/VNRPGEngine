import { beforeEach, describe, expect, it, vi } from 'vitest'

const cache = new Map<string, { source: { pixelWidth: number; pixelHeight: number } }>()
const unload = vi.fn((url: string) => {
  cache.delete(url)
  return Promise.resolve()
})

vi.mock('pixi.js', () => ({
  Assets: {
    cache: { has: (url: string) => cache.has(url) },
    get: (url: string) => cache.get(url),
    unload: (url: string) => unload(url),
  },
}))
vi.mock('../platform', () => ({ isAndroid: false, isElectron: false }))

const { addInUse, noteLoaded, resetTextures, setInUse, textureStats, trim } = await import(
  './textures'
)

/** A 1 MB image (512 × 512 × 4 bytes). */
const load = (...urls: string[]) => {
  for (const url of urls) cache.set(url, { source: { pixelWidth: 512, pixelHeight: 512 } })
  noteLoaded(urls)
}
const MB = 1024 * 1024

describe('textures', () => {
  beforeEach(() => {
    cache.clear()
    unload.mockClear()
    resetTextures()
  })

  it('keeps the current map and frees the oldest other images over budget', () => {
    load('a', 'b') // map 1
    setInUse(['a', 'b'])
    load('c') // map 2
    setInUse(['c'])
    load('d') // map 3
    setInUse(['d'])
    // a, b, c are spare (3 MB); budget 1 MB frees the two oldest.
    expect(trim(1 * MB)).toEqual(['a', 'b'])
    expect(unload).toHaveBeenCalledTimes(2)
    expect(textureStats()).toEqual({ images: 2, inUse: 1, bytes: 2 * MB })
  })

  it('never frees images in use, even with a zero budget', () => {
    load('a', 'b')
    setInUse(['a'])
    addInUse(['b']) // a structure placed while playing
    expect(trim(0)).toEqual([])
  })

  it('a recently reused image goes to the back of the queue', () => {
    load('a', 'b', 'c')
    setInUse([])
    noteLoaded(['a']) // a map preloaded it again
    expect(trim(2 * MB)).toEqual(['b'])
  })
})
