// The game's own cross-save data (src/content/save/persistent.ts): game.persistent outside React,
// usePersistent() in React components.
import { type PersistentGame, usePersistentStore } from '../stores/persistent'

export type PersistentId = Extract<keyof PersistentGame, string>

/** React: a value of src/content/save/persistent.ts; re-renders when it changes. */
export function usePersistent<K extends PersistentId>(id: K): PersistentGame[K] {
  return usePersistentStore((s) => s.game[id] as PersistentGame[K])
}

export const persistentGame = {
  /** A value of src/content/save/persistent.ts (kept across all saves on this device). */
  get<K extends PersistentId>(id: K): PersistentGame[K] {
    return usePersistentStore.getState().game[id] as PersistentGame[K]
  },

  /**
   * Changes it. While a scene plays from Extras → "Show all", changes are undone afterwards (like
   * everything else earned there).
   */
  set<K extends PersistentId>(id: K, value: PersistentGame[K]): void {
    usePersistentStore.setState((s) => {
      ;(s.game as Record<string, unknown>)[id] = structuredClone(value)
    })
  },
}
