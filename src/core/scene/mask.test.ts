import { describe, expect, it } from 'vitest'
import { backgroundKind, backgroundStyle } from './background'
import { canMask, coverRect, fillMask, maskAlpha, ruleFromFunction } from './mask'

describe('mask transitions', () => {
  it('shows nothing at the start and everything at the end, whatever the rule', () => {
    for (const value of [0, 0.3, 1]) {
      expect(maskAlpha(value, 0, 0.15)).toBe(0)
      expect(maskAlpha(value, 1, 0.15)).toBe(1)
    }
  })

  it('low rule values show first, with a soft edge in between', () => {
    expect(maskAlpha(0.1, 0.5, 0.2)).toBe(1)
    expect(maskAlpha(0.9, 0.5, 0.2)).toBe(0)
    const edge = maskAlpha(0.5, 0.5, 0.2)
    expect(edge).toBeGreaterThan(0)
    expect(edge).toBeLessThan(1)
  })

  it('samples a rule function over the mask and clamps it', () => {
    const rule = ruleFromFunction((x) => x * 2, 4, 1)
    expect([...rule]).toEqual([0.25, 0.75, 1, 1])
  })

  it('writes the mask into the alpha channel; reverse flips it', () => {
    const rule = new Float32Array([0, 1])
    const pixels = new Uint8ClampedArray(8)
    fillMask(pixels, rule, 0.5, 0.1, false)
    expect([pixels[3], pixels[7]]).toEqual([255, 0])
    fillMask(pixels, rule, 0.5, 0.1, true)
    expect([pixels[3], pixels[7]]).toEqual([0, 255])
  })

  it('covers the canvas like background-size: cover', () => {
    expect(coverRect(2, 100, 100)).toEqual({ x: -50, y: 0, w: 200, h: 100 })
    expect(coverRect(1, 200, 100)).toEqual({ x: 0, y: -50, w: 200, h: 200 })
  })
})

describe('background kinds', () => {
  it('tells colours, gradients, pictures and videos apart', () => {
    expect(backgroundKind('#203040')).toBe('colour')
    expect(backgroundKind('rgba(0,0,0,0.5)')).toBe('colour')
    expect(backgroundKind('linear-gradient(red, blue)')).toBe('gradient')
    expect(backgroundKind('/assets/room.webp')).toBe('image')
    expect(backgroundKind('/assets/rain-abc123.mp4')).toBe('video')
    expect(backgroundKind('data:video/webm;base64,AAAA')).toBe('video')
  })

  it('a video has no CSS background (it is drawn as an element) and can not be masked', () => {
    expect(backgroundStyle('/a/loop.webm')).toEqual({})
    expect(canMask('/a/loop.webm')).toBe(false)
    expect(canMask('linear-gradient(red, blue)')).toBe(false)
    expect(canMask('/a/room.png')).toBe(true)
    expect(canMask('#000')).toBe(true)
    expect(canMask({ aspect: 1, layers: [] })).toBe(true)
  })
})
