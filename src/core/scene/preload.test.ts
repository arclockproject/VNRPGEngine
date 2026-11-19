import { beforeEach, describe, expect, it, vi } from 'vitest'

const media: Record<string, unknown[]> = {
  story: [
    { kind: 'image', url: 'a.png' },
    { kind: 'character', id: 'anna' },
    { kind: 'cg', id: 'pond', variant: 'moon' },
    { kind: 'image', url: 'd.png' },
  ],
  inner: [{ kind: 'image', url: 'x.png' }],
}
vi.mock('../registry', () => ({
  loadEventMedia: async (id: string) => media[id] ?? [],
  characters: { anna: { portraits: { calm: 'anna1.png', mad: 'anna2.png' } } },
  gallery: {
    pond: {
      title: 'Pond',
      image: {
        width: 1,
        height: 1,
        image: 'pond.png',
        parts: [
          { toggle: null, src: 'pond.png', x: 0, y: 0, w: 1, h: 1 },
          { toggle: 'moon', src: 'moon.png', x: 0, y: 0, w: 1, h: 1 },
        ],
      },
      variants: { moon: { moon: true } },
    },
  },
}))
vi.mock('@/content/config/media', () => ({ default: { events: { preloadAhead: 1 } } }))

class FakeImage {
  src = ''
  decode = () => Promise.resolve()
}
vi.stubGlobal('Image', FakeImage)

const { endEventPreload, notePictureShown, preloadState, startEventPreload } = await import(
  './preload'
)

describe('event look-ahead', () => {
  beforeEach(() => {
    while (preloadState().depth > 0) endEventPreload()
  })

  it('loads the next pictures and moves along as they are shown', async () => {
    await startEventPreload('story' as never)
    // Nothing shown yet: the first picture + 1 ahead.
    expect(preloadState().held).toEqual(['a.png', 'anna1.png', 'anna2.png'])
    notePictureShown(['anna1.png', 'anna2.png'])
    expect(preloadState().held).toEqual(['anna1.png', 'anna2.png', 'pond.png', 'moon.png'])
    notePictureShown(['pond.png', 'moon.png'])
    expect(preloadState().held).toEqual(['pond.png', 'moon.png', 'd.png'])
    notePictureShown(['#000']) // a colour: not in the list, nothing changes
    expect(preloadState().at).toBe(2)
  })

  it('an event inside an event has its own list; the parent comes back after', async () => {
    await startEventPreload('story' as never)
    await startEventPreload('inner' as never)
    expect(preloadState().held).toEqual(['x.png'])
    endEventPreload()
    expect(preloadState().held).toEqual(['a.png', 'anna1.png', 'anna2.png'])
    endEventPreload()
    expect(preloadState()).toEqual({ held: [], depth: 0, at: -1 })
  })
})
