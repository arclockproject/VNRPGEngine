// game.battles: turn-based fights against enemies (src/content/enemies) with the party.
// Rules: core/battle/engine.ts. Screen: the 'battle' minigame (src/content/minigames/battle).
import battleConfig from '@/content/battle'
import statsConfig from '@/content/stats'
import statusDefs from '@/content/statuses'
import { audio } from '../audio/manager'
import { Battle, createFighter, type Fighter, type Outcome } from '../battle/engine'
import type {
  BattleStats,
  EncounterConfig,
  EnemyConfig,
  ItemConfig,
  SkillConfig,
  StatusConfig,
  TroopConfig,
} from '../define'
import { getGame } from '../gameRef'
import {
  type AudioId,
  type CharacterId,
  characters as characterDefs,
  type EnemyId,
  enemies as enemyDefs,
  type ItemId,
  items as itemDefs,
  skills as skillDefs,
  type TroopId,
  troops as troopDefs,
} from '../registry'
import { gameMark, settleGame } from '../scene/replay'
import type { AsepriteSpriteData } from '../sprite/types'
import { isImageSource } from '../ui/imageSource'
import { difficulty } from './difficulty'
import { itemInfo, items } from './items'
import { money } from './money'
import { party } from './party'

export interface Rewards {
  xp: number
  money: number
  drops: ItemId[]
}

/** What the battle screen gets (game.minigames.start('battle', params)). */
export interface BattleParams {
  battle: Battle
  rewards: Rewards
  /** CSS background of the battle screen (already resolved from a name or an image). */
  background: string
  /** Screen pixels per sprite pixel. */
  spriteScale: number
}

export interface BattleOptions {
  /** Who fights. Or name a `troop`. */
  enemies?: EnemyId[]
  /** A named fight from src/content/troops. What you set here wins over the troop's own. */
  troop?: TroopId
  /** Default true. Boss fights: false. */
  canFlee?: boolean
  /** Music while fighting (default: src/content/battle.ts, else keep the map's). */
  music?: AudioId
  /** A name from content/battle.ts `backgrounds`, an imported image or CSS. Default: its `background`. */
  background?: string
}

const DEFAULT_BACKGROUND = 'linear-gradient(#1b2735, #090a0f)'

/**
 * A battle background as CSS. A name from `named` is looked up first; image URLs (imports) cover
 * the screen; anything else is used as CSS as it is.
 */
export function backgroundCss(value: string | undefined, named: Record<string, string> = {}) {
  const picked = value === undefined ? DEFAULT_BACKGROUND : (named[value] ?? value)
  return isImageSource(picked) ? `center / cover no-repeat url("${picked}"), #090a0f` : picked
}

const enemyDef = (id: EnemyId) => (enemyDefs as Record<string, EnemyConfig>)[id]

const troopDef = (id: string) => (troopDefs as Record<string, TroopConfig>)[id]

/** A troop id or options -> options with the troop's settings filled in. */
function resolveFight(fight: TroopId | BattleOptions): BattleOptions & { enemies: EnemyId[] } {
  const options = typeof fight === 'string' ? { troop: fight } : fight
  const troop = options.troop ? troopDef(options.troop) : undefined
  if (options.troop && !troop) console.warn(`[battles] unknown troop "${options.troop}"`)
  return {
    ...options,
    enemies: options.enemies ?? troop?.enemies ?? [],
    canFlee: options.canFlee ?? troop?.canFlee,
    music: options.music ?? troop?.music,
    background: options.background ?? troop?.background,
  }
}

function partyFighters(): Fighter[] {
  return party.members().map((id) => {
    const m = party.member(id)
    const def = (characterDefs as Record<string, { battle?: BattleStats }>)[id]?.battle
    const wornItems = Object.values(m?.equipment ?? {}).map((item) => itemInfo(item as ItemId))
    const worn = wornItems.map((item) => item.equip)
    // Equipment: element rates multiply, immunities and skills add up.
    const elements: Record<string, number> = { ...def?.elements }
    for (const equip of worn)
      for (const [element, rate] of Object.entries(equip?.elements ?? {}))
        elements[element] = (elements[element] ?? 1) * (rate as number)
    return createFighter({
      key: id,
      side: 'party',
      id,
      name: getGame().t(m?.name ?? id),
      stats: { ...(m?.stats as Record<string, number>) },
      hp: (m?.current as Record<string, number> | undefined)?.hp ?? 0,
      mp: (m?.current as Record<string, number> | undefined)?.mp ?? 0,
      // Their own (level / quest conditions checked now), learned ones and what the equipment gives.
      skills: [...party.skills(id)],
      elements,
      immune: [...(def?.immune ?? []), ...worn.flatMap((equip) => equip?.immune ?? [])],
      passives: [
        ...(def?.passive ? [{ ...def.passive, name: getGame().t(def.passive.name) }] : []),
        ...wornItems.flatMap((item) =>
          item.equip?.battle ? [{ name: getGame().t(item.name), ...item.equip.battle }] : [],
        ),
      ],
    })
  })
}

function enemyFighters(ids: EnemyId[]): Fighter[] {
  const counts = new Map<string, number>()
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1)
  const seen = new Map<string, number>()
  return ids.map((id) => {
    const def: EnemyConfig = enemyDef(id) ?? { name: id, stats: { hp: 1, attack: 1 } }
    const n = (seen.get(id) ?? 0) + 1
    seen.set(id, n)
    // Two slimes: "Slime A", "Slime B".
    const suffix = (counts.get(id) ?? 0) > 1 ? ` ${String.fromCharCode(64 + n)}` : ''
    return createFighter({
      key: `${id}#${n}`,
      side: 'enemy',
      id,
      name: `${getGame().t(def.name)}${suffix}`,
      // Difficulty: × the level's enemyStats (src/content/config/difficulty.ts), never under 1.
      stats: Object.fromEntries(
        Object.entries(def.stats as Record<string, number>).map(([stat, value]) => [
          stat,
          Math.max(1, Math.round(value * difficulty.rate('enemyStats', stat))),
        ]),
      ),
      actions: [...(def.actions ?? [])],
      elements: { ...def.elements },
      immune: [...(def.immune ?? [])],
      passives: def.passive ? [{ ...def.passive, name: getGame().t(def.passive.name) }] : [],
    })
  })
}

/**
 * XP, money and item drops for beating these enemies (drops are rolled now). A troop's `rewards`
 * replace what the enemies give.
 */
export function rollRewards(
  ids: EnemyId[],
  random = Math.random,
  fixed?: TroopConfig['rewards'],
): Rewards {
  const rewards: Rewards = { xp: 0, money: 0, drops: [] }
  if (fixed) {
    rewards.xp = fixed.xp ?? 0
    rewards.money = fixed.money ?? 0
    for (const drop of fixed.drops ?? []) if (random() < drop.chance) rewards.drops.push(drop.item)
    return rewards
  }
  for (const id of ids) {
    const def = enemyDef(id)
    if (!def) continue
    rewards.xp += def.xp ?? 0
    rewards.money += def.money ?? 0
    for (const drop of def.drops ?? []) if (random() < drop.chance) rewards.drops.push(drop.item)
  }
  return rewards
}

let fighting = false

export const battles = {
  /**
   * Fights until one side is down or the party flees. Returns 'win' | 'lose' | 'flee'.
   * `start('wolf_pack')` (a troop from src/content/troops) or `start({ enemies: ['slime'] })`.
   */
  async start(fight: TroopId | BattleOptions): Promise<Outcome> {
    const options = resolveFight(fight)
    if (fighting) throw new Error('A battle is already running')
    const game = getGame()
    const fighters = partyFighters()
    if (fighters.length === 0) {
      console.warn('[battles] the party is empty (game.party.add first)')
      return 'win'
    }
    const unknown = options.enemies.filter((id) => !enemyDef(id))
    if (unknown.length) console.warn(`[battles] unknown enemies: ${unknown.join(', ')}`)

    const battle = new Battle({
      party: fighters,
      enemies: enemyFighters(options.enemies),
      skills: skillDefs as Record<string, SkillConfig>,
      items: itemDefs as Record<string, ItemConfig>,
      statuses: statusDefs as Record<string, StatusConfig>,
      formulas: battleConfig.formulas,
      canFlee: options.canFlee,
      consumeItem: (item) => items.remove(item as ItemId),
      showIntent: battleConfig.showIntent,
    })
    // Lasting statuses (StatusConfig.lasting) carried in from earlier fights.
    for (const f of fighters)
      for (const [status, turns] of Object.entries(party.statuses(f.id as CharacterId)))
        battle.addStatus(f, status, turns)
    const rewards = rollRewards(
      options.enemies,
      Math.random,
      options.troop ? troopDef(options.troop)?.rewards : undefined,
    )
    rewards.xp = Math.round(rewards.xp * difficulty.rate('xp'))
    rewards.money = Math.round(rewards.money * difficulty.rate('money'))
    const before = audio.currentMusic()
    const music = options.music ?? battleConfig.music
    if (music) audio.music(music, { fadeMs: 400 })

    fighting = true
    // Inside a scene: what this fight changes is stored with the scene's record (see settleGame).
    const mark = gameMark()
    let outcome: Outcome
    try {
      outcome = await game.minigames.start('battle', {
        battle,
        rewards,
        background: backgroundCss(
          options.background ?? battleConfig.background,
          battleConfig.backgrounds,
        ),
        spriteScale: battleConfig.spriteScale ?? 4,
      })
    } finally {
      fighting = false
      if (music) {
        if (before) audio.music(before, { fadeMs: 800 })
        else audio.stopMusic(800)
      }
    }

    // HP and MP carry over to the map. Statuses end with the fight, except `lasting` ones.
    for (const f of battle.side('party', false)) {
      const id = f.id as CharacterId
      party.change(id, 'hp' as never, f.hp - party.current(id, 'hp' as never))
      party.change(id, 'mp' as never, f.mp - party.current(id, 'mp' as never))
      const kept: Record<string, number> = {}
      for (const s of f.statuses)
        if ((statusDefs as Record<string, StatusConfig>)[s.id]?.lasting && f.hp > 0)
          kept[s.id] = s.turns
      party.setStatuses(id, kept)
    }
    if (outcome === 'win') {
      party.giveXp('party', rewards.xp, { notify: true })
      money.add(rewards.money)
      for (const item of rewards.drops) items.add(item, 1, { notify: true })
    }
    // A mid-scene save loaded later skips the fight: this puts back the HP, items and rewards it left.
    settleGame(mark)
    if (outcome === 'lose') {
      // One place for the default: src/content/config/gameover.ts. A game can replace it for battles.
      if (battleConfig.onLose) await battleConfig.onLose(game)
      else await game.gameOver()
    }
    return outcome
  },

  /**
   * Names as written in a .vn file (`battle wolf_pack` / `battle slime, bat`) -> what start() takes.
   * One troop id = that troop with its settings; in a list, a troop id stands for its enemies.
   * A troop wins over an enemy with the same id.
   */
  named(names: (TroopId | EnemyId)[]): TroopId | BattleOptions {
    const [only] = names
    if (names.length === 1 && only && troopDef(only)) return only as TroopId
    return {
      enemies: names.flatMap((name) => troopDef(name)?.enemies ?? [name as EnemyId]),
    }
  },

  /** A random fight from an encounter zone. */
  encounter(config: EncounterConfig): Promise<Outcome> {
    const group = config.groups[Math.floor(Math.random() * config.groups.length)]
    if (!group) return Promise.resolve('win')
    return battles.start(
      typeof group === 'string'
        ? { troop: group, background: config.background }
        : { enemies: group, background: config.background },
    )
  },

  /** An enemy's definition (name, image, colour…). */
  enemyInfo(id: string): EnemyConfig | undefined {
    return enemyDef(id as EnemyId)
  },

  /**
   * A fighter's battle sprite. Characters without one use their map sprite. Undefined = none
   * (enemies may still have a still `image` or a `color`, see enemyInfo).
   */
  sprite(side: 'party' | 'enemy', id: string): AsepriteSpriteData | undefined {
    if (side === 'enemy') return enemyDef(id as EnemyId)?.battleSprite
    const def = (characterDefs as Record<string, { battleSprite?: unknown; sprite?: unknown }>)[id]
    return (def?.battleSprite ?? def?.sprite) as AsepriteSpriteData | undefined
  },

  /** An element's name and colour (src/content/stats.ts `elements`). */
  elementInfo(id: string): { name: string; color?: string } | undefined {
    return (statsConfig.elements as Record<string, { name: string; color?: string }> | undefined)?.[
      id
    ]
  },

  /** A status's definition (src/content/statuses.ts). */
  statusInfo(id: string): StatusConfig | undefined {
    return (statusDefs as Record<string, StatusConfig>)[id]
  },
}
