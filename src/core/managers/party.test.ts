// Party: joining, levels from XP, stats with growth and equipment, HP/MP pools.
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/content/stats', () => ({
  default: {
    stats: { hp: { name: 'HP', pool: true }, attack: { name: 'Attack' } },
    slots: { weapon: 'Weapon' },
    maxLevel: 5,
    xpForLevel: (level: number) => (level - 1) * 10,
    maxMembers: 2,
  },
}))
vi.mock('../registry', () => ({
  characters: {
    hero: {
      name: 'Hero',
      battle: {
        base: { hp: 20, attack: 5 },
        growth: { hp: 4, attack: 1.5 },
        skills: ['trip', { skill: 'strike', level: 2 }, { skill: 'smite', quest: 'letter' }],
      },
    },
    anna: { name: 'Anna', battle: { base: { hp: 10 } } },
    jack: { name: 'Jack', battle: { base: { hp: 10 } } },
    cat: { name: 'Cat' },
  },
  items: {
    sword: {
      name: 'Sword',
      equip: { slot: 'weapon', stats: { attack: 3, hp: 2 }, skills: ['slash'] },
    },
    stick: { name: 'Stick', equip: { slot: 'weapon', stats: { attack: 1 } } },
    apple: { name: 'Apple' },
  },
  skills: { fire: { name: 'Fire' }, strike: { name: 'Strike' } },
  registry: { items: ['sword', 'stick', 'apple'] },
}))
vi.mock('../gameRef', () => ({ getGame: () => ({}) }))

const { useGameStore, emptyEngineState } = await import('../stores/game')
const { initialData } = await import('@/content/save/data')
const { party, levelForXp } = await import('./party')
const { items } = await import('./items')

beforeEach(() => {
  useGameStore.setState({ data: initialData(), ...emptyEngineState() })
})

describe('party', () => {
  it('joins with full HP; respects max members and needs battle stats', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(party.add('hero' as never)).toBe(true)
    expect(party.current('hero' as never, 'hp' as never)).toBe(20)
    expect(party.add('cat' as never)).toBe(false)
    expect(party.add('anna' as never)).toBe(true)
    expect(party.add('jack' as never)).toBe(false) // full (max 2)
    party.remove('anna' as never)
    expect(party.members()).toEqual(['hero'])
  })

  it('levels from XP, stats grow (rounded down), level up adds the new HP', () => {
    party.add('hero' as never)
    party.change('hero' as never, 'hp' as never, -15)
    expect(party.current('hero' as never, 'hp' as never)).toBe(5)
    expect(party.giveXp('party', 25)).toEqual({ hero: 2 }) // level 3
    const hero = party.member('hero' as never)
    expect(hero?.level).toBe(3)
    expect(hero?.stats).toEqual({ hp: 28, attack: 8 })
    expect(party.current('hero' as never, 'hp' as never)).toBe(13) // 5 + 8 new points
    expect(levelForXp(1000)).toBe(5) // max level
  })

  it('equip moves items between the inventory and slots, and adds their stats', () => {
    party.add('hero' as never)
    expect(party.equip('hero' as never, 'sword' as never)).toBe(false) // not in the inventory
    items.add('sword' as never)
    items.add('stick' as never)
    items.add('apple' as never)
    expect(party.equippable('weapon' as never)).toEqual(['sword', 'stick']) // folder order
    expect(party.equip('hero' as never, 'apple' as never)).toBe(false)
    expect(party.equip('hero' as never, 'sword' as never)).toBe(true)
    expect(party.stat('hero' as never, 'attack' as never)).toBe(8)
    expect(items.has('sword' as never)).toBe(false)
    party.equip('hero' as never, 'stick' as never) // swaps: the sword goes back
    expect(items.has('sword' as never)).toBe(true)
    expect(party.stat('hero' as never, 'hp' as never)).toBe(20)
    party.restore()
    party.unequip('hero' as never, 'weapon' as never)
    expect(items.has('stick' as never)).toBe(true)
    expect(party.stat('hero' as never, 'attack' as never)).toBe(5)
  })

  it('a member who leaves and comes back keeps their level', () => {
    party.add('anna' as never, { level: 3 })
    expect(party.member('anna' as never)?.xp).toBe(20)
    party.remove('anna' as never)
    party.add('anna' as never)
    expect(party.member('anna' as never)?.level).toBe(3)
  })

  it('skills: own, by level, by quest, from equipment, and taught', () => {
    party.add('hero' as never)
    const skills = () => party.skills('hero' as never) as string[]
    expect(skills()).toEqual(['trip'])
    // A weapon's skill is there only while it is worn.
    items.add('sword' as never)
    party.equip('hero' as never, 'sword' as never)
    expect(skills()).toEqual(['trip', 'slash'])
    party.unequip('hero' as never, 'weapon' as never)
    expect(skills()).toEqual(['trip'])
    // Level 2 brings Strike; a finished quest brings Smite.
    party.giveXp('hero' as never, 10)
    expect(skills()).toEqual(['trip', 'strike'])
    useGameStore.setState((s) => {
      s.quests.letter = { status: 'done', step: null }
    })
    expect(skills()).toEqual(['trip', 'strike', 'smite'])
    // Taught from an event: saved, once, and can be taken back.
    expect(party.learn('hero' as never, 'fire' as never)).toBe(true)
    expect(party.learn('hero' as never, 'fire' as never)).toBe(false)
    expect(party.knows('hero' as never, 'fire' as never)).toBe(true)
    party.forget('hero' as never, 'fire' as never)
    expect(skills()).toEqual(['trip', 'strike', 'smite'])
    // Also for someone who hasn't joined yet (and not for those who can't fight).
    expect(party.learn('anna' as never, 'fire' as never)).toBe(true)
    party.add('anna' as never)
    expect(party.skills('anna' as never)).toEqual(['fire'])
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(party.learn('cat' as never, 'fire' as never)).toBe(false)
  })
})
