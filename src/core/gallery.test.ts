import { describe, expect, it, vi } from 'vitest'
import { cgPicture, cgUnlockKey, cgVariants, defineGallery, pictureUrls } from './gallery'

const whole = { x: 0, y: 0, w: 200, h: 100 }
const pond = defineGallery({
  title: 'Pond',
  image: {
    width: 200,
    height: 100,
    image: 'flat.png',
    parts: [
      { toggle: null, src: 'base1.png', ...whole },
      { toggle: 'moon', src: 'moon.png', x: 100, y: 0, w: 50, h: 50 },
      { toggle: null, src: 'base2.png', ...whole },
      { toggle: 'tears', src: 'tears.png', x: 20, y: 50, w: 10, h: 5 },
    ],
  },
  variants: { moon: { moon: true }, both: { moon: true, tears: true }, none: { moon: false } },
})

describe('layered CGs', () => {
  it('stacks always-drawn layers and toggles in draw order, placed as fractions', () => {
    const both = cgPicture(pond, 'both')
    expect(pictureUrls(both)).toEqual(['base1.png', 'moon.png', 'base2.png', 'tears.png'])
    expect(typeof both !== 'string' && both.aspect).toBe(2)
    expect(typeof both !== 'string' && both.layers[3]).toEqual({
      src: 'tears.png',
      x: 0.1,
      y: 0.5,
      w: 0.05,
      h: 0.05,
    })
    expect(pictureUrls(cgPicture(pond, 'moon'))).toEqual(['base1.png', 'moon.png', 'base2.png'])
  })

  it('no toggles on = the flattened picture alone', () => {
    expect(cgPicture(pond)).toBe('flat.png')
    expect(cgPicture(pond, 'none')).toBe('flat.png')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(cgPicture(pond, 'missing')).toBe('flat.png')
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('lists only the named variants (the plain picture only when named, e.g. base: {})', () => {
    expect(cgVariants(pond)).toEqual(['moon', 'both', 'none'])
    expect(cgVariants({ ...pond, variants: { base: {}, ...pond.variants } })).toEqual([
      'base',
      'moon',
      'both',
      'none',
    ])
    // A picture without variants is just the one picture.
    expect(cgVariants({ title: 'x', image: 'x.png' })).toEqual([undefined])
  })

  it('keeps the old unlock key for the plain picture', () => {
    expect(cgUnlockKey('pond')).toBe('gallery:pond')
    expect(cgUnlockKey('pond', 'both')).toBe('gallery:pond:both')
  })
})
