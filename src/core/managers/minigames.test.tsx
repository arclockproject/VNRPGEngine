// @vitest-environment happy-dom
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import inputConfig from '@/content/config/input'
import { useSystemStore } from '../stores/system'

vi.mock('../registry', () => ({
  loadMinigame: async (id: string) =>
    id === 'quittable'
      ? { component: () => null, quitResult: 'gave up' }
      : { component: () => null },
  characters: {},
}))

const { minigames, MINIGAME_FADE_MS } = await import('./minigames')
const { input } = await import('../input/manager')
const { useGameLoop } = await import('../minigame/useGameLoop')
const start = minigames.start as (id: string) => Promise<unknown>

const probe = { ticks: 0 }
function LoopProbe() {
  useGameLoop(() => {
    probe.ticks++
  })
  return null
}
const initial = useSystemStore.getState()
const cancelKey = inputConfig.actions.cancel.keys?.[0] ?? 'Escape'
const pressCancel = () => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code: cancelKey, cancelable: true }))
  window.dispatchEvent(new KeyboardEvent('keyup', { code: cancelKey }))
}

beforeEach(() => {
  useSystemStore.setState(initial, true)
  vi.useFakeTimers()
  input.start()
})
afterEach(() => {
  input.stop()
  vi.useRealTimers()
})

describe('minigames.start', () => {
  it('resolves with the result after fading out; only the first finish counts', async () => {
    const result = start('plain')
    await vi.waitFor(() => expect(useSystemStore.getState().minigame).not.toBeNull())
    const { finish } = useSystemStore.getState().minigame ?? { finish: () => {} }
    finish('first')
    finish('second')
    expect(useSystemStore.getState().minigame?.leaving).toBe(true)
    await vi.advanceTimersByTimeAsync(MINIGAME_FADE_MS)
    expect(await result).toBe('first')
    expect(useSystemStore.getState().minigame).toBeNull()
  })

  it('cancel quits with quitResult when the minigame has one', async () => {
    const result = start('quittable')
    await vi.waitFor(() => expect(useSystemStore.getState().minigame).not.toBeNull())
    pressCancel()
    await vi.advanceTimersByTimeAsync(MINIGAME_FADE_MS)
    expect(await result).toBe('gave up')
  })

  it('cancel does nothing for minigames without quitResult', async () => {
    void start('plain')
    await vi.waitFor(() => expect(useSystemStore.getState().minigame).not.toBeNull())
    pressCancel()
    expect(useSystemStore.getState().minigame?.leaving).toBe(false)
  })

  it('ignores input while fading out', async () => {
    void start('quittable')
    await vi.waitFor(() => expect(useSystemStore.getState().minigame).not.toBeNull())
    const handler = vi.fn()
    input.on('confirm', handler, { layers: ['minigame'] })
    useSystemStore.getState().minigame?.finish('done')
    const confirmKey = inputConfig.actions.confirm.keys?.[0] ?? 'Enter'
    window.dispatchEvent(new KeyboardEvent('keydown', { code: confirmKey, cancelable: true }))
    expect(handler).not.toHaveBeenCalled()
  })

  it('refuses a second minigame while one runs', async () => {
    void start('plain')
    await vi.waitFor(() => expect(useSystemStore.getState().minigame).not.toBeNull())
    await expect(start('plain')).rejects.toThrow('another minigame is running')
  })
})

describe('useGameLoop', () => {
  it('ticks while the minigame is on top and pauses under a window', async () => {
    vi.useRealTimers()
    void start('plain')
    await vi.waitFor(() => expect(useSystemStore.getState().minigame).not.toBeNull())
    render(<LoopProbe />)
    await act(() => new Promise((r) => setTimeout(r, 100)))
    expect(probe.ticks).toBeGreaterThan(0)

    useSystemStore.setState((s) => {
      s.windows.push({ id: 'settings' as never, params: undefined })
    })
    const paused = probe.ticks
    await act(() => new Promise((r) => setTimeout(r, 100)))
    expect(probe.ticks).toBe(paused)
  })
})
