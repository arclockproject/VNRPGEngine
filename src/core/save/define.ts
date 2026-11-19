// Types for src/content/save/ (what gets saved, new game, migrations).
import type { Facing } from '../define'
import type { Game } from '../game'
import type { EventRecord } from '../scene/replay'
import type { Stage } from '../scene/stage'
import type { EngineState } from '../stores/game'
import type { BrowserStorage } from './slots'
import type { ThumbnailOptions } from './thumbnail'

/** The engine's part of a save: where the player is. */
export interface EngineSnapshot {
  map: { id: string; params: unknown; x: number; y: number; facing: Facing } | null
  playtimeMs: number
  /** Structures placed in each map (game.structures). Missing in saves made before structures existed. */
  structures?: Record<string, { id: string; structure: string; at: { x: number; y: number } }[]>
  // Added later: missing in older saves (they load with empty values).
  props?: EngineState['props']
  propMemory?: EngineState['propMemory']
  quests?: EngineState['quests']
  clockMinutes?: number
  relationships?: EngineState['relationships']
  money?: number
  shops?: EngineState['shops']
  codex?: EngineState['codex']
  events?: EngineState['events']
  names?: EngineState['names']
  party?: EngineState['party']
  itemsOn?: EngineState['itemsOn']
  timers?: EngineState['timers']
  difficulty?: string
  cycle?: number
  chapter?: string
  /**
   * Mid-scene saves only: the chapter when saved (shown on the slot). `chapter` is the one the
   * event started in; a chapter reached during the event is set again by the replay.
   */
  chapterShown?: string
  /** Titles of the map and the running event when saved (display only: the Saves window). */
  titles?: { map?: string; event?: string }
  places?: EngineState['places']
  recipes?: EngineState['recipes']
  datesRan?: EngineState['datesRan']
  /** VN mode: where the story is in its routes (game.routes). */
  route?: EngineState['route']
  /**
   * VN mode: the stage (background, characters…) carried from the event before. A mid-scene save
   * keeps the one the event started on (the replay does the rest). Missing = an empty stage.
   */
  stage?: Stage
  /** Small JPEG data URL of the screen when it was saved (Saves window). */
  thumbnail?: string
  /** The player's own comment on this save (Saves window). */
  note?: string
  /** The player locked this save: it can't be overwritten or deleted until unlocked. */
  locked?: boolean
  /** The content variants of the build that saved it (src/content/config/variants.ts): group -> value. */
  variants?: Record<string, string>
  /**
   * Saved during an event: everything else in the save is the game as it was when that event
   * started; loading replays the event's record up to the saved line.
   */
  event?: EventRecord
}

export interface SaveFile<D = unknown> {
  /** src/content/config/app.ts saveFormat. */
  format: string
  /** Save data version: only changes when the save shape changes (see src/content/save/migrations). */
  version: number
  /**
   * Game version (package.json, semver) that wrote the save. Informational: shown to the player
   * and in messages. Saves made before this field existed don't have it.
   */
  gameVersion?: string
  /** ISO date. */
  savedAt: string
  engine: EngineSnapshot
  data: D
}

/**
 * Old saves have old shapes that no longer match any type, so migrations work on loose data.
 * Change `data` (and `engine` if map ids were renamed) and return the save.
 */
// biome-ignore lint/suspicious/noExplicitAny: migrations deal with shapes that have no type any more
export type LooseData = { [key: string]: any }
export interface MigratableSave {
  engine: EngineSnapshot
  data: LooseData
}
export type Migration = (save: MigratableSave) => MigratableSave

/** One upgrade step. File vN.ts upgrades a version N-1 save to version N. */
export function defineMigration(migration: Migration): Migration {
  return migration
}

/**
 * One upgrade step for the persistent data (read lines, unlocks, achievements). File
 * save/persistent_migrations/vN.ts upgrades version N-1 to N. `data` is the old shape.
 */
export type PersistentMigration = (data: LooseData) => LooseData

export function definePersistentMigration(migration: PersistentMigration): PersistentMigration {
  return migration
}

export interface SaveConfig<D> {
  /** The saved game data of a brand new game: flags, inventory, stats, anything. */
  initial: () => D
  /** Starts a new game (after data is reset to `initial`), e.g. go to the first map. May be async. */
  newGame: (game: Game) => void
  /**
   * Runs on every loaded save after all migrations, before the game uses it.
   * Fix up or fill in anything here. Return the save.
   */
  beforeLoad?: (save: SaveFile<D>) => SaveFile<D>
  /** Runs once the loaded game is on screen. May be async. */
  afterLoad?: (game: Game) => void
  /** How many manual slots there are (slot1, slot2, ...). The Saves window pages through them. */
  slots: number
  /**
   * Browser build only: how much fits in the browser's storage. The game offers only as many
   * slots as fit: (storage - reserved) / perSave boxes, autosave and quick save included.
   * Leave it out to offer every slot in the browser too.
   */
  browser?: BrowserStorage
  /** The picture in each save slot. Leave it out for 256 px wide, quality 0.72. */
  thumbnail?: ThumbnailOptions
  /** Longest note a player can write on a save, in characters. Default 40. */
  noteMax?: number
  /** When to save to the 'auto' slot. Leave it out for no autosave. */
  autosave?: Autosave
}

/**
 * Moments that write the 'auto' slot. A moment where saving isn't possible (see game.save.canSave)
 * is skipped, not retried. Loading a save never autosaves.
 */
export interface Autosave {
  /** After every finished map change. */
  mapChange?: boolean
  /** When a scene (event) ends and the player is back on the map. */
  eventEnd?: boolean
  /** When a minigame or battle ends. */
  minigameEnd?: boolean
  /** When the last open window closes (after shopping, changing equipment...). */
  windowsClosed?: boolean
  /** When the game goes to the background or is being closed (phones, switching apps). */
  appHidden?: boolean
  /** Every this many minutes of play without any save. 0 or missing = never. */
  everyMinutes?: number
}

export function defineSave<D>(config: SaveConfig<D>): SaveConfig<D> {
  return config
}
