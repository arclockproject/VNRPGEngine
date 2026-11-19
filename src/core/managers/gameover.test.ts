import { beforeEach, describe, expect, it, vi } from 'vitest'
import config from '@/content/config/gameover'
import { save } from '../save/manager'
import { useSystemStore } from '../stores/system'
import { type GameOverParams, gameOver, gameOverButtons, isGameOver } from './gameover'
import { party } from './party'
import { session } from './session'

const mutable = config as { -readonly [K in keyof typeof config]: (typeof config)[K] }
const shown = () =>
  useSystemStore.getState().windows.find((w) => w.id === 'gameover')?.params as
    | GameOverParams
    | undefined

describe('game over', () => {
  beforeEach(() => {
    mutable.mode = 'screen'
    mutable.buttons = ['load', 'wakeUp', 'title']
    vi.restoreAllMocks()
  })

  it("'load' is only offered when there is a save; never no button at all", () => {
    vi.spyOn(save, 'latest').mockReturnValue(null)
    expect(gameOverButtons()).toEqual(['wakeUp', 'title'])
    mutable.buttons = ['load']
    expect(gameOverButtons()).toEqual(['title'])
  })

  it('shows the screen and heals the party on "wakeUp"', async () => {
    const restore = vi.spyOn(party, 'restore')
    const over = gameOver()
    expect(isGameOver()).toBe(true)
    // A second call while it shows is the same game over, not a second screen.
    expect(gameOver()).toBe(over)
    shown()?.answer('wakeUp')
    await expect(over).resolves.toBe('wakeUp')
    expect(restore).toHaveBeenCalled()
    expect(isGameOver()).toBe(false)
  })

  it('"title" goes to the title screen without asking', async () => {
    const toTitle = vi.spyOn(session, 'toTitle').mockResolvedValue()
    const over = gameOver()
    shown()?.answer('title')
    await expect(over).resolves.toBe('title')
    expect(toTitle).toHaveBeenCalled()
  })

  it('"load" loads the newest save; a broken one shows the screen again', async () => {
    vi.spyOn(save, 'latest').mockReturnValue({ slot: 'auto' } as never)
    const load = vi.spyOn(save, 'load').mockRejectedValueOnce(new Error('broken'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const over = gameOver()
    expect(shown()?.buttons).toEqual(['load', 'wakeUp', 'title'])
    shown()?.answer('load')
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(1))
    await vi.waitFor(() => expect(isGameOver()).toBe(true))
    load.mockResolvedValueOnce()
    shown()?.answer('load')
    await expect(over).resolves.toBe('load')
    expect(load).toHaveBeenLastCalledWith('auto')
  })

  it("mode 'wakeUp' shows no screen", async () => {
    mutable.mode = 'wakeUp'
    const restore = vi.spyOn(party, 'restore')
    await expect(gameOver()).resolves.toBe('wakeUp')
    expect(restore).toHaveBeenCalled()
    expect(isGameOver()).toBe(false)
  })
})
