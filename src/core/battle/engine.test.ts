import { describe, expect, it } from 'vitest'
import type { ItemConfig, SkillConfig, StatusConfig } from '../define'
import { Battle, type BattleSetup, createFighter, type Fighter } from './engine'
import { DEFAULT_FORMULAS } from './formulas'

const fighter = (
  key: string,
  side: 'party' | 'enemy',
  stats: Record<string, number> = {},
  more: Partial<Fighter> = {},
): Fighter =>
  createFighter({
    key,
    side,
    stats: { hp: 20, mp: 10, attack: 6, defense: 2, magic: 5, resistance: 2, speed: 5, ...stats },
    ...more,
  })

const half = () => 0.5 // no variance, every hit lands, no crits
// Content ids are typed from src/content, so test data is cast.
const skills = {
  fire: {
    name: 'Fire',
    mp: 5,
    target: 'all_enemies',
    element: 'fire',
    effects: [{ type: 'damage', power: 1, uses: 'magic', against: 'resistance' }],
  },
  heal: { name: 'Heal', mp: 4, target: 'ally', effects: [{ type: 'heal', amount: 8 }] },
  venom: { name: 'Venom', target: 'enemy', effects: [{ type: 'status', status: 'poison' }] },
  nap: { name: 'Nap', target: 'enemy', effects: [{ type: 'status', status: 'sleep' }] },
  rush: { name: 'Rush', target: 'self', effects: [{ type: 'status', status: 'haste' }] },
  slam: { name: 'Slam', target: 'enemy', delay: 2, effects: [{ type: 'damage', power: 1 }] },
  trip: { name: 'Trip', target: 'enemy', effects: [{ type: 'delay', amount: 1 }] },
  raise: { name: 'Raise', target: 'fallen_ally', effects: [{ type: 'revive', percent: 0.5 }] },
  leech: { name: 'Leech', target: 'enemy', effects: [{ type: 'damage', power: 1, drain: 0.5 }] },
} as unknown as Record<string, SkillConfig>
const items = {
  apple: { name: 'Apple', battle: { effects: [{ type: 'heal', amount: 10 }] } },
  bomb: { name: 'Bomb', battle: { target: 'enemy', effects: [{ type: 'damage', flat: 7 }] } },
  herb: { name: 'Herb', battle: { effects: [{ type: 'cure', status: 'bad' }] } },
} as unknown as Record<string, ItemConfig>
const statuses = {
  poison: { name: 'Poison', bad: true, turns: 2, tick: { hp: -0.1 } },
  sleep: { name: 'Sleep', bad: true, turns: 3, restrict: 'skip', wakeOnHit: true },
  haste: { name: 'Haste', turns: 2, stats: { speed: 3 } },
} as unknown as Record<string, StatusConfig>

const battle = (setup: Pick<BattleSetup, 'party' | 'enemies'> & Partial<BattleSetup>) =>
  new Battle({ skills, items, statuses, random: half, ...setup })
const keys = (list: Fighter[]) => list.map((f) => f.key)

describe('battle rules', () => {
  it('default damage: attack × power − defense/2; defending halves it; at least 1', () => {
    const hit = (attack: number, defense: number) =>
      DEFAULT_FORMULAS.damage({ attack, defense, power: 1, random: half })
    expect(hit(10, 4)).toBe(8)
    const b = battle({
      party: [fighter('hero', 'party', { attack: 10, speed: 9 })],
      enemies: [fighter('rock', 'enemy', { defense: 4, speed: 8 })],
    })
    b.act({ kind: 'attack', target: 'rock' })
    expect(b.get('rock')?.hp).toBe(12)
    b.act({ kind: 'defend' })
    b.act({ kind: 'attack', target: 'rock' })
    expect(b.get('rock')?.hp).toBe(8) // 8 halved
  })

  it('timeline: fast fighters act more often, and upcoming() shows the order', () => {
    const b = battle({
      party: [fighter('hero', 'party', { speed: 5 })],
      enemies: [fighter('bat', 'enemy', { speed: 30 })],
    })
    // Delays: bat 1000/40 = 25, hero 1000/15 = 66.7. Bat at 25, 50, 75; hero at 66.7.
    expect(keys(b.upcoming(5))).toEqual(['bat', 'bat', 'hero', 'bat', 'bat'])
    expect(b.current()?.key).toBe('bat')
    b.act({ kind: 'defend' })
    expect(b.current()?.key).toBe('bat')
    b.act({ kind: 'defend' })
    expect(b.current()?.key).toBe('hero')
    expect(b.turn).toBe(3)
  })

  it('a slow skill pushes your own next turn back, and the preview shows it', () => {
    const b = battle({
      party: [fighter('hero', 'party', { speed: 6 })],
      enemies: [fighter('slime', 'enemy', { speed: 5, hp: 99 })],
    })
    expect(keys(b.upcoming(4))).toEqual(['hero', 'slime', 'hero', 'slime'])
    expect(keys(b.upcoming(4, { delay: 2 }))).toEqual(['hero', 'slime', 'slime', 'hero'])
    b.act({ kind: 'skill', skill: 'slam', target: 'slime' })
    expect(keys(b.upcoming(3))).toEqual(['slime', 'slime', 'hero'])
  })

  it('the delay effect moves the target later; ties go to the party', () => {
    const b = battle({
      party: [fighter('hero', 'party')],
      enemies: [fighter('slime', 'enemy', { hp: 99 })],
    })
    expect(b.current()?.key).toBe('hero') // same speed: the party first
    const entries = b.act({ kind: 'skill', skill: 'trip', target: 'slime' })
    expect(entries).toContainEqual(expect.objectContaining({ kind: 'delay', targetKey: 'slime' }))
    expect(b.current()?.key).toBe('hero') // the slime lost a turn's worth of time
  })

  it('the fallen are skipped; the last enemy down wins', () => {
    const b = battle({
      party: [fighter('hero', 'party', { speed: 4, attack: 30 })],
      enemies: [fighter('bat', 'enemy', { speed: 5 }), fighter('slime', 'enemy', { speed: 1 })],
    })
    b.act({ kind: 'attack', target: 'hero' })
    expect(b.get('hero')?.hp).toBe(15) // 6 - 1
    const entries = b.act({ kind: 'attack', target: 'slime' })
    expect(entries[0]).toMatchObject({ kind: 'use', actorKey: 'hero' })
    expect(entries[1]).toMatchObject({ kind: 'damage', targetKey: 'slime', down: true })
    expect(keys(b.upcoming(4))).not.toContain('slime')
    b.act({ kind: 'attack', target: 'hero' })
    b.act({ kind: 'attack', target: 'slime' }) // fallen target -> hits the bat instead
    expect(b.outcome).toBe('win')
    expect(b.current()).toBeNull()
  })

  it('skills cost MP, can hit everyone and use magic; heals stop at max; items get used', () => {
    const used: string[] = []
    const b = battle({
      party: [
        fighter('anna', 'party', { speed: 9, mp: 6 }),
        fighter('hero', 'party', {}, { hp: 15 }),
      ],
      enemies: [fighter('a', 'enemy', { speed: 1 }), fighter('b', 'enemy', { speed: 1 })],
      consumeItem: (item) => {
        used.push(item)
        return true
      },
    })
    b.act({ kind: 'skill', skill: 'fire', target: '' }) // magic 5 − resistance 2 / 2 = 4
    expect([b.get('a')?.hp, b.get('b')?.hp, b.get('anna')?.mp]).toEqual([16, 16, 1])
    expect(b.current()?.key).toBe('hero')
    b.act({ kind: 'item', item: 'apple', target: 'hero' }) // 15 + 10, capped at 20
    expect(b.get('hero')?.hp).toBe(20)
    const untilAnna = () => {
      while (b.current()?.key !== 'anna') b.act({ kind: 'skip' })
    }
    untilAnna()
    b.act({ kind: 'item', item: 'bomb', target: 'a' }) // flat: ignores stats
    expect(b.get('a')?.hp).toBe(9)
    expect(used).toEqual(['apple', 'bomb'])
    untilAnna()
    expect(b.act({ kind: 'skill', skill: 'heal', target: 'anna' })[0]).toMatchObject({
      kind: 'fail',
      reason: 'mp',
    })
  })

  it('elements: weak, resist and immune change the damage and the log', () => {
    const b = battle({
      party: [fighter('anna', 'party', { speed: 9, mp: 99, magic: 10 })],
      enemies: [
        fighter('ice', 'enemy', { hp: 99 }, { elements: { fire: 2 } }),
        fighter('lava', 'enemy', { hp: 99 }, { elements: { fire: 0.5 } }),
        fighter('ghost', 'enemy', { hp: 99 }, { elements: { fire: 0 } }),
      ],
    })
    const entries = b.act({ kind: 'skill', skill: 'fire', target: '' }) // base 9
    expect(entries.filter((e) => e.kind === 'damage')).toMatchObject([
      { targetKey: 'ice', amount: 18, rate: 'weak' },
      { targetKey: 'lava', amount: 5, rate: 'resist' },
      { targetKey: 'ghost', amount: 0, rate: 'immune' },
    ])
  })

  it('effects are chained to the hit by default; evenOnMiss and chance make them separate', () => {
    const sk = {
      // Chained: no delay unless the hit lands.
      trip: {
        name: 'Trip',
        target: 'enemy',
        effects: [
          { type: 'damage', power: 1 },
          { type: 'delay', amount: 1 },
        ],
      },
      // Separate: the delay happens either way.
      net: {
        name: 'Net',
        target: 'enemy',
        effects: [
          { type: 'damage', power: 1 },
          { type: 'delay', amount: 1, evenOnMiss: true },
        ],
      },
      // Its own roll: never (0) / always (1).
      luck: {
        name: 'Luck',
        target: 'enemy',
        effects: [
          { type: 'delay', amount: 1, chance: 0 },
          { type: 'heal', amount: 1, chance: 1 },
        ],
      },
    } as unknown as Record<string, SkillConfig>
    const kinds = (skill: string, hitChance: number) =>
      battle({
        party: [fighter('hero', 'party', { speed: 30 })],
        enemies: [fighter('rock', 'enemy', { hp: 99 })],
        skills: sk,
        formulas: { hitChance: () => hitChance },
      })
        .act({ kind: 'skill', skill, target: 'rock' })
        .map((e) => e.kind)
    expect(kinds('trip', 0)).toEqual(['use', 'miss'])
    expect(kinds('trip', 1)).toEqual(['use', 'damage', 'delay'])
    expect(kinds('net', 0)).toEqual(['use', 'miss', 'delay'])
    expect(kinds('luck', 1)).toEqual(['use', 'heal'])
  })

  it('pure damage skips defense, element rates and defending', () => {
    const pure = {
      smite: {
        name: 'Smite',
        target: 'enemy',
        element: 'fire',
        effects: [{ type: 'damage', power: 1, pure: true }],
      },
      sting: { name: 'Sting', target: 'enemy', effects: [{ type: 'damage', flat: 7, pure: true }] },
    } as unknown as Record<string, SkillConfig>
    const b = battle({
      party: [fighter('hero', 'party', { speed: 30, attack: 10 })],
      enemies: [fighter('wall', 'enemy', { hp: 99, defense: 50 }, { elements: { fire: 0 } })],
      skills: pure,
    })
    ;(b.get('wall') as Fighter).defending = true
    const hit = b.act({ kind: 'skill', skill: 'smite', target: 'wall' })[1]
    expect(hit).toMatchObject({ kind: 'damage', amount: 10 }) // the full attack, immune or not
    expect(hit).not.toHaveProperty('rate')
    expect(b.act({ kind: 'skill', skill: 'sting', target: 'wall' })[1]).toMatchObject({ amount: 7 })
  })

  it("crits multiply the damage; misses do nothing and stop the skill's other effects", () => {
    const always = { critChance: () => 1, hitChance: () => 1 }
    const crit = battle({
      party: [fighter('hero', 'party', { speed: 9, attack: 10 })],
      enemies: [fighter('rock', 'enemy', { defense: 4 })],
      formulas: always,
    })
    expect(crit.act({ kind: 'attack', target: 'rock' })[1]).toMatchObject({
      amount: 12,
      crit: true,
    })
    const miss = battle({
      party: [fighter('hero', 'party', { speed: 9 })],
      enemies: [fighter('rock', 'enemy')],
      formulas: { hitChance: () => 0 },
    })
    expect(miss.act({ kind: 'attack', target: 'rock' })[1]).toMatchObject({ kind: 'miss' })
    expect(miss.get('rock')?.hp).toBe(20)
  })

  it('poison ticks at the start of the turn, runs out, and can be cured or resisted', () => {
    const b = battle({
      party: [fighter('hero', 'party', { speed: 9 })],
      enemies: [fighter('slime', 'enemy', { speed: 8 })],
    })
    // The slime is next, so its first tick comes back with this action.
    const entries = b.act({ kind: 'skill', skill: 'venom', target: 'slime' })
    expect(entries).toMatchObject([
      { kind: 'use' },
      { kind: 'status', status: 'poison' },
      { kind: 'tick', targetKey: 'slime', amount: -2 },
    ])
    expect(b.get('slime')?.hp).toBe(18)
    b.act({ kind: 'defend' }) // slime: 1 turn of poison left
    b.act({ kind: 'defend' }) // hero; the slime's second tick comes back with it
    expect(b.get('slime')?.hp).toBe(16)
    const last = b.act({ kind: 'defend' })
    expect(last).toContainEqual(expect.objectContaining({ kind: 'statusEnd', status: 'poison' }))
    expect(b.get('slime')?.statuses).toEqual([])

    const cure = battle({
      party: [fighter('hero', 'party', { speed: 9 })],
      enemies: [fighter('slime', 'enemy', { speed: 1 })],
    })
    cure.addStatus(cure.get('hero') as Fighter, 'poison')
    cure.act({ kind: 'item', item: 'herb', target: 'hero' })
    expect(cure.get('hero')?.statuses).toEqual([])

    const immune = battle({
      party: [fighter('hero', 'party', { speed: 9 })],
      enemies: [fighter('rock', 'enemy', { speed: 1 }, { immune: ['poison'] })],
    })
    expect(immune.act({ kind: 'skill', skill: 'venom', target: 'rock' })[1]).toMatchObject({
      kind: 'status',
      resisted: true,
    })
  })

  it('poison can finish someone off (and the battle)', () => {
    const b = battle({
      party: [fighter('hero', 'party', { speed: 9 })],
      enemies: [fighter('slime', 'enemy', { speed: 8 }, { hp: 1 })],
    })
    const entries = b.act({ kind: 'skill', skill: 'venom', target: 'slime' })
    expect(entries.at(-1)).toMatchObject({ kind: 'tick', down: true })
    expect(b.outcome).toBe('win')
  })

  it('sleep forces a skipped turn and ends when hit', () => {
    const b = battle({
      party: [fighter('hero', 'party', { speed: 9 })],
      enemies: [fighter('slime', 'enemy', { speed: 8, hp: 99 })],
    })
    expect(b.forced()).toBeNull()
    b.act({ kind: 'skill', skill: 'nap', target: 'slime' })
    expect(b.current()?.key).toBe('slime')
    expect(b.forced()).toEqual({ kind: 'skip' })
    expect(b.enemyAction()).toEqual({ kind: 'skip' })
    expect(b.act({ kind: 'skip' })[0]).toMatchObject({ kind: 'skip', status: 'sleep' })
    const entries = b.act({ kind: 'attack', target: 'slime' })
    expect(entries).toContainEqual(expect.objectContaining({ kind: 'statusEnd', status: 'sleep' }))
    expect(b.forced()).toBeNull()
  })

  it("statuses change stats (haste = more turns); the turn it was cast on doesn't count", () => {
    const b = battle({
      party: [fighter('hero', 'party', { speed: 5 })],
      enemies: [fighter('slime', 'enemy', { speed: 5, hp: 99 })],
    })
    const hero = b.get('hero') as Fighter
    b.act({ kind: 'skill', skill: 'rush', target: 'hero' })
    expect(b.stat(hero, 'speed')).toBe(15)
    expect(hero.statuses[0]).toMatchObject({ id: 'haste', turns: 2 })
    // Hasted from this turn on: delay 40 instead of 66.7.
    expect(keys(b.upcoming(5))).toEqual(['slime', 'hero', 'slime', 'hero', 'hero'])
  })

  it('revive brings a fallen ally back; drain heals the attacker', () => {
    const b = battle({
      party: [
        fighter('anna', 'party', { speed: 9 }, { hp: 10 }),
        fighter('hero', 'party', {}, { hp: 0 }),
      ],
      enemies: [fighter('slime', 'enemy', { speed: 1, hp: 99 })],
    })
    expect(keys(b.targets(b.get('anna') as Fighter, 'fallen_ally'))).toEqual(['hero'])
    b.act({ kind: 'skill', skill: 'raise', target: 'hero' })
    expect(b.get('hero')?.hp).toBe(10)
    expect(keys(b.upcoming(6))).toContain('hero')
    while (b.current()?.key !== 'anna') b.act({ kind: 'skip' })
    b.act({ kind: 'skill', skill: 'leech', target: 'slime' }) // 5 damage -> 3 back (rounded)
    expect(b.get('anna')?.hp).toBe(13)
  })

  it('enemies pick from their usable actions by weight, and heal who needs it most', () => {
    const b = battle({
      party: [fighter('hero', 'party', { speed: 1 })],
      enemies: [
        fighter(
          'shaman',
          'enemy',
          { speed: 9 },
          {
            actions: [
              { skill: 'attack', weight: 1 },
              { skill: 'heal' as never, weight: 9, when: ({ battle }) => battle.turn > 1 },
              { skill: 'fire' as never, weight: 99, when: () => false },
            ],
          },
        ),
        fighter('wolf', 'enemy', { speed: 2 }, { hp: 5 }),
      ],
    })
    expect(b.enemyAction()).toEqual({ kind: 'attack', target: 'hero' }) // heal: not on turn 1
    b.act({ kind: 'defend' })
    while (b.current()?.key !== 'shaman') b.act({ kind: 'skip' })
    expect(b.enemyAction()).toEqual({ kind: 'skill', skill: 'heal', target: 'wolf' })
  })

  it('worn equipment acts by itself: onStart once, onTurn at the start of each own turn', () => {
    const ring = {
      name: 'Ring',
      onStart: [{ type: 'status', status: 'haste' }],
      onTurn: [
        { type: 'heal', amount: 3 },
        { type: 'status', status: 'poison', turns: 1 },
      ],
    } as never
    const b = battle({
      party: [fighter('hero', 'party', { speed: 9 }, { hp: 10, passives: [ring] })],
      enemies: [fighter('slime', 'enemy', { speed: 1, hp: 99 })],
    })
    const hero = b.get('hero') as Fighter
    // Start: haste. First turn: +3 HP and poison (which bites from the next turn on).
    expect(hero.hp).toBe(13)
    expect(hero.statuses.map((s) => s.id)).toEqual(['haste', 'poison'])
    expect(b.log.map((e) => e.kind)).toEqual(['passive', 'status', 'passive', 'heal', 'status'])
    const entries = b.act({ kind: 'defend' }) // hasted: the hero is up again
    expect(entries.map((e) => e.kind)).toEqual(['defend', 'tick', 'passive', 'heal', 'status'])
    expect(hero.hp).toBe(14) // 13 - 2 (poison, 10% of 20) + 3
    expect(b.hasStatus(hero, 'poison')).toBe(true) // given again every turn
  })

  it('flee depends on speed and can be turned off; losing everyone = lose', () => {
    const fast = battle({
      party: [fighter('hero', 'party', { speed: 20 })],
      enemies: [fighter('slug', 'enemy', { speed: 1 })],
    })
    expect(fast.fleeChance()).toBe(0.95)
    fast.act({ kind: 'flee' })
    expect(fast.outcome).toBe('flee')

    const boss = battle({
      party: [fighter('hero', 'party', { speed: 1 }, { hp: 1 })],
      enemies: [fighter('boss', 'enemy', { speed: 9, attack: 50 })],
      canFlee: false,
    })
    boss.act(boss.enemyAction())
    expect(boss.outcome).toBe('lose')
  })
})

describe('enemy intent (showIntent)', () => {
  const setup = (showIntent: boolean) =>
    new Battle({
      party: [
        createFighter({ key: 'hero', side: 'party', stats: { hp: 50, attack: 5, speed: 10 } }),
      ],
      enemies: [
        createFighter({
          key: 'slime',
          side: 'enemy',
          stats: { hp: 30, attack: 3, speed: 1, mp: 10 },
          actions: [{ skill: 'spit' as never }],
        }),
      ],
      skills: { spit: { name: 'Spit', target: 'enemy', mp: 4, effects: [{ type: 'damage' }] } },
      items: {},
      random: () => 0.5,
      showIntent,
    })

  it('is off by default: nothing is planned ahead', () => {
    const battle = setup(false)
    expect(battle.intentOf(battle.get('slime') as never)).toBeUndefined()
  })

  it('plans ahead, shows the plan, uses it, then plans again', () => {
    const battle = setup(true)
    const slime = battle.get('slime') as NonNullable<ReturnType<typeof battle.get>>
    expect(battle.intentOf(slime)).toEqual({ kind: 'skill', name: 'Spit' })
    battle.act({ kind: 'defend' }) // hero
    expect(battle.current()?.key).toBe('slime')
    const action = battle.enemyAction()
    expect(action).toEqual({ kind: 'skill', skill: 'spit', target: 'hero' })
    battle.act(action)
    expect(battle.intentOf(slime)).toEqual({ kind: 'skill', name: 'Spit' })
  })

  it('drops a plan that can no longer be done (no MP left)', () => {
    const battle = setup(true)
    const slime = battle.get('slime') as NonNullable<ReturnType<typeof battle.get>>
    slime.mp = 0
    battle.act({ kind: 'defend' })
    expect(battle.enemyAction()).toEqual({ kind: 'attack', target: 'hero' })
  })
})
