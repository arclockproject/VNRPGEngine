// Remembered across all saves and new games, per device: lines already read (skip), unlocked
// gallery images, scenes and title screens, achievements. Not part of save slots.

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import persistentDefaults from '@/content/save/persistent'
import type { LineVoice } from '../audio/voiceClips'
import type { CarryBundle } from '../newgameplus'
import { mergePersistentGame } from '../persistentGame'
import { migratePersistent, PERSISTENT_VERSION } from '../save/persistentMigrations'
import { storage } from '../save/storage'
import { lineHash } from '../scene/lineCode'
import type { Stage } from '../scene/stage'

/** A voiced line the player starred in the log (Extras → Voices). */
export interface FavouriteVoice {
  /** The line's clips (no language: they play in the voice language set now). */
  voices: LineVoice[]
  /** The name and text as they were shown (in the language played then). */
  name: string | null
  color?: string | null
  text: string
}

/** src/content/save/persistent.ts: the game's own cross-save data and its types. */
export type PersistentGame = typeof persistentDefaults

export interface PersistentState {
  /** Read dialogue lines (see lineKey). */
  read: Record<string, true>
  /** Unlocked extras: gallery image ids, scene ids, title screen ids, music heard ('music:<id>'). */
  unlocked: Record<string, true>
  /** Achievement id -> ISO date it was earned. */
  achievements: Record<string, string>
  /** The title screen the player picked (or the last one unlocked). Missing = the newest unlocked. */
  titleScreen?: string
  /** What the next New Game+ starts with (game.save.unlockNewGamePlus). Missing = not unlocked. */
  newGamePlus?: CarryBundle
  /**
   * Flowchart (VN mode): boxes reached in any playthrough, and boxes the player picked in the chart
   * ("route/key" -> time, ms). Optional: missing = nothing seen yet.
   */
  routes?: {
    seen: Record<string, number>
    picked: Record<string, number>
    /** "route/box" -> the stage that box's event ended on (flowchart jumps start from it). */
    stages?: Record<string, Stage>
  }
  /** Favourite voices, oldest first. Optional: missing = none. */
  voices?: FavouriteVoice[]
  /** The game's own cross-save data (src/content/save/persistent.ts): game.persistent. */
  game: PersistentGame
  // Adding or changing a field here: see "Versions and migrations" in docs/systems/saves.html
  // (an upgrade file in src/content/save/persistent_migrations/, and how backups merge it).
}

const STORAGE_KEY = 'persistent'
const empty = (): PersistentState => ({
  read: {},
  unlocked: {},
  achievements: {},
  game: structuredClone(persistentDefaults) as PersistentGame,
})

/** Fills in the game's data: starting values for anything missing or of the wrong kind. */
const withGame = (state: PersistentState): PersistentState => ({
  ...state,
  game: mergePersistentGame(persistentDefaults as PersistentGame, state.game),
})

/** Stored with a `version` (missing = 1) and upgraded on load, like save files. */
function load(): PersistentState {
  let stored: Record<string, unknown>
  try {
    stored = JSON.parse(storage.get(STORAGE_KEY) ?? '{}') as Record<string, unknown>
  } catch {
    return empty()
  }
  const { version, ...data } = stored
  try {
    const from = typeof version === 'number' ? version : 1
    return withGame({ ...empty(), ...migratePersistent(data, from) })
  } catch (error) {
    // Newer than this game, or a broken upgrade step: keep what's there rather than lose it.
    console.error('[persistent] could not upgrade stored data', error)
    return withGame({ ...empty(), ...data } as PersistentState)
  }
}

const write = (state: PersistentState) =>
  storage.set(STORAGE_KEY, JSON.stringify({ version: PERSISTENT_VERSION, ...state }))

export const usePersistentStore = create<PersistentState>()(immer(load))

let saveTimer: ReturnType<typeof setTimeout> | undefined
usePersistentStore.subscribe((state) => {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => write(state), 500)
})

/** A copy of the data, for backups. */
export function persistentSnapshot(): PersistentState {
  return structuredClone(usePersistentStore.getState())
}

/**
 * Replaces all of the data (fields missing from `state` get their empty default) and writes it at
 * once, not after the usual short wait.
 */
export function replacePersistent(state: PersistentState): void {
  usePersistentStore.setState(withGame({ ...empty(), ...structuredClone(state) }), true)
  clearTimeout(saveTimer)
  write(persistentSnapshot())
}

/** Short stable id for a line: event + its source text (so inserting lines elsewhere is fine). */
export function lineKey(eventId: string, text: string): string {
  return `${eventId}#${lineHash(text)}`
}

export const isRead = (key: string) => usePersistentStore.getState().read[key] === true

export function markRead(key: string) {
  if (isRead(key)) return
  usePersistentStore.setState((s) => {
    s.read[key] = true
  })
}

/** Forget everything (dev panel / "reset progress"). */
export function resetPersistent() {
  // Replaced, not merged: the optional fields (routes, voices) go too.
  usePersistentStore.setState(empty(), true)
}

let frozen = false

/**
 * While a scene that isn't unlocked plays (Extras → Show all), nothing may be earned for good.
 * Achievements, endings and title screens check this (core/unlocks.ts unlockable: nothing earned,
 * no toast); the rest (pictures, scenes, read lines…) unlocks as usual and is put back after.
 */
export function setPersistentFrozen(value: boolean): void {
  frozen = value
}
export const isPersistentFrozen = () => frozen

/** Unlocked extras, keys from unlockKey in core/unlocks.ts ('gallery:<id>', 'scene:<id>'…). */
export const isUnlocked = (key: string) => usePersistentStore.getState().unlocked[key] === true

/** Unlocks a key for good. */
export function unlock(key: string) {
  if (isUnlocked(key)) return
  usePersistentStore.setState((s) => {
    s.unlocked[key] = true
  })
}

/** Takes an unlock back (dev panel, tests). */
export function lock(key: string) {
  if (!isUnlocked(key)) return
  usePersistentStore.setState((s) => {
    delete s.unlocked[key]
  })
}
