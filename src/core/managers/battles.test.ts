// game.battles: fighters from the party, rewards on a win, HP carried back, onLose.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BattleParams } from './battles'

const onLose = vi.fn()
vi.mock('@/content/battle', () => ({
  default: { onLose: (...a: unknown[]) => onLose(...a) },
}))
vi.mock('@/content/statuses', () => ({ default: {} }))
vi.mock('@/content/stats', () => ({
  default: {
    stats: {
      hp: { name: 'HP', pool: true },
      mp: { name: 'MP', pool: true },
      attack: { name: 'A' },
    },
    slots: {},
    maxLevel: 10,
    xpForLevel: (level: number) => (level - 1) * 10,
    maxMembers: 4,
  },
}))
vi.mock('../registry', () => ({
  characters: { hero: { name: 'Hero', battle: { base: { hp: 30, attack: 50, speed: 9 } } } },
  enemies: {
    slime: {
      name: 'Slime',
      stats: { hp: 10, attack: 3 },
      xp: 15,
      money: 7,
      drops: [{ item: 'apple', chance: 1 }],
    },
    giant: { name: 'Giant', stats: { hp: 999, attack: 999, speed: 99 } },
  },
  items: { apple: { name: 'Apple' } },
  skills: {},
  troops: {
    pair: { enemies: ['slime', 'slime'], background: '#abcdef', rewards: { xp: 5, money: 1 } },
  },
  registry: { items: ['apple'] },
}))

/** A fake battle screen: everyone attacks until it is over. */
const autoBattle = async (_id: string, { battle }: BattleParams) => {
  while (!battle.outcome) {
    const me = battle.current()
    if (!me) break
    battle.act(me.side === 'enemy' ? battle.enemyAction() : { kind: 'attack', target: '' })
  }
  return battle.outcome
}
const fakeGame = {
  t: (s: string) => s,
  minigames: { start: vi.fn(autoBattle) },
}
vi.mock('../gameRef', () => ({ getGame: () => fakeGame }))
vi.mock('../audio/manager', () => ({
  audio: { currentMusic: () => null, music: () => {}, stopMusic: () => {} },
}))

const { useGameStore, emptyEngineState } = await import('../stores/game')
const { initialData } = await import('@/content/save/data')
const { backgroundCss, battles, rollRewards } = await import('./battles')
const { party } = await import('./party')
const { items } = await import('./items')
const { money } = await import('./money')

beforeEach(() => {
  useGameStore.setState({ data: initialData(), ...emptyEngineState() })
  onLose.mockClear()
  party.add('hero' as never)
})

describe('battles', () => {
  it('rewards add up per enemy; drops roll by chance', () => {
    expect(rollRewards(['slime', 'slime'] as never, () => 0.5)).toEqual({
      xp: 30,
      money: 14,
      drops: ['apple', 'apple'],
    })
  })

  it('a win gives XP, money and drops, and names twins "A" and "B"', async () => {
    let names: string[] = []
    fakeGame.minigames.start.mockImplementationOnce(async (id, params) => {
      names = params.battle.side('enemy').map((f) => f.name)
      return autoBattle(id, params)
    })
    expect(await battles.start({ enemies: ['slime', 'slime'] as never })).toBe('win')
    expect(names).toEqual(['Slime A', 'Slime B'])
    expect(party.member('hero' as never)?.level).toBe(4) // 30 XP
    expect(money.get()).toBe(14)
    expect(items.count('apple' as never)).toBe(2)
  })

  it('a troop brings its enemies, background and rewards; options win over it', async () => {
    const seen: BattleParams[] = []
    fakeGame.minigames.start.mockImplementation(async (id, params) => {
      seen.push(params)
      return autoBattle(id, params)
    })
    expect(await battles.start('pair' as never)).toBe('win')
    expect(seen[0]?.battle.side('enemy', false)).toHaveLength(2)
    expect(seen[0]?.background).toBe('#abcdef')
    expect(seen[0]?.rewards).toEqual({ xp: 5, money: 1, drops: [] })
    await battles.start({ troop: 'pair' as never, background: '#111111' })
    expect(seen[1]?.background).toBe('#111111')
    fakeGame.minigames.start.mockImplementation(autoBattle)
  })

  it('named(): what a .vn `battle` line means', () => {
    expect(battles.named(['pair'] as never)).toBe('pair')
    expect(battles.named(['slime', 'giant'] as never)).toEqual({ enemies: ['slime', 'giant'] })
    expect(battles.named(['pair', 'giant'] as never)).toEqual({
      enemies: ['slime', 'slime', 'giant'],
    })
  })

  it('HP carries over, and losing calls onLose', async () => {
    expect(await battles.start({ enemies: ['giant'] as never })).toBe('lose')
    expect(party.current('hero' as never, 'hp' as never)).toBe(0)
    expect(onLose).toHaveBeenCalledOnce()
  })

  it('backgrounds: names from battle.ts, images cover the screen, other CSS as it is', () => {
    const named = { forest: '/assets/forest.svg', night: 'linear-gradient(#000, #111)' }
    expect(backgroundCss('forest', named)).toBe(
      'center / cover no-repeat url("/assets/forest.svg"), #090a0f',
    )
    expect(backgroundCss('night', named)).toBe('linear-gradient(#000, #111)')
    expect(backgroundCss('data:image/png;base64,AAA')).toContain('url(')
    expect(backgroundCss('#223344')).toBe('#223344')
    expect(backgroundCss(undefined)).toContain('gradient')
  })

  it('a battle passes its background and sprite scale to the screen', async () => {
    let params: BattleParams | undefined
    fakeGame.minigames.start.mockImplementationOnce(async (id, p) => {
      params = p
      return autoBattle(id, p)
    })
    await battles.start({ enemies: ['slime'] as never, background: '#123456' })
    expect(params?.background).toBe('#123456')
    expect(params?.spriteScale).toBe(4)
  })
})
