// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cubicBezier, EASINGS } from './easing'
import { runningTweens, stopTweens, tween } from './tween'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
})
afterEach(() => vi.useRealTimers())

describe('easing', () => {
  it('every curve starts at 0 and ends at 1', () => {
    for (const [name, ease] of Object.entries(EASINGS)) {
      expect(ease(0), name).toBeCloseTo(0, 5)
      expect(ease(1), name).toBeCloseTo(1, 5)
    }
  })

  it('backOut overshoots before settling', () => {
    const samples = Array.from({ length: 21 }, (_, i) => EASINGS.backOut(i / 20))
    expect(Math.max(...samples)).toBeGreaterThan(1.05)
  })

  it('in curves start slow, out curves start fast', () => {
    expect(EASINGS.cubicIn(0.2)).toBeLessThan(0.2)
    expect(EASINGS.cubicOut(0.2)).toBeGreaterThan(0.2)
  })

  it('cubicBezier matches the CSS "ease" curve', () => {
    const ease = cubicBezier(0.25, 0.1, 0.25, 1)
    expect(ease(0.5)).toBeCloseTo(0.8024, 2)
    expect(cubicBezier(0, 0, 1, 1)(0.3)).toBeCloseTo(0.3, 3) // linear
  })
})

describe('tween', () => {
  it('moves values over time and resolves at the end', async () => {
    const box = { x: 0, y: 10 }
    let updates = 0
    const t = tween(box, { x: 100 }, { duration: 1000, ease: 'linear' }, () => updates++)
    vi.advanceTimersByTime(500)
    expect(box.x).toBeGreaterThan(40)
    expect(box.x).toBeLessThan(60)
    expect(box.y).toBe(10) // untouched
    vi.advanceTimersByTime(600)
    await t.done
    expect(box.x).toBe(100)
    expect(updates).toBeGreaterThan(2)
    expect(runningTweens()).toBe(0)
  })

  it('waits for its delay', () => {
    const box = { x: 0 }
    tween(box, { x: 10 }, { duration: 100, delay: 200, ease: 'linear' })
    vi.advanceTimersByTime(150)
    expect(box.x).toBe(0)
    vi.advanceTimersByTime(300)
    expect(box.x).toBe(10)
  })

  it('yoyo with repeat goes there and back', async () => {
    const box = { y: 0 }
    const t = tween(box, { y: -40 }, { duration: 100, repeat: 1, yoyo: true, ease: 'linear' })
    vi.advanceTimersByTime(100)
    expect(box.y).toBeLessThan(-30)
    vi.advanceTimersByTime(150)
    await t.done
    expect(box.y).toBe(0)
  })

  it('a newer tween takes a field over; stop and finish', async () => {
    const box = { x: 0, scale: 1 }
    const first = tween(box, { x: 100, scale: 2 }, { duration: 1000 })
    const second = tween(box, { x: -50 }, { duration: 1000 })
    second.finish()
    expect(box.x).toBe(-50)
    vi.advanceTimersByTime(1100)
    await first.done
    expect(box.scale).toBe(2) // first still owned scale
    expect(box.x).toBe(-50) // but no longer x

    const third = tween(box, { scale: 5 }, { duration: 1000 })
    vi.advanceTimersByTime(100)
    stopTweens(box)
    await third.done
    expect(box.scale).toBeGreaterThan(2)
    expect(box.scale).toBeLessThan(5)
  })
})
