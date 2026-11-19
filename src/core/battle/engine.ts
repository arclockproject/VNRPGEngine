// Turn-based battle rules, without UI or game state (tested in engine.test.ts).
// Turns follow a timeline: every fighter has a time of its next turn (`at`); the lowest acts, then
// moves on by formulas.turnDelay(speed) × the action's delay. So fast fighters act more often.
// The UI asks whose turn it is (current()), lets the player pick for the party, calls enemyAction()
// for enemies and forced() for anyone who can't choose (asleep…), and passes the action to act().
import type {
  BattleEffect,
  BattleTarget,
  EnemyAction,
  ItemConfig,
  SkillConfig,
  StatusConfig,
} from '../define'
import { DEFAULT_FORMULAS, type FighterStats, type Formulas } from './formulas'

export type Side = 'party' | 'enemy'
export type Outcome = 'win' | 'lose' | 'flee'

export interface FighterStatus {
  id: string
  /** Own turns left. */
  turns: number
  /** Gained during its own turn: that turn doesn't count. */
  fresh?: boolean
}

/** Effects on their owner when the battle starts and at the start of each of its turns. */
export interface Passive {
  /** Shown in the log (the item's name). */
  name: string
  onStart?: BattleEffect[]
  onTurn?: BattleEffect[]
}

export interface Fighter {
  /** Unique in this battle, e.g. 'hero' or 'slime#2'. */
  key: string
  side: Side
  /** Character or enemy id. */
  id: string
  name: string
  hp: number
  mp: number
  /** Stats before statuses, by stat id (hp and mp are the maximums). Read them with battle.stat(). */
  base: FighterStats
  skills: string[]
  /** Enemies: what they may do (none = always attack). */
  actions: EnemyAction[]
  /** Damage taken per element: 2 = weak, 0.5 = resists, 0 = immune. */
  elements: Record<string, number>
  /** Status ids that never stick. */
  immune: string[]
  /** Things that act on the fighter by themselves (worn equipment): see EquipConfig.battle. */
  passives: Passive[]
  statuses: FighterStatus[]
  defending: boolean
  /** Timeline: when its next turn comes. */
  at: number
  /** Enemies, with BattleSetup.showIntent: what it plans to do on its next turn. */
  intent?: Action
}

/** A fighter with defaults filled in: full HP/MP, no skills, no statuses. */
export function createFighter(
  init: Pick<Fighter, 'key' | 'side'> & { stats: FighterStats } & Partial<
      Omit<Fighter, 'base' | 'statuses' | 'defending' | 'at'>
    >,
): Fighter {
  const { stats, ...rest } = init
  return {
    id: init.key,
    name: init.key,
    hp: Math.max(0, Math.round(stats.hp ?? 1)),
    mp: Math.max(0, Math.round(stats.mp ?? 0)),
    skills: [],
    actions: [],
    elements: {},
    immune: [],
    passives: [],
    ...rest,
    base: { ...stats },
    statuses: [],
    defending: false,
    at: 0,
  }
}

export type Action =
  | { kind: 'attack'; target: string }
  | { kind: 'skill'; skill: string; target: string }
  | { kind: 'item'; item: string; target: string }
  | { kind: 'defend' }
  | { kind: 'flee' }
  /** Loses the turn (asleep, stunned). */
  | { kind: 'skip' }

interface On {
  /** The fighter's name. */
  target: string
  targetKey: string
}

/** What happened, for the UI to show. */
export type LogEntry =
  /** Someone attacks (no `via`) or uses a skill / item. What it did follows. */
  | { kind: 'use'; actor: string; actorKey: string; via?: string }
  /** Something the fighter wears acts on it (`via` = the item). What it did follows. */
  | { kind: 'passive'; actor: string; actorKey: string; via: string }
  | (On & {
      kind: 'damage'
      amount: number
      down: boolean
      crit?: boolean
      /** Its element against this target. */
      rate?: 'weak' | 'resist' | 'immune'
    })
  | (On & { kind: 'miss' })
  | (On & { kind: 'heal'; amount: number; pool: 'hp' | 'mp' })
  /** Gained a status (`resisted`: it didn't stick). */
  | (On & { kind: 'status'; status: string; resisted?: boolean })
  | (On & { kind: 'statusEnd'; status: string })
  /** Poison / regen at the start of a turn: `amount` is negative for damage. */
  | (On & { kind: 'tick'; status: string; amount: number; pool: 'hp' | 'mp'; down: boolean })
  | (On & { kind: 'revive'; amount: number })
  /** Its next turn moved (`amount` > 0 = later). */
  | (On & { kind: 'delay'; amount: number })
  | { kind: 'skip'; actor: string; actorKey: string; status?: string }
  | { kind: 'defend'; actor: string; actorKey: string }
  | { kind: 'flee'; actor: string; actorKey: string; success: boolean }
  | { kind: 'fail'; actor: string; actorKey: string; reason: 'mp' | 'item' | 'skills' }

export interface BattleSetup {
  party: Fighter[]
  enemies: Fighter[]
  skills: Record<string, SkillConfig>
  items: Record<string, ItemConfig>
  statuses?: Record<string, StatusConfig>
  /** Replaces any of the default formulas. */
  formulas?: Partial<Formulas>
  canFlee?: boolean
  /** 0..1, Math.random by default (tests pass their own). */
  random?: () => number
  /** Called when an item is used up (the battle manager removes it from the inventory). */
  consumeItem?: (item: string) => boolean
  /**
   * Enemies decide their next move ahead of time, so the screen can show it (battle.intentOf).
   * Off = they decide when their turn comes (no extra random rolls).
   */
  showIntent?: boolean
}

const ATTACK: BattleEffect[] = [{ type: 'damage', power: 1 }]

export class Battle {
  readonly fighters: Fighter[]
  readonly log: LogEntry[] = []
  readonly formulas: Formulas
  /** How many turns have started. */
  turn = 0
  outcome: Outcome | null = null
  private currentKey = ''
  private readonly random: () => number
  private readonly setup: BattleSetup

  constructor(setup: BattleSetup) {
    this.setup = setup
    this.random = setup.random ?? Math.random
    this.formulas = { ...DEFAULT_FORMULAS, ...setup.formulas }
    this.fighters = [...setup.party, ...setup.enemies]
    for (const f of this.fighters) f.at = this.turnDelay(f)
    for (const f of this.fighters) this.runPassives(f, 'onStart', this.log)
    this.checkOutcome()
    this.begin(this.log)
    this.planIntents()
  }

  /** With showIntent: every enemy without a plan makes one. */
  private planIntents() {
    if (!this.setup.showIntent || this.outcome) return
    for (const enemy of this.side('enemy')) enemy.intent ??= this.choose(enemy)
  }

  /** Is a planned action still possible (enough MP, not silenced, someone to aim at)? */
  private stillValid(actor: Fighter, action: Action): boolean {
    if (action.kind === 'skill') {
      const skill = this.setup.skills[action.skill]
      return (
        !!skill &&
        actor.mp >= (skill.mp ?? 0) &&
        this.canUseSkills(actor) &&
        this.targets(actor, skill.target).length > 0
      )
    }
    if (action.kind === 'attack') return this.targets(actor, 'enemy').length > 0
    return true
  }

  /**
   * What an enemy plans to do next (only with showIntent): the skill's name, or 'attack' /
   * 'defend'. Undefined = nothing to show.
   */
  intentOf(fighter: Fighter): { kind: 'attack' | 'defend' | 'skill'; name?: string } | undefined {
    const intent = fighter.intent
    if (!intent || fighter.hp <= 0) return undefined
    if (intent.kind === 'skill')
      return { kind: 'skill', name: this.setup.skills[intent.skill]?.name ?? intent.skill }
    if (intent.kind === 'attack' || intent.kind === 'defend') return { kind: intent.kind }
    return undefined
  }

  get canFlee() {
    return this.setup.canFlee ?? true
  }

  get(key: string): Fighter | undefined {
    return this.fighters.find((f) => f.key === key)
  }

  side(side: Side, alive = true): Fighter[] {
    return this.fighters.filter((f) => f.side === side && (!alive || f.hp > 0))
  }

  /** Whose turn it is (null once the battle is over). */
  current(): Fighter | null {
    if (this.outcome) return null
    return this.get(this.currentKey) ?? null
  }

  /** A stat right now: the base value × the multipliers of the fighter's statuses. */
  stat(fighter: Fighter, stat: string): number {
    let value = fighter.base[stat] ?? 0
    for (const s of fighter.statuses) {
      const rate = (this.statusInfo(s.id)?.stats as Record<string, number> | undefined)?.[stat]
      if (rate !== undefined) value *= rate
    }
    return value
  }

  /** Every stat right now (what the formulas get). */
  stats(fighter: Fighter): FighterStats {
    const result: FighterStats = {}
    for (const stat of Object.keys(fighter.base)) result[stat] = this.stat(fighter, stat)
    return result
  }

  maxHp(fighter: Fighter): number {
    return Math.max(1, Math.round(this.stat(fighter, 'hp')))
  }

  maxMp(fighter: Fighter): number {
    return Math.max(0, Math.round(this.stat(fighter, 'mp')))
  }

  statusInfo(id: string): StatusConfig | undefined {
    return this.setup.statuses?.[id]
  }

  hasStatus(fighter: Fighter, id: string): boolean {
    return fighter.statuses.some((s) => s.id === id)
  }

  /** False while a status stops this fighter from using skills. */
  canUseSkills(fighter: Fighter): boolean {
    return !fighter.statuses.some((s) => this.statusInfo(s.id)?.restrict === 'no_skills')
  }

  /**
   * The next `count` turns, starting with the current one. `preview.delay` shows the order if the
   * current fighter used an action with that delay (a skill's `delay`).
   */
  upcoming(count: number, preview?: { delay?: number }): Fighter[] {
    const alive = this.fighters.filter((f) => f.hp > 0)
    const current = this.current()
    if (!current || alive.length === 0) return []
    const at = new Map(alive.map((f) => [f.key, f.at]))
    const result: Fighter[] = []
    let next: Fighter = current
    for (let i = 0; i < count; i++) {
      result.push(next)
      const delay = i === 0 ? (preview?.delay ?? 1) : 1
      at.set(next.key, (at.get(next.key) ?? 0) + this.turnDelay(next) * delay)
      next = this.earliest(alive, at)
    }
    return result
  }

  /** Who an action with this target kind can be aimed at, seen from `actor`. */
  targets(actor: Fighter, target: BattleTarget): Fighter[] {
    if (target === 'self') return [actor]
    if (target === 'fallen_ally') return this.side(actor.side, false).filter((f) => f.hp <= 0)
    const own = this.side(actor.side)
    const other = this.side(actor.side === 'party' ? 'enemy' : 'party')
    return target === 'ally' || target === 'all_allies' ? own : other
  }

  /**
   * What the current fighter has to do because of a status, or null when it may choose:
   * asleep / stunned = skip, confused = attack anyone.
   */
  forced(): Action | null {
    const actor = this.current()
    if (!actor) return null
    for (const s of actor.statuses) {
      const restrict = this.statusInfo(s.id)?.restrict
      if (restrict === 'skip') return { kind: 'skip' }
      if (restrict === 'attack_random') {
        const others = this.fighters.filter((f) => f.hp > 0 && f !== actor)
        const target = this.pick(others)
        return target ? { kind: 'attack', target: target.key } : { kind: 'skip' }
      }
    }
    return null
  }

  /** Runs the current fighter's action, then moves to the next turn. Returns what happened. */
  act(action: Action): LogEntry[] {
    const actor = this.current()
    if (!actor) return []
    const entries: LogEntry[] = []
    const who = { actor: actor.name, actorKey: actor.key }
    let delay = 1
    actor.defending = false
    if (action.kind === 'attack') {
      // A named fighter that still stands (a confused fighter may hit its own side), else any foe.
      const named = this.get(action.target)
      const target = named && named.hp > 0 ? named : this.aim(actor, action.target, 'enemy')
      entries.push({ kind: 'use', ...who })
      if (target) this.apply(actor, target, ATTACK, undefined, entries)
    } else if (action.kind === 'defend') {
      actor.defending = true
      entries.push({ kind: 'defend', ...who })
    } else if (action.kind === 'skip') {
      const status = actor.statuses.find((s) => this.statusInfo(s.id)?.restrict === 'skip')
      entries.push({ kind: 'skip', ...who, status: status?.id })
    } else if (action.kind === 'flee') {
      const success = this.canFlee && this.random() < this.fleeChance()
      entries.push({ kind: 'flee', ...who, success })
      if (success) this.outcome = 'flee'
    } else if (action.kind === 'skill') {
      const skill = this.setup.skills[action.skill]
      if (!skill || actor.mp < (skill.mp ?? 0)) {
        entries.push({ kind: 'fail', ...who, reason: 'mp' })
      } else if (!this.canUseSkills(actor)) {
        entries.push({ kind: 'fail', ...who, reason: 'skills' })
      } else {
        actor.mp -= skill.mp ?? 0
        delay = skill.delay ?? 1
        entries.push({ kind: 'use', ...who, via: skill.name })
        for (const target of this.affected(actor, skill.target, action.target))
          this.apply(actor, target, skill.effects, skill.element, entries)
      }
    } else if (action.kind === 'item') {
      const item = this.setup.items[action.item]
      const use = item?.battle
      if (!item || !use || !(this.setup.consumeItem?.(action.item) ?? true)) {
        entries.push({ kind: 'fail', ...who, reason: 'item' })
      } else {
        entries.push({ kind: 'use', ...who, via: item.name })
        for (const target of this.affected(actor, use.target ?? 'ally', action.target))
          this.apply(actor, target, use.effects, undefined, entries)
      }
    }
    if (actor.hp > 0) this.endTurn(actor, entries)
    actor.at += this.turnDelay(actor) * delay
    this.checkOutcome()
    this.begin(entries)
    this.planIntents()
    this.log.push(...entries)
    return entries
  }

  /** An enemy's choice: one of its usable `actions` by weight (none = attack), with a fitting target. */
  enemyAction(): Action {
    const actor = this.current()
    if (!actor) return { kind: 'defend' }
    const forced = this.forced()
    if (forced) return forced
    // A plan made earlier (showIntent) is kept if it still can be done; a fallen target is
    // replaced inside act() / affected().
    const planned = actor.intent
    actor.intent = undefined
    if (planned && this.stillValid(actor, planned)) return planned
    return this.choose(actor)
  }

  /** Picks an action for an enemy: one of its usable `actions` by weight, with a fitting target. */
  private choose(actor: Fighter): Action {
    const foes = this.targets(actor, 'enemy')
    if (foes.length === 0) return { kind: 'defend' }
    const attack: Action = { kind: 'attack', target: (this.pick(foes) as Fighter).key }
    const usable = actor.actions.filter((a) => {
      if (a.when && !a.when({ self: actor, battle: this })) return false
      if (a.skill === 'attack' || a.skill === 'defend') return true
      const skill = this.setup.skills[a.skill]
      return (
        !!skill &&
        actor.mp >= (skill.mp ?? 0) &&
        this.canUseSkills(actor) &&
        this.targets(actor, skill.target).length > 0
      )
    })
    const total = usable.reduce((n, a) => n + (a.weight ?? 1), 0)
    if (total <= 0) return attack
    let roll = this.random() * total
    const chosen = usable.find((a) => {
      roll -= a.weight ?? 1
      return roll < 0
    })
    if (!chosen || chosen.skill === 'attack') return attack
    if (chosen.skill === 'defend') return { kind: 'defend' }
    const skill = this.setup.skills[chosen.skill] as SkillConfig
    const pool = this.targets(actor, skill.target)
    const heals = skill.effects.some((e) => e.type === 'heal')
    const gives = skill.effects.find((e) => e.type === 'status')
    let target: Fighter | undefined
    if (heals) {
      // The one who needs it most.
      const share = (f: Fighter) => f.hp / this.maxHp(f)
      target = pool.reduce((low, f) => (share(f) < share(low) ? f : low))
    } else if (gives) {
      // Someone who doesn't have it yet, if any.
      target = this.pick(pool.filter((f) => !this.hasStatus(f, gives.status)))
    }
    target ??= this.pick(pool) as Fighter
    return { kind: 'skill', skill: chosen.skill, target: target.key }
  }

  fleeChance(): number {
    const avg = (list: Fighter[]) =>
      list.reduce((n, f) => n + this.stat(f, 'speed'), 0) / Math.max(1, list.length)
    return this.formulas.fleeChance(avg(this.side('party')), avg(this.side('enemy')))
  }

  /** Gives a status (or refreshes its turns). False if the fighter is immune or it doesn't exist. */
  addStatus(target: Fighter, id: string, turns?: number): boolean {
    const info = this.statusInfo(id)
    if (!info || target.hp <= 0 || target.immune.includes(id)) return false
    const [min, max] = typeof info.turns === 'number' ? [info.turns, info.turns] : info.turns
    const length = turns ?? min + Math.floor(this.random() * (max - min + 1))
    const fresh = target.key === this.currentKey
    const existing = target.statuses.find((s) => s.id === id)
    if (existing) Object.assign(existing, { turns: length, fresh })
    else target.statuses.push({ id, turns: length, fresh })
    return true
  }

  removeStatus(target: Fighter, id: string): boolean {
    const before = target.statuses.length
    target.statuses = target.statuses.filter((s) => s.id !== id)
    return target.statuses.length < before
  }

  private turnDelay(fighter: Fighter): number {
    return this.formulas.turnDelay(this.stat(fighter, 'speed'))
  }

  private pick<T>(list: T[]): T | undefined {
    return list[Math.floor(this.random() * list.length)]
  }

  /** Lowest time first; ties: the party, then the order they were listed in. */
  private earliest(list: Fighter[], at?: Map<string, number>): Fighter {
    const time = (f: Fighter) => at?.get(f.key) ?? f.at
    return list.reduce((best, f) => {
      if (time(f) !== time(best)) return time(f) < time(best) ? f : best
      return best.side !== 'party' && f.side === 'party' ? f : best
    })
  }

  private aim(actor: Fighter, key: string, kind: BattleTarget): Fighter | undefined {
    const pool = this.targets(actor, kind)
    // A target that fell meanwhile: someone else on that side.
    return pool.find((f) => f.key === key) ?? pool[0]
  }

  private affected(actor: Fighter, kind: BattleTarget, key: string): Fighter[] {
    if (kind === 'all_enemies' || kind === 'all_allies') return this.targets(actor, kind)
    const one = this.aim(actor, key, kind)
    return one ? [one] : []
  }

  /**
   * Runs effects on one target, in order. Each rolls its own `chance`. After a damage effect misses,
   * the following ones are skipped (chained) unless they say `evenOnMiss`; a later hit that lands
   * lets them through again.
   */
  private apply(
    actor: Fighter,
    target: Fighter,
    effects: BattleEffect[],
    element: string | undefined,
    entries: LogEntry[],
  ) {
    const on = { target: target.name, targetKey: target.key }
    let missed = false
    for (const effect of effects) {
      if (missed && !effect.evenOnMiss) continue
      if (effect.chance !== undefined && this.random() >= effect.chance) continue
      if (effect.type === 'revive') {
        if (target.hp > 0) continue
        target.hp = Math.max(1, Math.round(this.maxHp(target) * effect.percent))
        target.at = actor.at + this.turnDelay(target)
        entries.push({ kind: 'revive', ...on, amount: target.hp })
        continue
      }
      if (effect.type === 'custom') {
        effect.run({ battle: this, actor, target, random: this.random })
        continue
      }
      if (target.hp <= 0) continue
      if (effect.type === 'damage') {
        missed = !this.hit(actor, target, effect, effect.element ?? element, entries)
      } else if (effect.type === 'heal') {
        const pool = effect.pool ?? 'hp'
        const max = pool === 'hp' ? this.maxHp(target) : this.maxMp(target)
        const raw =
          (effect.amount ?? 0) +
          (effect.percent ?? 0) * max +
          (effect.power ?? 0) * this.stat(actor, 'magic')
        const amount = Math.max(0, Math.min(max - target[pool], Math.round(raw)))
        target[pool] += amount
        entries.push({ kind: 'heal', ...on, amount, pool })
      } else if (effect.type === 'status') {
        if (!this.statusInfo(effect.status)) continue
        const stuck = this.addStatus(target, effect.status, effect.turns)
        entries.push({ kind: 'status', ...on, status: effect.status, resisted: !stuck })
      } else if (effect.type === 'cure') {
        const gone = target.statuses.filter((s) =>
          effect.status === 'bad' ? this.statusInfo(s.id)?.bad : s.id === effect.status,
        )
        for (const s of gone) {
          this.removeStatus(target, s.id)
          entries.push({ kind: 'statusEnd', ...on, status: s.id })
        }
      } else if (effect.type === 'delay') {
        // Never before "now" (the acting fighter's time).
        target.at = Math.max(actor.at, target.at + effect.amount * this.turnDelay(target))
        entries.push({ kind: 'delay', ...on, amount: effect.amount })
      }
    }
  }

  /** One damage effect. False when it missed. */
  private hit(
    actor: Fighter,
    target: Fighter,
    effect: Extract<BattleEffect, { type: 'damage' }>,
    element: string | undefined,
    entries: LogEntry[],
  ): boolean {
    const on = { target: target.name, targetKey: target.key }
    const f = this.formulas
    const flat = effect.flat !== undefined
    const user = this.stats(actor)
    const foe = this.stats(target)
    if ((effect.canMiss ?? !flat) && this.random() >= f.hitChance(user, foe)) {
      entries.push({ kind: 'miss', ...on })
      return false
    }
    let amount = flat
      ? (effect.flat as number)
      : f.damage({
          attack: user[effect.uses ?? 'attack'] ?? 0,
          defense: effect.pure ? 0 : (foe[effect.against ?? 'defense'] ?? 0),
          power: effect.power ?? 1,
          random: this.random,
        })
    const crit = !flat && (effect.canCrit ?? true) && this.random() < f.critChance(user, foe)
    if (crit) amount *= f.critMultiplier
    // Pure damage: no defense stat, no element rate (weak, resist, immune), no defending.
    const rate = effect.pure || element === undefined ? 1 : (target.elements[element] ?? 1)
    amount *= rate
    if (target.defending && !effect.pure) amount *= f.defendMultiplier
    amount = rate === 0 ? 0 : Math.min(target.hp, Math.max(1, Math.round(amount)))
    target.hp -= amount
    entries.push({
      kind: 'damage',
      ...on,
      amount,
      down: target.hp <= 0,
      ...(crit ? { crit } : {}),
      ...(rate === 1 ? {} : { rate: rate === 0 ? 'immune' : rate > 1 ? 'weak' : 'resist' }),
    })
    if (target.hp <= 0) {
      target.statuses = []
      target.defending = false
    } else if (amount > 0) {
      for (const s of target.statuses.filter((s) => this.statusInfo(s.id)?.wakeOnHit)) {
        this.removeStatus(target, s.id)
        entries.push({ kind: 'statusEnd', ...on, status: s.id })
      }
    }
    if (effect.drain && amount > 0 && actor.hp > 0) {
      const back = Math.min(this.maxHp(actor) - actor.hp, Math.round(amount * effect.drain))
      actor.hp += back
      if (back > 0)
        entries.push({
          kind: 'heal',
          target: actor.name,
          targetKey: actor.key,
          amount: back,
          pool: 'hp',
        })
    }
    return true
  }

  /** After a fighter acted: its statuses lose a turn (not the ones it gained this turn). */
  private endTurn(actor: Fighter, entries: LogEntry[]) {
    for (const s of [...actor.statuses]) {
      if (s.fresh) {
        s.fresh = false
        continue
      }
      s.turns--
      if (s.turns <= 0) {
        this.removeStatus(actor, s.id)
        entries.push({ kind: 'statusEnd', target: actor.name, targetKey: actor.key, status: s.id })
      }
    }
  }

  /** Worn equipment acting on its wearer (EquipConfig.battle). */
  private runPassives(fighter: Fighter, when: 'onStart' | 'onTurn', entries: LogEntry[]) {
    for (const passive of fighter.passives) {
      const effects = passive[when]
      if (!effects?.length || fighter.hp <= 0) continue
      entries.push({
        kind: 'passive',
        actor: fighter.name,
        actorKey: fighter.key,
        via: passive.name,
      })
      this.apply(fighter, fighter, effects, undefined, entries)
    }
  }

  /** Starts the next turn: picks who is up and runs their poison / regen. Skips who falls to it. */
  private begin(entries: LogEntry[]) {
    while (!this.outcome) {
      const alive = this.fighters.filter((f) => f.hp > 0)
      if (alive.length === 0) return
      const fighter = this.earliest(alive)
      this.currentKey = fighter.key
      this.turn++
      const on = { target: fighter.name, targetKey: fighter.key }
      for (const s of fighter.statuses) {
        const tick = this.statusInfo(s.id)?.tick
        for (const pool of ['hp', 'mp'] as const) {
          const share = tick?.[pool]
          if (!share || fighter.hp <= 0) continue
          const max = pool === 'hp' ? this.maxHp(fighter) : this.maxMp(fighter)
          const wanted = Math.sign(share) * Math.max(1, Math.round(Math.abs(share) * max))
          const amount = Math.max(-fighter[pool], Math.min(max - fighter[pool], wanted))
          fighter[pool] += amount
          if (amount !== 0)
            entries.push({
              kind: 'tick',
              ...on,
              status: s.id,
              amount,
              pool,
              down: fighter.hp <= 0,
            })
        }
      }
      if (fighter.hp > 0) this.runPassives(fighter, 'onTurn', entries)
      if (fighter.hp > 0) return
      fighter.statuses = []
      this.checkOutcome()
    }
  }

  private checkOutcome() {
    if (this.outcome) return
    if (this.side('enemy').length === 0) this.outcome = 'win'
    else if (this.side('party').length === 0) this.outcome = 'lose'
  }
}
