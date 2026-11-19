import { beforeEach, describe, expect, it } from 'vitest'
import config from '@/content/config/difficulty'
import { useGameStore } from '../stores/game'
import { useSystemStore } from '../stores/system'
import { difficulty } from './difficulty'

describe('game.difficulty', () => {
  beforeEach(() => {
    useGameStore.setState((s) => {
      s.difficulty = ''
    })
  })

  it('starts on the default level; unknown saved values fall back to it', () => {
    expect(difficulty.get()).toBe(config.default)
    useGameStore.setState((s) => {
      s.difficulty = 'gone_from_the_game'
    })
    expect(difficulty.get()).toBe(config.default)
    difficulty.set('nope' as never)
    expect(difficulty.get()).toBe(config.default)
  })

  it('rates are 1 unless the level sets them', () => {
    const [first] = difficulty.list()
    if (!first) throw new Error('no levels')
    difficulty.set(first.id)
    expect(difficulty.get()).toBe(first.id)
    expect(difficulty.rate('xp')).toBe(first.level.xp ?? 1)
    expect(difficulty.rate('enemyStats', 'hp')).toBe(first.level.enemyStats?.hp ?? 1)
    expect(difficulty.rate('enemyStats', 'not_a_stat')).toBe(1)
    expect(difficulty.rate('enemyStats')).toBe(1)
  })

  it('ask() sets what the player picks and keeps the level when the window is closed', async () => {
    const ids = difficulty.list().map((l) => l.id)
    const other = ids.find((id) => id !== difficulty.get())
    if (!other) return // one level: nothing to ask
    const answer = (key: string | null) => {
      const window = useSystemStore.getState().windows.find((w) => w.id === 'confirm')
      const params = window?.params as { answer: (key: string) => void; options: object }
      expect(Object.keys(params.options)[0]).toBe(difficulty.get()) // the current one is the default
      if (key) params.answer(key)
      else
        useSystemStore.setState((s) => {
          s.windows = []
        })
    }
    const asked = difficulty.ask()
    answer(other)
    await expect(asked).resolves.toBe(other)
    const again = difficulty.ask()
    answer(null)
    await expect(again).resolves.toBe(other)
  })
})
