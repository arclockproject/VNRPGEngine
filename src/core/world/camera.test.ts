import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type CameraTarget, WorldCamera } from './camera'

const places = { player: { x: 5, y: 5 }, npc: { x: 15, y: 5 } }
const locate = (target: CameraTarget) =>
  target.kind === 'point' ? { x: target.x, y: target.y } : places[target.kind]

beforeEach(() => {
  vi.useFakeTimers()
  places.player = { x: 5, y: 5 }
})
afterEach(() => vi.useRealTimers())

describe('map camera', () => {
  it('sits on the player and follows them every frame', () => {
    const camera = new WorldCamera(locate)
    camera.reset()
    expect(camera.at).toEqual({ x: 5, y: 5 })
    places.player = { x: 6, y: 7 }
    camera.update()
    expect(camera.at).toEqual({ x: 6, y: 7 })
  })

  it('pans to a new target over time and resolves when it arrives', async () => {
    const camera = new WorldCamera(locate)
    camera.reset()
    let arrived = false
    void camera.follow({ kind: 'npc', id: 'jack' }, 400).then(() => {
      arrived = true
    })
    vi.advanceTimersByTime(200)
    camera.update()
    expect(camera.at.x).toBeCloseTo(10, 5) // half way, sine in-out
    expect(arrived).toBe(false)
    vi.advanceTimersByTime(200)
    camera.update()
    await Promise.resolve()
    expect(camera.at).toEqual({ x: 15, y: 5 })
    expect(arrived).toBe(true)
  })

  it('a pan of 0 ms jumps, and a new pan ends the one before', async () => {
    const camera = new WorldCamera(locate)
    camera.reset()
    await camera.follow({ kind: 'point', x: 1, y: 2 }, 0)
    expect(camera.at).toEqual({ x: 1, y: 2 })
    let first = false
    void camera.follow({ kind: 'npc', id: 'jack' }, 1000).then(() => {
      first = true
    })
    void camera.follow({ kind: 'player' }, 1000)
    await Promise.resolve()
    expect(first).toBe(true)
  })

  it('zooms smoothly on top of the map zoom, and bad levels mean 1', async () => {
    const camera = new WorldCamera(locate)
    const base = camera.zoom(720, 16, 1)
    void camera.zoomTo(2, 300)
    vi.advanceTimersByTime(300)
    expect(camera.zoom(720, 16, 1)).toBeCloseTo(base * 2, 5)
    await camera.zoomTo(Number.NaN, 0)
    expect(camera.zoom(720, 16, 1)).toBeCloseTo(base, 5)
    // The map's own zoom multiplies in.
    expect(camera.zoom(720, 16, 1.5)).toBeCloseTo(base * 1.5, 5)
  })

  it('leaving the map ends pans and zooms so no script waits forever', async () => {
    const camera = new WorldCamera(locate)
    camera.reset()
    const base = camera.zoom(720, 16, 1)
    let done = 0
    void camera.follow({ kind: 'npc', id: 'jack' }, 5000).then(() => done++)
    void camera.zoomTo(3, 5000).then(() => done++)
    camera.finish()
    await Promise.resolve()
    expect(done).toBe(2)
    expect(camera.zoom(720, 16, 1)).toBeCloseTo(base, 5)
  })
})
