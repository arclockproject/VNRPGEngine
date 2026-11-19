// game.save: save slots in localStorage, export/import files, versioned loading, new game.

import difficultyConfig from '@/content/config/difficulty'
import modeConfig from '@/content/config/mode'
import newGamePlusConfig from '@/content/config/newgameplus'
import saveConfig from '@/content/save'
import { saveMigrations } from '@/generated/registry.gen'
import { APP } from '../appInfo'
import { systemVoice } from '../audio/systemVoice'
import { getGame } from '../gameRef'
import { t } from '../lang'
import { startMinutes } from '../managers/clock'
import { dialog } from '../managers/dialog'
import { difficulty } from '../managers/difficulty'
import { events } from '../managers/events'
import { extras } from '../managers/extras'
import { maps } from '../managers/maps'
import { startMoney } from '../managers/money'
import { routes } from '../managers/routes'
import { timers } from '../managers/timers'
import { title } from '../managers/title'
import { windows } from '../managers/windows'
import { applyBundle, type CarryBundle, makeBundle } from '../newgameplus'
import { onBeforeClose, saveTextFile } from '../platform'
import { loadedTitle, type MapId } from '../registry'
import { forgetLog } from '../scene/director'
import {
  beginRewind,
  currentRecording,
  currentRun,
  endRewind,
  forgetPast,
  isCatchingUp,
  isFastForward,
  isWaitingForPlayer,
  type PastScene,
  pastScenes,
  setPlayerChanges,
  setStartCapture,
} from '../scene/replay'
import { captureStage, isEmptyStage, type Stage } from '../scene/stage'
import { emptyEngineState, type GameData, type GameState, useGameStore } from '../stores/game'
import {
  isPersistentFrozen,
  type PersistentState,
  persistentSnapshot,
  replacePersistent,
  usePersistentStore,
} from '../stores/persistent'
import { topLayer, useSystemStore } from '../stores/system'
import { toast } from '../ui/toast'
import { variants } from '../variants'
import { BACKUP_FORMAT, BACKUP_VERSION, type BackupFile, fileKind, parseBackup } from './backup'
import type { Migration, SaveFile } from './define'
import { migrateSave, parseSave, SAVE_FORMAT, SaveError, validateSave } from './format'
import { PERSISTENT_VERSION } from './persistentMigrations'
import { manualSlotCount } from './slots'
import {
  flushStorage,
  onStorageError,
  type StorageKind,
  storage,
  storageFailing,
  storageKind,
} from './storage'
import { DEFAULT_THUMBNAIL, hasOverlay, mapThumbnail, screenThumbnail } from './thumbnail'

const migrations = saveMigrations as Record<number, Migration>

// Unsaved progress: any change to the game data since the last manual save. Time passing
// (playtime, the clock) doesn't count.
let dirty = false
const savedListeners = new Set<(slot: SaveSlot) => void>()
useGameStore.subscribe((state, previous) => {
  for (const key of Object.keys(state) as (keyof typeof state)[]) {
    if (key === 'playtimeMs' || key === 'clockMinutes' || key === 'timers') continue
    if (state[key] !== previous[key]) {
      dirty = true
      return
    }
  }
})
/** The version new saves get: the highest migration number, or 1 without migrations. */
export const SAVE_VERSION = Math.max(1, ...Object.keys(migrations).map(Number))
/** The game's own version (package.json), written into every save for information. */
export const GAME_VERSION = __APP_VERSION__

/**
 * 'auto' is written by autosave; 'quick' by quick save (F5, or Q.Save in a scene); the rest are
 * manual. Saves leave and enter the game only as one whole backup (exportBackup / readBackup).
 */
export type SaveSlot = 'auto' | 'quick' | `slot${number}`
/** Every slot is offered (false in a browser whose storage holds fewer: `browser` in content/save). */
const ALL_SLOTS = Math.max(1, Math.floor(saveConfig.slots))
/**
 * slot1, slot2, ... as many as `slots` in src/content/save/index.ts; in the browser only as many
 * as fit in its storage. Storage is loaded before this file is (main.tsx), so the kind is known.
 */
export const MANUAL_SLOTS: readonly SaveSlot[] = Array.from(
  { length: manualSlotCount(saveConfig.slots, saveConfig.browser, storageKind() === 'files') },
  (_, index): SaveSlot => `slot${index + 1}`,
)
export const SAVE_SLOTS: readonly SaveSlot[] = ['auto', 'quick', ...MANUAL_SLOTS]
/** Where single imported saves used to go (removed): emptied once at start. */
const OLD_IMPORT_KEY = 'save:import'

// While a save is being loaded (or a new game set up) nothing autosaves: the windows closing and
// the map change of a load would overwrite the autosave with the save that was just loaded.
let applying = 0
/** Play time since the last save of any kind (for autosave.everyMinutes). */
let sinceSaveMs = 0

export interface SlotInfo {
  slot: SaveSlot
  savedAt: string
  version: number
  /** Game version that wrote the save (semver), if known. */
  gameVersion: string | null
  mapId: string | null
  /** Title of the map (untranslated), or null in saves made before titles were stored. */
  mapTitle: string | null
  /** Event the save was made in (a mid-scene save), or null. */
  eventId: string | null
  /** Title of that event (untranslated), or null. */
  eventTitle: string | null
  /** Chapter (game.chapters) when saved, or null. */
  chapter: string | null
  playtimeMs: number
  /** Small JPEG (data URL) of the screen when saved, if there is one. */
  thumbnail: string | null
  /** The player's comment on it, or null. */
  note: string | null
  /** Locked by the player: save() and delete() leave it alone. */
  locked: boolean
  /** Which playthrough it is from: 0 = the first, 1 or more = a New Game+ (game.save.cycle()). */
  cycle: number
}

export type SlotStatus = SlotInfo | { slot: SaveSlot; error: string }

/** What a backup file holds, checked and upgraded. Pass it to applyBackup() to store it. */
export interface BackupPlan {
  savedAt: string
  gameVersion: string | null
  /** The saves in the backup (already upgraded to this version). */
  slots: SlotInfo[]
  /** Slots with a save on this device now. applyBackup() replaces or removes all of them. */
  existing: SaveSlot[]
  readonly saves: Partial<Record<SaveSlot, SaveFile<unknown>>>
  readonly persistent: PersistentState
}

const key = (slot: SaveSlot) => `save:${slot}`
const thumbnailOptions = saveConfig.thumbnail ?? DEFAULT_THUMBNAIL

/** Stores text or throws: a full browser storage must never look like a finished import. */
function store(slot: SaveSlot, text: string): void {
  if (!storage.set(key(slot), text)) {
    throw new SaveError('invalid', t("Could not store the save: this device's storage is full."))
  }
}

/**
 * Swaps the map-only picture of a save just written for one of the whole screen (scene, HUD).
 * Nothing happens if the slot was saved again or deleted in the meantime.
 */
async function improveThumbnail(slot: SaveSlot, savedAt: string): Promise<void> {
  const picture = await screenThumbnail(thumbnailOptions)
  const text = storage.get(key(slot))
  if (!picture || !text) return
  try {
    const file = JSON.parse(text) as SaveFile<unknown>
    if (file.savedAt !== savedAt) return
    file.engine.thumbnail = picture
    if (storage.set(key(slot), JSON.stringify(file))) for (const l of savedListeners) l(slot)
  } catch {
    // not a save any more: leave it
  }
}

/** Tells the player (not more than once a minute) that the save files can't be written. */
let lastStorageWarning = 0
function warnStorage(): void {
  const now = Date.now()
  if (now - lastStorageWarning < 60_000 && lastStorageWarning !== 0) return
  lastStorageWarning = now
  toast(t('Could not write the save to this device. Check the free space, then save again.'), {
    ms: 8000,
    kind: 'save',
    params: { result: 'storageFull' },
  })
}

/** Old/foreign save -> current version, then the game's beforeLoad hook. */
function prepare(save: SaveFile<unknown>): SaveFile<GameData> {
  const migrated = migrateSave(save, SAVE_VERSION, migrations) as SaveFile<GameData>
  return saveConfig.beforeLoad ? saveConfig.beforeLoad(migrated) : migrated
}

/** Longest comment on a save, in characters. */
export const SAVE_NOTE_MAX = saveConfig.noteMax ?? 40

function info(slot: SaveSlot, save: SaveFile<unknown>): SlotInfo {
  return {
    slot,
    savedAt: save.savedAt,
    version: save.version,
    gameVersion: save.gameVersion ?? null,
    mapId: save.engine.map?.id ?? null,
    mapTitle: save.engine.titles?.map ?? null,
    eventId: save.engine.event?.id ?? null,
    eventTitle: save.engine.titles?.event ?? null,
    chapter: save.engine.chapterShown ?? save.engine.chapter ?? null,
    playtimeMs: save.engine.playtimeMs,
    thumbnail: save.engine.thumbnail ?? null,
    note: save.engine.note ?? null,
    locked: save.engine.locked === true,
    cycle: save.engine.cycle ?? 0,
  }
}

/** Changes a stored save's own fields (its note, its lock) without loading it. False = no save. */
function editSlot(slot: SaveSlot, edit: (engine: SaveFile<unknown>['engine']) => void): boolean {
  const text = storage.get(key(slot))
  if (!text) return false
  let file: SaveFile<unknown>
  try {
    file = JSON.parse(text) as SaveFile<unknown>
  } catch {
    return false
  }
  edit(file.engine)
  return storage.set(key(slot), JSON.stringify(file))
}

/**
 * `backTo`: the story goes back in time (Back, a jump from the log) to the scene of that run, so
 * only the log lines from that run on are dropped (the replay shows them again) and earlier scenes
 * stay reachable; a real load forgets the whole log and every remembered scene.
 */
async function apply(
  save: SaveFile<GameData>,
  transition: 'fade' | 'instant' = 'fade',
  backTo?: number,
) {
  applying++
  forgetLog(backTo)
  if (backTo === undefined) forgetPast()
  // Back / a log jump: the scene stays on screen until it waits on the line it went back to
  // (scene/replay.ts beginRewind). No frame without the scene, no black cover, no fades again.
  else beginRewind()
  try {
    await applyNow(save, transition)
  } catch (error) {
    endRewind()
    throw error
  } finally {
    applying--
    // Nothing left to wait for (no scene, or a route choice): show the result now.
    if (!isCatchingUp()) endRewind()
  }
}

async function applyNow(save: SaveFile<GameData>, transition: 'fade' | 'instant') {
  routes.stop()
  events.abort()
  windows.closeAll()
  await title.hide()
  const e = save.engine
  useGameStore.setState((s) => {
    s.data = save.data
    Object.assign(s, emptyEngineState(), {
      playtimeMs: e.playtimeMs,
      structures: e.structures ?? {},
      props: e.props ?? {},
      propMemory: e.propMemory ?? {},
      quests: e.quests ?? {},
      clockMinutes: e.clockMinutes ?? emptyEngineState().clockMinutes,
      relationships: e.relationships ?? {},
      money: e.money ?? startMoney(),
      shops: e.shops ?? {},
      codex: e.codex ?? {},
      events: e.events ?? {},
      names: e.names ?? {},
      party: e.party ?? { members: [], data: {} },
      itemsOn: e.itemsOn ?? {},
      timers: e.timers ?? {},
      difficulty: e.difficulty ?? '',
      cycle: e.cycle ?? 0,
      chapter: e.chapter ?? '',
      places: e.places ?? {},
      recipes: e.recipes ?? {},
      datesRan: e.datesRan ?? {},
      route: modeConfig.vnOnly ? (e.route ?? null) : null,
    })
  })
  timers.forgetWaiters()
  const map = save.engine.map
  if (map) {
    const go = maps.go as (id: MapId, options: object) => Promise<void>
    await go(map.id as MapId, {
      params: map.params,
      transition,
      position: { x: map.x, y: map.y, facing: map.facing },
    })
  } else if (modeConfig.vnOnly && e.route) {
    // VN mode: the route replays its way to the box it was at (and that box's scene, mid-scene).
    await routes.resume(e.route, e.event ?? null, e.stage ?? null)
  } else if (modeConfig.vnOnly) {
    await routes.start('common')
  } else {
    await saveConfig.newGame(getGame())
    dirty = false
  }
  // Saved mid-scene: run the event again, instantly, up to the saved line.
  if (save.engine.event && !(modeConfig.vnOnly && e.route)) await events.resume(save.engine.event)
  await saveConfig.afterLoad?.(getGame())
  dirty = false
}

/**
 * Going back in time lands on the moment a line appeared: what the player changed in a window
 * while that line waited ('p' steps at the end) is undone too.
 */
function beforeWait<T extends { k: string }>(steps: T[]): T[] {
  let end = steps.length
  while (end > 0 && steps[end - 1]?.k === 'p') end--
  return steps.slice(0, end)
}

/** A remembered scene has a line or a choice to land on. */
const hasWait = (scene: PastScene) =>
  scene.record.steps.some((step) => step.k === 'l' || step.k === 'c') ||
  (scene.start as SaveFile<GameData>).engine.route?.choosing === true

/** Earlier scenes can be gone into: a route plays and the player is waiting on something. */
function canGoIntoPast(): boolean {
  return useGameStore.getState().route != null && isWaitingForPlayer() && !isFastForward()
}

/**
 * Goes back into a scene that already ended (routes only): to the log line `at`, or (undefined) to
 * its last line. A route choice comes back as that choice, asked again. False when there is none.
 */
async function backIntoPast(at: { run: number; step: number } | undefined): Promise<boolean> {
  if (!canGoIntoPast()) return false
  const scenes = pastScenes()
  const scene = at ? scenes.find((s) => s.run === at.run) : scenes.findLast(hasWait)
  if (!scene || !hasWait(scene)) return false
  const file = structuredClone(scene.start) as SaveFile<GameData>
  if (file.engine.route?.choosing) {
    // A route choice: loading the game as it was then asks it again (no scene record).
    delete file.engine.event
  } else {
    const steps = scene.record.steps
    const end = at ? at.step : steps.findLastIndex((step) => step.k === 'l' || step.k === 'c')
    file.engine.event = { ...scene.record, steps: beforeWait(steps.slice(0, Math.max(0, end))) }
  }
  const run = scene.run
  // That scene (and the ones after it) will be played again from here.
  forgetPast(run)
  await apply(file, 'instant', run)
  return true
}

/** Titles of the map and event (both loaded while they run), for the Saves window. */
function titlesNow(mapId: string | undefined, eventId?: string): { map?: string; event?: string } {
  const map = mapId ? loadedTitle('maps', mapId) : undefined
  const event = eventId ? loadedTitle('events', eventId) : undefined
  return { ...(map ? { map } : {}), ...(event ? { event } : {}) }
}

/** The stage on screen, when there is anything on it (VN routes). */
function stageField(): { stage?: Stage } {
  const stage = captureStage()
  return isEmptyStage(stage) ? {} : { stage: structuredClone(stage) }
}

/** The game right now as a save file (no event record). */
function snapshotNow(): SaveFile<GameData> {
  const map = maps.snapshot()
  const game = useGameStore.getState()
  return {
    format: SAVE_FORMAT,
    version: SAVE_VERSION,
    gameVersion: GAME_VERSION,
    savedAt: new Date().toISOString(),
    engine: {
      map,
      playtimeMs: game.playtimeMs,
      variants: variants.all(),
      structures: structuredClone(game.structures),
      props: structuredClone(game.props),
      propMemory: structuredClone(game.propMemory),
      quests: structuredClone(game.quests),
      clockMinutes: game.clockMinutes,
      relationships: structuredClone(game.relationships),
      money: game.money,
      shops: structuredClone(game.shops),
      codex: structuredClone(game.codex),
      events: structuredClone(game.events),
      names: structuredClone(game.names),
      party: structuredClone(game.party),
      itemsOn: { ...game.itemsOn },
      ...(game.difficulty ? { difficulty: game.difficulty } : {}),
      ...(game.cycle ? { cycle: game.cycle } : {}),
      ...(game.chapter ? { chapter: game.chapter } : {}),
      titles: titlesNow(map?.id),
      ...(game.places && Object.keys(game.places).length > 0 ? { places: { ...game.places } } : {}),
      ...(game.recipes && Object.keys(game.recipes).length > 0
        ? { recipes: { ...game.recipes } }
        : {}),
      ...(game.datesRan && Object.keys(game.datesRan).length > 0
        ? { datesRan: { ...game.datesRan } }
        : {}),
      ...(game.timers && Object.keys(game.timers).length > 0
        ? { timers: structuredClone(game.timers) }
        : {}),
      ...(game.route ? { route: structuredClone(game.route) } : {}),
      // A route carries its stage from one event to the next (scene/stage.ts).
      ...(game.route ? stageField() : {}),
    },
    data: structuredClone(game.data),
  }
}

// When an event starts on a map, remember the game as it is (mid-scene saves start from here).
setStartCapture(() => {
  const s = useSystemStore.getState()
  return (s.map || routes.isRunning()) && s.title === null ? snapshotNow() : null
})

/**
 * The parts of the game a player can change from a window while a scene waits (shop, inventory,
 * party, settings of the run). The clock, timers and the map are left out: they move by themselves.
 */
const PLAYER_KEYS = [
  'data',
  'quests',
  'relationships',
  'money',
  'shops',
  'codex',
  'names',
  'party',
  'itemsOn',
  'difficulty',
  'recipes',
  'places',
] as const satisfies readonly (keyof GameState)[]

// The store keeps unchanged parts as the same object, so comparing references finds what changed.
setPlayerChanges({
  mark: () => {
    const state = useGameStore.getState() as unknown as Record<string, unknown>
    return Object.fromEntries(PLAYER_KEYS.map((key) => [key, state[key]]))
  },
  changed: (mark) => {
    const before = mark as Record<string, unknown>
    const state = useGameStore.getState() as unknown as Record<string, unknown>
    const keys = PLAYER_KEYS.filter((key) => state[key] !== before[key])
    return keys.length === 0
      ? null
      : Object.fromEntries(keys.map((key) => [key, structuredClone(state[key])]))
  },
  restore: (value) => {
    const saved = value as Record<string, unknown>
    useGameStore.setState((s) => {
      for (const key of PLAYER_KEYS)
        if (key in saved)
          (s as unknown as Record<string, unknown>)[key] = structuredClone(saved[key])
    })
  },
})

let started = false

/**
 * A new game; with `carried` a New Game+ (the bundle goes in before the game's own newGame). With
 * `begin` (flowchart jumps) that runs instead of the usual start, and the difficulty is kept.
 */
async function startNewGame(carried?: CarryBundle, begin?: () => Promise<void>): Promise<void> {
  applying++
  forgetPast()
  forgetLog()
  const keptDifficulty = useGameStore.getState().difficulty
  try {
    events.abort()
    routes.stop()
    timers.forgetWaiters()
    windows.closeAll()
    await title.hide()
    useGameStore.setState((s) => {
      s.data = saveConfig.initial()
      Object.assign(s, emptyEngineState(), { clockMinutes: startMinutes(), money: startMoney() })
      if (carried) applyBundle(s, carried)
      if (begin) s.difficulty = keptDifficulty
    })
    if (begin) return await begin()
    // A carried difficulty stands; otherwise the game may ask.
    if (difficultyConfig.askOnNewGame && !carried?.difficulty) await difficulty.ask()
    // VN mode: the story starts at the common route (src/content/routes/common).
    if (modeConfig.vnOnly) await routes.start('common')
    else await saveConfig.newGame(getGame())
  } finally {
    applying--
  }
}

export const save = {
  version: SAVE_VERSION,
  slots: SAVE_SLOTS,
  manualSlots: MANUAL_SLOTS,

  /**
   * Saving works while walking around a map, and during events while a line or choice waits
   * for the player (not in minigames, menus over the title, or while fast-forwarding).
   */
  canSave(): boolean {
    return save.whyCantSave() === null
  },

  /** Why saving isn't possible right now (a short phrase), or null when it is possible. */
  whyCantSave(): string | null {
    const s = useSystemStore.getState()
    if (s.map === null && !routes.isRunning()) return t('not on a map')
    if (s.mapTransition !== null) return t('while the screen changes')
    if (s.minigame !== null) return t('in a minigame')
    if (s.title !== null) return t('on the title screen')
    if (isFastForward() || extras.isReplaying()) return t('while a scene replays')
    if (s.event === null) return null
    if (isWaitingForPlayer() && currentRecording()?.start != null) return null
    return t('while a scene is playing')
  },

  /** Progress that is not in a manual save yet (autosaves don't count). */
  hasUnsavedChanges(): boolean {
    return dirty
  },

  /**
   * Where saves are kept on this device: 'files' (desktop, Android), 'browser' (the browser's
   * storage) or 'memory' (the browser stores nothing: gone when the page closes). `failing` is
   * true while files can't be written, or while the browser's storage is full. `limited` is true when the browser's storage holds fewer
   * slots than the game has.
   */
  storage(): { kind: StorageKind; failing: boolean; limited: boolean } {
    return {
      kind: storageKind(),
      failing: storageFailing(),
      limited: MANUAL_SLOTS.length < ALL_SLOTS,
    }
  },

  /**
   * For things to tell the player once per device: false the first time it is asked about `id`
   * (and remembers it), true from then on.
   */
  noticeSeen(id: string): boolean {
    let seen: string[] = []
    try {
      seen = JSON.parse(storage.get('notices') ?? '[]') as string[]
    } catch {
      // unreadable: start again
    }
    if (seen.includes(id)) return true
    storage.set('notices', JSON.stringify([...seen, id]))
    return false
  },

  /**
   * Calls `listener` after every successful save (including autosaves), and again when the
   * save's picture has been replaced by the full-screen one.
   */
  onSaved(listener: (slot: SaveSlot) => void): () => void {
    savedListeners.add(listener)
    return () => {
      savedListeners.delete(listener)
    }
  },

  /** The current game as a save file (does not store it anywhere). */
  snapshot(): SaveFile<GameData> {
    // A route choice on screen (VN mode) is saved without its scene: loading asks it again.
    const choosing = useGameStore.getState().route?.choosing === true
    const running = useSystemStore.getState().event && !choosing ? currentRecording() : null
    if (running?.start) {
      // Mid-scene: the game as the event found it, plus what happened since.
      const start = structuredClone(running.start) as SaveFile<GameData>
      return {
        ...start,
        savedAt: new Date().toISOString(),
        engine: {
          ...start.engine,
          playtimeMs: useGameStore.getState().playtimeMs,
          event: running.record,
          ...(useGameStore.getState().chapter
            ? { chapterShown: useGameStore.getState().chapter }
            : {}),
          titles: titlesNow(start.engine.map?.id, running.record.id),
        },
      }
    }
    return snapshotNow()
  },

  /** Saves into a slot. Returns false (and does nothing) when saving isn't possible right now. */
  save(slot: SaveSlot = 'slot1'): boolean {
    if (!save.canSave() || save.isLocked(slot)) return false
    const file = save.snapshot()
    // A small picture of the screen for the Saves window: the map at once, then (a moment later)
    // the whole screen with the scene or HUD on it.
    const thumbnail = mapThumbnail(thumbnailOptions)
    if (thumbnail) file.engine.thumbnail = thumbnail
    const ok = storage.set(key(slot), JSON.stringify(file))
    if (ok) {
      sinceSaveMs = 0
      if (slot !== 'auto') dirty = false
      for (const listener of savedListeners) listener(slot)
      if (hasOverlay()) void improveThumbnail(slot, file.savedAt)
    }
    return ok
  },

  /**
   * Saves into the 'auto' slot, if saving is possible right now and no save is being loaded.
   * Returns false when it was skipped. Call it from game code at any moment worth keeping.
   */
  autosave(): boolean {
    return applying === 0 && save.save('auto')
  },

  /**
   * Quick save: writes the 'quick' slot and says so. Resolves false (with the reason on screen)
   * when saving isn't possible right now.
   */
  quickSave(): boolean {
    const why = save.whyCantSave()
    if (why !== null || !save.save('quick')) {
      toast(why ? t("Can't save {why}.", { why }) : t("Couldn't save."), {
        icon: '⚠',
        kind: 'save',
        params: { result: 'quickSaveFailed' },
      })
      return false
    }
    toast(t('Quick save done.'), { icon: '💾', kind: 'save', params: { result: 'quickSaved' } })
    void systemVoice.play('quick_saved')
    return true
  },

  /** Whether there is a quick save to load. */
  hasQuickSave(): boolean {
    return storage.get(key('quick')) !== null
  },

  /**
   * Quick load: asks first (the current progress is lost), then loads the 'quick' slot.
   * Resolves true when it was loaded.
   */
  async quickLoad(): Promise<boolean> {
    if (!save.hasQuickSave()) {
      toast(t('No quick save yet.'), { kind: 'save', params: { result: 'noQuickSave' } })
      return false
    }
    const answer = await dialog.ask(t('Load the quick save? Progress since then is lost.'), {
      load: t('Load'),
      cancel: t('Cancel'),
    })
    if (answer !== 'load') return false
    try {
      await save.load('quick')
      systemVoice.playAfterReplay('quick_loaded')
      return true
    } catch (error) {
      toast(error instanceof Error ? error.message : String(error), {
        icon: '⚠',
        kind: 'save',
        params: { result: 'loadFailed' },
      })
      return false
    }
  },

  /**
   * What is in each slot (empty slots are left out; broken ones report an error). Pass `slots` to
   * read only those (the Saves window reads one page at a time).
   */
  list(slots: readonly SaveSlot[] = SAVE_SLOTS): SlotStatus[] {
    const result: SlotStatus[] = []
    for (const slot of slots) {
      const text = storage.get(key(slot))
      if (!text) continue
      try {
        result.push(info(slot, parseSave(text)))
      } catch (error) {
        result.push({ slot, error: error instanceof Error ? error.message : String(error) })
      }
    }
    return result
  },

  /**
   * During a scene: go back one line (or to the last choice). Restores the game as the event
   * found it and replays it, minus the last step. Resolves false when there is nothing to undo.
   */
  async rollback(): Promise<boolean> {
    // On the first line of a route scene: the last line of the scene before (or its choice).
    if (!save.canRollback()) return backIntoPast(undefined)
    const file = save.snapshot()
    const event = file.engine.event
    if (!event) return false
    const last = event.steps.findLastIndex((step) => step.k === 'l' || step.k === 'c')
    file.engine.event = { ...event, steps: beforeWait(event.steps.slice(0, last)) }
    await apply(file, 'instant', currentRun())
    return true
  },

  /**
   * Goes back to an earlier line of the running scene: `step` is the log entry's `at.step`.
   * False when that is not possible (the line belongs to an earlier scene, or nothing to go back to).
   */
  async rollbackTo(at: { run: number; step: number } | undefined): Promise<boolean> {
    if (at && at.run !== currentRun()) return backIntoPast(at)
    if (!at || !save.canRollback()) return false
    const file = save.snapshot()
    const event = file.engine.event
    if (!event || at.step >= event.steps.length) return false
    file.engine.event = { ...event, steps: beforeWait(event.steps.slice(0, at.step)) }
    await apply(file, 'instant', currentRun())
    return true
  },

  /**
   * Goes back to the last choice the player made (toolbar "Last choice"): it is asked again. In the
   * running scene, else (routes) in the latest remembered scene that had one, or its route choice.
   * False when there is none to go back to.
   */
  async backToChoice(): Promise<boolean> {
    const running = currentRecording()
    if (running && save.canRollback()) {
      const step = running.record.steps.findLastIndex((s) => s.k === 'c')
      if (step >= 0) return save.rollbackTo({ run: currentRun(), step })
    }
    if (!canGoIntoPast()) return false
    for (const scene of [...pastScenes()].reverse()) {
      const step = scene.record.steps.findLastIndex((s) => s.k === 'c')
      if (step >= 0) return backIntoPast({ run: scene.run, step })
      // Its route choice (asked before the scene began) counts too.
      if ((scene.start as SaveFile<GameData>).engine.route?.choosing === true)
        return backIntoPast({ run: scene.run, step: 0 })
    }
    return false
  },

  /**
   * Whether a log line of `at` can be jumped back to: the running scene (while it can go back), or
   * a scene of a route that ended and is still remembered.
   */
  canJumpTo(at: { run: number; step: number } | undefined): boolean {
    if (!at) return false
    if (at.run === currentRun()) return save.canRollback()
    return canGoIntoPast() && pastScenes().some((scene) => scene.run === at.run)
  },

  /** Whether rollback() can go back inside the running scene. */
  canRollback(): boolean {
    const running = currentRecording()
    return (
      !!running?.start &&
      isWaitingForPlayer() &&
      running.record.steps.some((step) => step.k === 'l' || step.k === 'c')
    )
  },

  /** The most recently saved slot, for "Continue". */
  latest(): SlotInfo | null {
    const valid = save.list().filter((s): s is SlotInfo => !('error' in s))
    return valid.sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0] ?? null
  },

  /** Loads a slot: migrates it if old, runs beforeLoad, then puts the player back where they were. */
  async load(slot: SaveSlot): Promise<void> {
    const text = storage.get(key(slot))
    if (!text) throw new SaveError('invalid', `Save slot "${slot}" is empty.`)
    const file = prepare(parseSave(text))
    if (!(await sameVariants(file))) return
    await apply(file)
  },

  /** Deletes a save. False when it is locked (unlock it first). */
  delete(slot: SaveSlot): boolean {
    if (save.isLocked(slot)) return false
    storage.remove(key(slot))
    return true
  },

  /** Whether the player locked this save (it can't be overwritten or deleted). */
  isLocked(slot: SaveSlot): boolean {
    const text = storage.get(key(slot))
    if (!text?.includes('"locked"')) return false
    try {
      return (JSON.parse(text) as SaveFile<unknown>).engine.locked === true
    } catch {
      return false
    }
  },

  /** Locks or unlocks a save (Saves window). False when the slot is empty. */
  setLocked(slot: SaveSlot, locked: boolean): boolean {
    return editSlot(slot, (engine) => {
      if (locked) engine.locked = true
      else delete engine.locked
    })
  },

  /** The player's comment on a save; '' or null removes it. False when the slot is empty. */
  setNote(slot: SaveSlot, note: string | null): boolean {
    const text = note?.trim() ?? ''
    return editSlot(slot, (engine) => {
      if (text) engine.note = text.slice(0, SAVE_NOTE_MAX)
      else delete engine.note
    })
  },

  /**
   * Exports everything worth keeping as one file: every save slot plus the persistent data (read
   * lines, unlocks, achievements). Not the settings, they belong to the device.
   * Resolves false if the player cancelled.
   */
  exportBackup(): Promise<boolean> {
    const saves: Record<string, SaveFile<unknown>> = {}
    for (const slot of SAVE_SLOTS) {
      const text = storage.get(key(slot))
      if (!text) continue
      try {
        saves[slot] = parseSave(text)
      } catch {
        // broken slot: leave it out
      }
    }
    const backup: BackupFile = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      persistentVersion: PERSISTENT_VERSION,
      gameVersion: GAME_VERSION,
      savedAt: new Date().toISOString(),
      saves,
      persistent: persistentSnapshot(),
    }
    const date = backup.savedAt.slice(0, 10)
    return saveTextFile(`${APP.id}-backup-${date}.json`, JSON.stringify(backup))
  },

  /** Whether file text is a backup, a single save, or neither. */
  fileKind,

  /**
   * Reads a backup and upgrades every save in it, without storing anything yet. Throws a SaveError
   * (naming the slot) if any part can't be used, so a backup is used whole or not at all.
   */
  readBackup(text: string): BackupPlan {
    const backup = parseBackup(text)
    const saves: Partial<Record<SaveSlot, SaveFile<unknown>>> = {}
    for (const slot of SAVE_SLOTS) {
      const file = backup.saves[slot]
      if (file === undefined) continue
      try {
        saves[slot] = migrateSave(validateSave(file), SAVE_VERSION, migrations)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        throw new SaveError(
          error instanceof SaveError ? error.code : 'invalid',
          `${slot}: ${message}`,
        )
      }
    }
    const filled = SAVE_SLOTS.filter((slot) => saves[slot])
    return {
      savedAt: backup.savedAt,
      gameVersion: backup.gameVersion ?? null,
      slots: filled.map((slot) => info(slot, saves[slot] as SaveFile<unknown>)),
      existing: SAVE_SLOTS.filter((slot) => storage.get(key(slot)) !== null),
      saves,
      persistent: backup.persistent,
    }
  },

  /**
   * Restores a backup read by readBackup(): this device ends up exactly as the backup was. Every
   * save slot is replaced (slots the backup doesn't have are emptied) and the persistent data is
   * replaced too (lines read, unlocks and achievements not in the backup are gone). Nothing is
   * merged. Returns the slots that now hold a save.
   */
  applyBackup(plan: BackupPlan): SaveSlot[] {
    const written: SaveSlot[] = []
    const before = new Map(SAVE_SLOTS.map((slot) => [slot, storage.get(key(slot))]))
    try {
      // Empty the slots the backup doesn't have first: that makes room for the ones it has.
      for (const slot of SAVE_SLOTS) if (!plan.saves[slot]) storage.remove(key(slot))
      for (const slot of SAVE_SLOTS) {
        const file = plan.saves[slot]
        if (!file) continue
        store(slot, JSON.stringify(file))
        written.push(slot)
      }
    } catch (error) {
      // Didn't fit (a full browser storage): put every slot back as it was, all or nothing.
      for (const slot of SAVE_SLOTS) storage.remove(key(slot))
      for (const [slot, text] of before) if (text !== null) storage.set(key(slot), text)
      throw error
    }
    replacePersistent(plan.persistent)
    return written
  },

  /** Resets game data to `initial` and runs the game's newGame (e.g. go to the first map). */
  newGame(): Promise<void> {
    return startNewGame()
  },

  /**
   * A new game that starts with `begin` instead of the usual start (flowchart jumps: the route
   * replays its way to the picked box). Keeps the difficulty; nothing is carried over.
   */
  newGameWith(begin: () => Promise<void>): Promise<void> {
    return startNewGame(undefined, begin)
  },

  /** Which playthrough this is: 0 = the first, 1 = the first New Game+, … (saved). */
  cycle(): number {
    return useGameStore.getState().cycle ?? 0
  },

  /** Whether a New Game+ can be started (src/content/config/newgameplus.ts). */
  newGamePlusReady(): boolean {
    return newGamePlusConfig.enabled && usePersistentStore.getState().newGamePlus !== undefined
  },

  /**
   * Makes New Game+ available and remembers what it carries over, as the game is right now
   * (call it at the end of the story). Calling it again replaces what is remembered.
   * With `unlock: 'ending'` every ending() does this by itself.
   */
  unlockNewGamePlus(): boolean {
    if (!newGamePlusConfig.enabled || isPersistentFrozen()) return false
    const bundle = makeBundle(useGameStore.getState(), newGamePlusConfig)
    usePersistentStore.setState((s) => {
      s.newGamePlus = bundle
    })
    return true
  },

  /**
   * Starts a new game with what the last unlockNewGamePlus() remembered. Your newGame runs
   * afterwards as usual (game.save.cycle() is 1 or more there). A plain new game if nothing is
   * unlocked.
   */
  newGamePlus(): Promise<void> {
    return startNewGame(
      newGamePlusConfig.enabled ? usePersistentStore.getState().newGamePlus : undefined,
    )
  },

  /** Starts the playtime clock and autosave. Called once from boot.tsx. */
  start(): void {
    // The old "Imported" box is gone: its save would sit unused in storage.
    storage.remove(OLD_IMPORT_KEY)
    if (started) return
    started = true
    const auto = saveConfig.autosave ?? {}
    const everyMs = (auto.everyMinutes ?? 0) * 60_000
    setInterval(() => {
      const s = useSystemStore.getState()
      const playing = s.map !== null && topLayer(s) !== 'title' && !document.hidden
      if (!playing) return
      useGameStore.setState((g) => {
        g.playtimeMs += 1000
      })
      sinceSaveMs += 1000
      if (everyMs > 0 && sinceSaveMs >= everyMs) {
        sinceSaveMs = 0 // skipped or not: the next try is a full interval away
        save.autosave()
      }
    }, 1000)

    if (auto.mapChange) maps.onChange(() => void save.autosave())

    // Files are written in the background: say so when that fails, or "Saved" would be a lie.
    onStorageError(warnStorage)
    // Desktop: the window waits for this before it closes, so the last save reaches the disk.
    onBeforeClose(async () => {
      if (auto.appHidden) save.autosave()
      await flushStorage()
    })

    // The rest are noticed in the screen state. They save a tick later, so the store change that
    // triggered them has finished, and two at once (a window closing as a scene ends) save once.
    let queued = false
    const soon = () => {
      if (queued) return
      queued = true
      setTimeout(() => {
        queued = false
        save.autosave()
      }, 0)
    }
    useSystemStore.subscribe((s, previous) => {
      if (auto.eventEnd && previous.event !== null && s.event === null) soon()
      if (auto.minigameEnd && previous.minigame !== null && s.minigame === null) soon()
      if (auto.windowsClosed && previous.windows.length > 0 && s.windows.length === 0) soon()
    })
    if (auto.appHidden) {
      // At once, not a tick later: a phone may freeze the page right after this.
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) save.autosave()
      })
      window.addEventListener('pagehide', () => void save.autosave())
    }
  },
}

/**
 * A save from another version of the game (content variants: all-ages / adult, a region…): asks
 * before loading it, since some scenes and pictures may differ or be missing. True = go on.
 */
async function sameVariants(file: SaveFile<GameData>): Promise<boolean> {
  const saved = file.engine.variants
  if (!saved) return true
  const now = variants.all()
  const differ = Object.entries(saved).filter(
    ([group, value]) => group in now && now[group] !== value,
  )
  if (differ.length === 0) return true
  const answer = await dialog.ask(
    t(
      'This save was made with another version of the game ({versions}). Some scenes and pictures may be different or missing.',
      { versions: differ.map(([group, value]) => `${group}: ${value}`).join(', ') },
    ),
    { load: t('Load anyway'), cancel: t('Cancel') },
  )
  return answer === 'load'
}
