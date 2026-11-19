// Unlocking something once: achievements, journal (codex) entries, endings and title screens use
// unlockable(); gallery pictures, scenes, music and movies are plain keys (unlockKey) in persistent
// `unlocked`. unlockable(): an unknown id warns and unlocks nothing, it unlocks once (true the
// first time), nothing kept across saves is earned while persistent data is frozen (Extras -> Show
// all; plain keys unlock then and are put back after), and a toast shows unless `notify: false`.
// Must not import content or `game`.
import { cgUnlockKey } from './gallery'
import { isPersistentFrozen, isUnlocked, lock, unlock } from './stores/persistent'
import { type ToastOptions, toast } from './ui/toast'

/** The keys in persistent `unlocked`, one builder per kind. */
export const unlockKey = {
  image: (id: string, variant?: string) => cgUnlockKey(id, variant),
  scene: (id: string) => `scene:${id}`,
  music: (id: string) => `music:${id}`,
  movie: (id: string) => `movie:${id}`,
  ending: (id: string) => `ending:${id}`,
  title: (id: string) => `title:${id}`,
}

/** Where an unlockable keeps what is unlocked. */
export interface UnlockStore<Id extends string> {
  has(id: Id): boolean
  add(id: Id): void
  remove(id: Id): void
}

/** `true` in persistent `unlocked` under key(id), e.g. unlockKey.ending. */
export function persistentFlags<Id extends string>(key: (id: Id) => string): UnlockStore<Id> {
  return {
    has: (id) => isUnlocked(key(id)),
    add: (id) => unlock(key(id)),
    remove: (id) => lock(key(id)),
  }
}

export interface UnlockableConfig<Id extends string> {
  /** For the warning about an unknown id: name 'ending' -> [unlock] unknown ending "x". */
  name: string
  /** False = no such content: it warns and unlocks nothing. */
  exists: (id: Id) => boolean
  store: UnlockStore<Id>
  /** Kept in the save (the journal), not across saves: also unlocks while persistent data is frozen. */
  perSave?: boolean
  /** Shown the first time it unlocks, unless `notify: false`. */
  toast?: (id: Id) => { text: string } & ToastOptions
}

export interface Unlockable<Id extends string> {
  /** Unlocks it (once). True the first time; false if it was unlocked already or can't be. */
  unlock(id: Id, options?: { notify?: boolean }): boolean
  has(id: Id): boolean
  /** Takes the unlock back (dev panel, tests). */
  lock(id: Id): void
}

export function unlockable<Id extends string>(config: UnlockableConfig<Id>): Unlockable<Id> {
  const { store } = config
  return {
    unlock(id, options = {}) {
      if (!config.exists(id)) {
        console.warn(`[unlock] unknown ${config.name} "${id}"`)
        return false
      }
      if (store.has(id) || (!config.perSave && isPersistentFrozen())) return false
      store.add(id)
      if (config.toast && options.notify !== false) {
        const { text, ...shown } = config.toast(id)
        toast(text, shown)
      }
      return true
    },
    has: (id) => store.has(id),
    lock: (id) => store.remove(id),
  }
}
