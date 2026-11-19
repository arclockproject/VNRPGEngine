// Items, stats, party, equipment and battles. Part of core/define.ts (import from there).
import type { Battle, Fighter } from '../battle/engine'
import type { Formulas } from '../battle/formulas'
import type { Game } from '../game'
import type {
  AudioId,
  ElementId,
  EnemyId,
  ItemId,
  QuestId,
  SkillId,
  SlotId,
  StatId,
  StatusId,
  TroopId,
} from '../registry'
import type { AsepriteSpriteData } from '../sprite/types'
import type { LightConfig } from './maps'

// ---------------------------------------------------------------- items

export interface ItemContext {
  game: Game
  /** The item this is about. */
  id: ItemId
}

/** For onObtain / onLose. */
export interface ItemChangeContext extends ItemContext {
  /** How many were gained or lost just now. */
  count: number
  /** How many the player carries now. */
  total: number
}

/** An item the player can carry (src/content/items/<id>). Inventory counts are saved. */
export interface ItemConfig {
  name: string
  description?: string
  /** Image URL (import icon from '../icon.svg'). */
  icon?: string
  /** Most the player can carry. Default 99. */
  max?: number
  /** Price in shops. */
  price?: number
  /** Wearable: game.party.equip('hero', 'wooden_sword'). */
  equip?: EquipConfig
  /** Usable in battle (one is used up). `target` defaults to 'ally'. */
  battle?: { target?: BattleTarget; effects: BattleEffect[] }
  /**
   * Using it from the inventory. One is used up afterwards unless `keepOnUse` (letters, tools).
   * May be async; `=> void` on purpose (see map object hooks).
   */
  use?: (ctx: ItemContext) => void
  keepOnUse?: boolean
  /**
   * The player glows with this light in the dark while they carry the item AND it is switched on
   * (game.items.setOn / toggle / isOn; saved). Items start switched off: turn it on in `onObtain`,
   * or let the player do it with `use`.
   */
  light?: LightConfig
  /**
   * Text of the inventory button instead of "Use". A function can depend on the state and returns
   * the finished text: `({ game, id }) => (game.items.isOn(id) ? game.t('Put out') : game.t('Light'))`.
   */
  useLabel?: string | ((ctx: ItemContext) => string)
  /** Whenever some are gained (found, bought, given, taken off as equipment). May be async. */
  onObtain?: (ctx: ItemChangeContext) => void
  /** Whenever some leave the inventory (used up, sold, taken, put on as equipment). May be async. */
  onLose?: (ctx: ItemChangeContext) => void
}

export function defineItem(config: ItemConfig): ItemConfig {
  return config
}

// ---------------------------------------------------------------- stats, party, equipment

/** src/content/stats.ts: the stats, elements, equipment slots and levels of party members. */
export interface StatsConfig<
  S extends string = string,
  Slot extends string = string,
  E extends string = string,
> {
  stats: Record<S, { name: string /** Has a current value (hp 12 / 30). */; pool?: boolean }>
  /** Damage types (fire, ice…): skills name one, fighters can be weak to or resist them. */
  elements?: Record<E, { name: string; color?: string }>
  slots: Record<Slot, string>
  maxLevel: number
  /** Total XP needed to reach a level (level 1 = 0). */
  xpForLevel: (level: number) => number
  maxMembers: number
}

export function defineStats<
  const S extends string,
  const Slot extends string,
  const E extends string = never,
>(config: StatsConfig<S, Slot, E>): StatsConfig<S, Slot, E> {
  return config
}

/**
 * How much damage of each element a fighter takes: 2 = weak (double), 0.5 = resists, 0 = immune.
 * Elements not listed count as 1.
 */
export type ElementRates = Partial<Record<ElementId, number>>

/** A skill a character has from the start, or one that comes with a level and / or a finished quest. */
export type SkillEntry = SkillId | { skill: SkillId; level?: number; quest?: QuestId }

/** A character's numbers as a party member (and in battles). */
export interface BattleStats {
  /** Stats at level 1. Missing = 0. */
  base: Partial<Record<StatId, number>>
  /** Added per level after the first (may be fractional; shown rounded down). */
  growth?: Partial<Record<StatId, number>>
  /**
   * Skills they can use in battle (src/content/skills). An entry can wait for a level or a finished
   * quest: `['heal', { skill: 'fire', level: 5 }, { skill: 'smite', quest: 'jacks_letter' }]`.
   * For anything else, teach it from an event: game.party.learn('anna', 'fire').
   */
  skills?: SkillEntry[]
  elements?: ElementRates
  /** Statuses that never stick to them. */
  immune?: StatusId[]
  /**
   * Something that acts on them by itself in every battle: `onStart` once when the fight begins,
   * `onTurn` at the start of each of their turns. The same effects as skills.
   * `passive: { name: 'Second wind', onTurn: [{ type: 'heal', percent: 0.05 }] }`
   */
  passive?: BattlePassive
}

/** Effects on their owner at the start of a battle and of each of its turns. */
export interface BattlePassive {
  /** Shown in the battle log. */
  name: string
  onStart?: BattleEffect[]
  onTurn?: BattleEffect[]
}

// ---------------------------------------------------------------- battles

/**
 * Who a skill or item affects, seen from the one using it: 'enemy' = one of the other side,
 * 'ally' = one of their own side (themselves included), 'fallen_ally' = one who is down (revive).
 */
export type BattleTarget = 'enemy' | 'all_enemies' | 'ally' | 'all_allies' | 'self' | 'fallen_ally'

/** Options every effect has. */
export interface EffectOptions {
  /** Its own roll, 0..1: the effect only happens this often. Default 1 (always). */
  chance?: number
  /**
   * By default effects are CHAINED to the hit: after a damage effect in the same list misses, the
   * effects that follow are skipped for that target (no poison from a bite that missed).
   * `evenOnMiss: true` makes this one SEPARATE: it runs (and rolls its own `chance`) either way.
   */
  evenOnMiss?: boolean
}

/**
 * One thing a skill or battle item does to each of its targets. They run in order; each can have
 * its own `chance`, and is chained to the hit unless it says `evenOnMiss` (see EffectOptions).
 */
export type BattleEffect = EffectOptions & EffectKind

type EffectKind =
  | {
      type: 'damage'
      /** × the user's `uses` stat. Default 1. */
      power?: number
      /** Fixed damage that ignores stats (items). Used instead of `power`. */
      flat?: number
      /** The user's stat that hits. Default 'attack' (spells: 'magic'). */
      uses?: StatId
      /** The target's stat that protects. Default 'defense' (spells: 'resistance'). */
      against?: StatId
      /** Default: the skill's element. */
      element?: ElementId
      /** Share of the damage the user gets back as HP (0..1). */
      drain?: number
      /**
       * Pure damage: nothing on the target lowers (or raises) it. Its defense / resistance stat, its
       * element rates (weak, resist, immune) and defending are all skipped. With `power` it is the
       * user's stat × power; with `flat` exactly that number.
       */
      pure?: boolean
      /** Default true (false = always hits). */
      canMiss?: boolean
      /** Default true. */
      canCrit?: boolean
    }
  | {
      type: 'heal'
      /** Default 'hp'. */
      pool?: 'hp' | 'mp'
      /** A fixed amount… */
      amount?: number
      /** …plus a share of the target's maximum (0.25 = a quarter)… */
      percent?: number
      /** …plus × the user's magic. */
      power?: number
    }
  | {
      type: 'status'
      status: StatusId
      /** Default: the status's own `turns`. */
      turns?: number
    }
  /** Removes a status ('bad' = every status marked `bad`). */
  | { type: 'cure'; status: StatusId | 'bad' }
  /** Brings a fallen target back with this share of its HP (0..1). */
  | { type: 'revive'; percent: number }
  /** Moves the target's next turn: 1 = one of its turns later, -0.5 = half a turn sooner. */
  | { type: 'delay'; amount: number }
  | {
      type: 'custom'
      run: (ctx: { battle: Battle; actor: Fighter; target: Fighter; random: () => number }) => void
    }

/** A battle skill (src/content/skills/<id>). */
export interface SkillConfig {
  name: string
  description?: string
  /** MP it costs. Default 0. */
  mp?: number
  target: BattleTarget
  /** Element of its damage (src/content/stats.ts `elements`). */
  element?: ElementId
  /** How long until the user's next turn: 1 = normal, 1.5 = slow heavy move, 0.5 = quick. */
  delay?: number
  effects: BattleEffect[]
}

export function defineSkill(config: SkillConfig): SkillConfig {
  return config
}

/**
 * A status a fighter can have during a battle (src/content/statuses.ts). Gone when the fight
 * ends, unless it is `lasting`.
 */
export interface StatusConfig {
  name: string
  description?: string
  /** A character / emoji, or an image URL. */
  icon?: string
  color?: string
  /** Harmful: removed by `{ type: 'cure', status: 'bad' }`. */
  bad?: boolean
  /** How many of the fighter's own turns it lasts: a number, or [min, max] picked at random. */
  turns: number | [number, number]
  /** At the start of each own turn: a share of max HP / MP (-0.1 = loses 10%, 0.1 = regains 10%). */
  tick?: { hp?: number; mp?: number }
  /** Stat multipliers while it lasts: { attack: 1.3, speed: 0.5 }. */
  stats?: Partial<Record<StatId, number>>
  /** 'skip': loses the turn. 'attack_random': attacks anyone. 'no_skills': only Attack/Items. */
  restrict?: 'skip' | 'attack_random' | 'no_skills'
  /** Ends when the fighter takes damage (sleep). */
  wakeOnHit?: boolean
  /**
   * Party members keep it after the fight (with the turns it had left) and start the next fight
   * with it. It ends by running out in a fight, a cure, or game.party.restore() / cure().
   */
  lasting?: boolean
}

export function defineStatuses<const K extends string>(
  config: Record<K, StatusConfig>,
): Record<K, StatusConfig> {
  return config
}

/** One thing an enemy may do on its turn. */
export interface EnemyAction {
  skill: SkillId | 'attack' | 'defend'
  /** How likely compared to its other actions. Default 1. */
  weight?: number
  /** Only when this returns true: `({ self }) => self.hp < 20`. */
  when?: (ctx: { self: Fighter; battle: Battle }) => boolean
}

/** An enemy (src/content/enemies/<id>): game.battles.start({ enemies: ['slime', 'bat'] }). */
export interface EnemyConfig {
  name: string
  /**
   * Animated battle sprite (import from '../battle_sprite/<name>.gen'). Tags: idle, and optionally
   * hurt / attack / down. Drawn facing right (the party stands on the right).
   */
  battleSprite?: AsepriteSpriteData
  /** Drawn when placed on a map (MapObject `enemy`). Default: the battle sprite. */
  sprite?: AsepriteSpriteData
  /** A still picture instead of a sprite. Without either, a blob in `color` is drawn. */
  image?: string
  color?: string
  /** Any stat from src/content/stats.ts. Missing = 0. */
  stats: { hp: number; attack: number } & Partial<Record<StatId, number>>
  elements?: ElementRates
  /** Statuses that never stick to it. */
  immune?: StatusId[]
  /**
   * Acts on the enemy by itself: `onStart` when the fight begins, `onTurn` at the start of each
   * of its turns. `passive: { name: 'Regrowth', onTurn: [{ type: 'heal', amount: 3 }] }`
   */
  passive?: BattlePassive
  /**
   * What it does on its turn: one is picked by `weight` from those it can use (enough MP, `when`
   * true). Without any it always attacks.
   */
  actions?: EnemyAction[]
  /** Rewards when the party wins. */
  xp?: number
  money?: number
  drops?: { item: ItemId; chance: number }[]
}

export function defineEnemy(config: EnemyConfig): EnemyConfig {
  return config
}

/** A named fight (src/content/troops/<id>): game.battles.start('wolf_pack'), or `battle wolf_pack` in a .vn file. */
export interface TroopConfig {
  enemies: EnemyId[]
  /** A name from content/battle.ts `backgrounds`, an image or CSS. */
  background?: string
  music?: AudioId
  /** Default true. Boss fights: false. */
  canFlee?: boolean
  /** Instead of what the enemies give one by one. */
  rewards?: { xp?: number; money?: number; drops?: { item: ItemId; chance: number }[] }
}

export function defineTroop(config: TroopConfig): TroopConfig {
  return config
}

/** src/content/battle.ts */
export interface BattleConfig {
  /** Music while fighting. Default: the map's music keeps playing. */
  music?: AudioId
  /**
   * Named backgrounds: { forest: forestImage, night: 'linear-gradient(#000, #123)' }. Each is an
   * imported image or any CSS background. Battles pick one by name (or take an image/CSS directly).
   */
  backgrounds?: Record<string, string>
  /** Background when a battle doesn't name one: a name from `backgrounds`, an image or CSS. */
  background?: string
  /** Screen pixels per sprite pixel. Default 4. */
  spriteScale?: number
  /** The maths: damage, hit and crit chances, turn speed, fleeing. Leave out what you don't change. */
  formulas?: Partial<Formulas>
  /**
   * After a lost battle (the whole party is down), INSTEAD of the default game over
   * (src/content/config/gameover.ts). May be async.
   */
  onLose?: (game: Game) => void
  /**
   * Enemies show what they will do on their next turn (a small label over them). They then decide
   * one turn ahead instead of on the spot.
   */
  showIntent: boolean
  /** Random battles on maps. */
  encounters: {
    /** Tiles walked after a map change or a battle before the next random battle may start. */
    minSteps: number
    /** Chance per tile for zones without their own `rate` (0..1). */
    rate: number
  }
}

export function defineBattle(config: BattleConfig): BattleConfig {
  return config
}

/** Random battles while walking in an area (MapObject.encounters, or Tiled class "encounter"). */
export interface EncounterConfig {
  /**
   * Possible fights; one is picked at random. Each is a troop (src/content/troops) or a list of
   * enemies: ['wolf_pack', ['slime'], ['slime', 'bat']].
   */
  groups: (TroopId | EnemyId[])[]
  /** Chance per tile walked (0..1). Default: content/battle.ts encounters.rate. */
  rate?: number
  /** Battle background here (a name from content/battle.ts `backgrounds`, an image or CSS). */
  background?: string
}

/** An item that can be worn: its slot and what it adds. */
export interface EquipConfig {
  slot: SlotId
  stats: Partial<Record<StatId, number>>
  elements?: ElementRates
  /** Statuses that never stick to the wearer. */
  immune?: StatusId[]
  /** Battle skills the wearer can use while it is on (a sword's own move). */
  skills?: SkillId[]
  /**
   * Acts on the wearer by itself in battle: `onStart` once when the fight begins, `onTurn` at the
   * start of each of their turns. The same effects as skills: heal, status, damage…
   * `onTurn: [{ type: 'heal', amount: 5 }, { type: 'status', status: 'poison', turns: 1 }]`
   */
  battle?: { onStart?: BattleEffect[]; onTurn?: BattleEffect[] }
}
