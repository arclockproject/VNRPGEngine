import { beforeEach, describe, expect, it, vi } from 'vitest'
import saveConfig from '@/content/save'
import './game'
import { applyBundle, makeBundle, type NewGamePlusConfig } from './newgameplus'
import { save } from './save/manager'
import { emptyEngineState, useGameStore } from './stores/game'
import { usePersistentStore } from './stores/persistent'

// The normal game (maps): these tests check its newGame, whatever src/content/config/mode.ts says.
vi.mock('@/content/config/mode', () => ({ default: { vnOnly: false } }))

const config: NewGamePlusConfig = {
  enabled: true,
  unlock: 'manual',
  carry: {
    party: true,
    money: 0.5,
    items: true,
    itemsExcept: ['key'],
    codex: true,
    relationships: false,
    difficulty: true,
    flags: ['saw_ending', 'never_set'],
    data: ['stats'],
  },
}

const played = () => ({
  ...emptyEngineState(),
  money: 301,
  cycle: 1,
  difficulty: 'hard',
  codex: { jack: '2026-01-01' },
  relationships: { anna: 9 },
  party: {
    members: ['hero'],
    data: { hero: { level: 7, xp: 900, current: { hp: 3 }, equipment: { weapon: 'sword' } } },
    learned: { hero: ['fire'] },
  },
  data: {
    stats: { health: 40, hunger: 2 },
    flags: { saw_ending: true, met_anna: true },
    inventory: { apple: 3, key: 1 },
  },
})

describe('New Game+ carry-over', () => {
  it('takes only what the config names', () => {
    const bundle = makeBundle(played(), config)
    expect(bundle).toEqual({
      cycle: 2,
      money: 150,
      party: {
        data: { hero: { level: 7, xp: 900, current: {}, equipment: { weapon: 'sword' } } },
        learned: { hero: ['fire'] },
      },
      items: { apple: 3 },
      codex: { jack: '2026-01-01' },
      difficulty: 'hard',
      flags: { saw_ending: true },
      data: { stats: { health: 40, hunger: 2 } },
    })
  })

  it('carries nothing that is switched off', () => {
    const none = makeBundle(played(), {
      ...config,
      carry: {
        ...config.carry,
        party: false,
        money: 0,
        items: false,
        codex: false,
        difficulty: false,
        flags: [],
        data: [],
      },
    })
    expect(none).toEqual({ cycle: 2 })
  })

  it('goes into a fresh game without sharing objects with the bundle', () => {
    const bundle = makeBundle(played(), config)
    const fresh = {
      ...emptyEngineState(),
      data: { stats: { health: 100, hunger: 0 }, flags: { fresh: 1 }, inventory: { bread: 1 } },
    }
    applyBundle(fresh as never, bundle)
    expect(fresh.cycle).toBe(2)
    expect(fresh.money).toBe(150)
    expect(fresh.party.members).toEqual([]) // the story decides who joins; their levels wait
    expect(fresh.party.data.hero?.level).toBe(7)
    expect(fresh.data.inventory).toEqual({ bread: 1, apple: 3 })
    expect(fresh.data.flags).toEqual({ fresh: 1, saw_ending: true })
    expect(fresh.relationships).toEqual({})
    ;(fresh.data.inventory as Record<string, number>).apple = 99
    expect(bundle.items?.apple).toBe(3)
  })
})

describe('game.save New Game+', () => {
  beforeEach(() => {
    usePersistentStore.setState((s) => {
      delete s.newGamePlus
    })
    vi.restoreAllMocks()
  })

  it('is not ready until unlocked; then starts the next cycle with the carried things', async () => {
    const newGame = vi.spyOn(saveConfig, 'newGame').mockImplementation(async () => {})
    expect(save.newGamePlusReady()).toBe(false)
    useGameStore.setState((s) => {
      s.money = 777
      s.cycle = 0
    })
    expect(save.unlockNewGamePlus()).toBe(true)
    expect(save.newGamePlusReady()).toBe(true)
    useGameStore.setState((s) => {
      s.money = 1
    })
    await save.newGamePlus()
    expect(save.cycle()).toBe(1)
    expect(newGame).toHaveBeenCalledTimes(1)
    // A plain new game starts from nothing again, and New Game+ stays available.
    await save.newGame()
    expect(save.cycle()).toBe(0)
    expect(save.newGamePlusReady()).toBe(true)
  })
})
