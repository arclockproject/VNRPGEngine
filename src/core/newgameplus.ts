// New Game+: what a finished playthrough hands to the next one. Types for
// src/content/config/newgameplus.ts and the pure carry-over logic. Must not import content.
import type { EngineState, GameData } from './stores/game'

export interface NewGamePlusConfig {
  /** false = the game has no New Game+. */
  enabled: boolean
  /**
   * When it becomes available: 'ending' = as soon as any ending() is reached, 'manual' = only when
   * the game calls game.save.unlockNewGamePlus().
   */
  unlock: 'ending' | 'manual'
  carry: {
    /** Levels, XP, equipment and learned skills of everyone who was ever in the party. */
    party: boolean
    /** × the money carried (1 = all of it, 0 = none). */
    money: number
    /** The bag. Worn equipment goes with `party`. */
    items: boolean
    /** Item ids left behind even with `items` (keys, quest items). */
    itemsExcept: readonly string[]
    /** Journal entries found. */
    codex: boolean
    /** Relationship points. */
    relationships: boolean
    /** The difficulty level. */
    difficulty: boolean
    /** Flag names kept (src/content/flags.ts). Everything else starts fresh. */
    flags: readonly string[]
    /** Other top-level keys of the game's own data (src/content/save/data.ts) copied whole. */
    data: readonly string[]
  }
}

export function defineNewGamePlus(config: NewGamePlusConfig): NewGamePlusConfig {
  return config
}

/** What is kept between playthroughs (stored outside the save slots). */
export interface CarryBundle {
  /** Which playthrough the NEXT game is: 1 = the first New Game+. */
  cycle: number
  money?: number
  party?: Pick<EngineState['party'], 'data' | 'learned'>
  items?: Record<string, number>
  codex?: EngineState['codex']
  relationships?: EngineState['relationships']
  difficulty?: string
  flags?: Record<string, boolean | number | string>
  data?: Record<string, unknown>
}

type Carried = EngineState & { data: GameData }

/** Picks what the config carries out of a game in progress. */
export function makeBundle(state: Carried, config: NewGamePlusConfig): CarryBundle {
  const { carry } = config
  const data = state.data as Record<string, unknown>
  const bundle: CarryBundle = { cycle: (state.cycle ?? 0) + 1 }
  if (carry.money > 0) bundle.money = Math.floor(state.money * carry.money)
  if (carry.party) {
    // Pools are left out: everyone starts the next game rested.
    const members = Object.fromEntries(
      Object.entries(state.party.data).map(([id, m]) => [id, { ...m, current: {} }]),
    )
    bundle.party = {
      data: members,
      ...(state.party.learned ? { learned: state.party.learned } : {}),
    }
  }
  if (carry.items) {
    const inventory = (data.inventory ?? {}) as Record<string, number>
    bundle.items = Object.fromEntries(
      Object.entries(inventory).filter(([id]) => !carry.itemsExcept.includes(id)),
    )
  }
  if (carry.codex) bundle.codex = state.codex
  if (carry.relationships) bundle.relationships = state.relationships
  if (carry.difficulty && state.difficulty) bundle.difficulty = state.difficulty
  if (carry.flags.length > 0) {
    const flags = (data.flags ?? {}) as Record<string, boolean | number | string>
    bundle.flags = Object.fromEntries(
      carry.flags.filter((name) => name in flags).map((name) => [name, flags[name] as boolean]),
    )
  }
  if (carry.data.length > 0)
    bundle.data = Object.fromEntries(
      carry.data.filter((key) => key in data).map((key) => [key, data[key]]),
    )
  return structuredClone(bundle)
}

/** Puts a bundle into a freshly reset game (before the game's own newGame runs). */
export function applyBundle(state: Carried, bundle: CarryBundle): void {
  const carried = structuredClone(bundle)
  const data = state.data as Record<string, unknown>
  state.cycle = carried.cycle
  if (carried.money !== undefined) state.money = carried.money
  if (carried.party) {
    state.party.data = carried.party.data
    if (carried.party.learned) state.party.learned = carried.party.learned
  }
  if (carried.items) data.inventory = { ...(data.inventory as object), ...carried.items }
  if (carried.codex) state.codex = carried.codex
  if (carried.relationships) state.relationships = carried.relationships
  if (carried.difficulty) state.difficulty = carried.difficulty
  if (carried.flags) data.flags = { ...(data.flags as object), ...carried.flags }
  for (const [key, value] of Object.entries(carried.data ?? {})) data[key] = value
}
