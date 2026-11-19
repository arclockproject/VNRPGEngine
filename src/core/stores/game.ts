// The saved game data (src/content/save/data.ts) plus what the engine saves. This is what save files store.
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { type GameData, initialData } from '@/content/save/data'

export type { GameData }

/** A structure stamped into a map (game.structures.place). */
export interface StructurePlacement {
  /** Instance id, e.g. 'jacks_house' (unique per map). */
  id: string
  /** Which structure (src/content/structures/<name>). */
  structure: string
  at: { x: number; y: number }
}

/** A prop spawned with game.props.spawn (saved ones only). */
export interface PropPlacement {
  /** Instance id (unique per map). */
  id: string
  /** Which prop (src/content/props/<name>). */
  prop: string
  at: { x: number; y: number }
  facing?: 'up' | 'down' | 'left' | 'right'
  properties?: Record<string, string | number | boolean>
}

export type QuestStatus = 'active' | 'done' | 'failed'

export interface QuestState {
  status: QuestStatus
  /** Current step id (steps before it count as done). Null once finished. */
  step: string | null
}

/** A party member's progress (game.party). Kept after they leave, so they come back the same. */
export interface MemberState {
  level: number
  /** Total XP. */
  xp: number
  /** Current values of pool stats (hp, mp). */
  current: Record<string, number>
  /** Slot -> item id. */
  equipment: Record<string, string>
}

/** One game.timers timer. */
export interface TimerState {
  /** How long it has run, ms. */
  ms: number
  /** Countdowns: where it ends, ms. Missing = counts up. */
  total?: number
  paused: boolean
  show: boolean
  label?: string
  /** Event id started when it runs out. */
  event?: string
  during?: { event?: boolean; minigame?: boolean; window?: boolean }
}

/** Where a visual novel route is (game.routes, VN mode only). */
export interface RouteRun {
  /** The route playing now. */
  id: string
  /** Routes passed before it, oldest first (common, anna, …). */
  from: string[]
  /**
   * Every flag() / check() answer (true / false) and choice() pick (the option key) so far, in
   * order: replays take the same way.
   */
  answers: (boolean | string)[]
  /** A route choice() is on screen (a save made now stores no scene: loading asks again). */
  choosing?: boolean
  /** Keys of the boxes played in this route, in order. The last one is playing (or just ended). */
  visited: string[]
  /** The last box in `visited` has ended. */
  done: boolean
}

/** Everything the engine saves besides the game's own data. */
export interface EngineState {
  /** Time spent in the game (not on the title screen), saved with the game. */
  playtimeMs: number
  /** Placed structures, by map id. Saved, so built things stay built. */
  structures: Record<string, StructurePlacement[]>
  /** Spawned props, by map id. */
  props: Record<string, PropPlacement[]>
  /** Saved values of individual props ("mapId|propId" -> key -> value), e.g. an opened chest. */
  propMemory: Record<string, Record<string, string | number | boolean>>
  /** Quest progress by quest id (quests never started are missing). */
  quests: Record<string, QuestState>
  /** In-game clock: minutes since the start of day 0 (day/night). */
  clockMinutes: number
  /** Relationship points per character (missing = the character's start value). */
  relationships: Record<string, number>
  /** The player's money. */
  money: number
  /** Per shop: items bought on `day` (stock left = stock - sold). */
  shops: Record<string, { day: number; sold: Record<string, number> }>
  /** Journal entries found in this playthrough (codex id -> ISO date). */
  codex: Record<string, string>
  /** Events that ran in this playthrough: how many times started and finished (events.seen). */
  events: Record<string, { started: number; finished: number }>
  /** Names shown for characters, when they differ from their config (renamed, revealed). */
  names: Record<string, string>
  /** Party members in order, and everyone's progress. */
  party: {
    members: string[]
    data: Record<string, MemberState>
    /** Skills taught with game.party.learn(), per character (also ones who aren't members). */
    learned?: Record<string, string[]>
    /** Lasting statuses carried between fights: character -> status id -> turns left. */
    statuses?: Record<string, Record<string, number>>
  }
  /** Items that are switched on (game.items.setOn), e.g. a lit lantern. Missing = off. */
  itemsOn: Record<string, boolean>
  /** game.difficulty: the level id of this playthrough ('' = the default of content/config/difficulty.ts). */
  difficulty?: string
  /** Recipes learned with game.crafting.learn (the ones marked known: false). */
  recipes?: Record<string, true>
  /** Fast-travel places found (game.travel.discover; the ones marked known: false). */
  places?: Record<string, true>
  /** game.chapters: the chapter this playthrough is in. */
  chapter?: string
  /** Named dates with an event (content/config/clock.ts): the day index each last ran on. */
  datesRan?: Record<string, number>
  /** Which playthrough this is: 0 = the first, 1 = the first New Game+ (game.save.cycle()). */
  cycle?: number
  /** game.timers: running countdowns and stopwatches by id. */
  timers?: Record<string, TimerState>
  /** VN mode: where the story is in its routes. Null outside a route (and in the normal game). */
  route?: RouteRun | null
}

export const emptyEngineState = (): EngineState => ({
  playtimeMs: 0,
  structures: {},
  props: {},
  propMemory: {},
  quests: {},
  clockMinutes: 8 * 60,
  relationships: {},
  money: 0,
  shops: {},
  codex: {},
  events: {},
  names: {},
  party: { members: [], data: {} },
  itemsOn: {},
  timers: {},
  difficulty: '',
  cycle: 0,
  datesRan: {},
  recipes: {},
  places: {},
  chapter: '',
  route: null,
})

export interface GameState extends EngineState {
  data: GameData
}

export const useGameStore = create<GameState>()(
  immer(() => ({
    data: initialData(),
    ...emptyEngineState(),
  })),
)
