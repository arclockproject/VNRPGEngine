// game.flags: typed story flags (src/content/flags.ts), stored in the saved game data.
import flagDefaults from '@/content/flags'
import type { FlagValue } from '../define'
import { useGameStore } from '../stores/game'

export type FlagId = keyof typeof flagDefaults & string
export type FlagValueOf<K extends FlagId> = (typeof flagDefaults)[K]
export type BooleanFlagId = { [K in FlagId]: FlagValueOf<K> extends boolean ? K : never }[FlagId]
type NumberFlag = { [K in FlagId]: FlagValueOf<K> extends number ? K : never }[FlagId]

const defaults = flagDefaults as Record<FlagId, FlagValue>

function read(stored: Record<string, FlagValue>, id: FlagId): FlagValue {
  const value = stored[id]
  // A save may hold an older type for a flag (e.g. a string that is now a boolean): use the default.
  return value !== undefined && typeof value === typeof defaults[id] ? value : defaults[id]
}

export const flags = {
  /** Every flag id, in the order of src/content/flags.ts. */
  ids: Object.keys(defaults) as FlagId[],

  get<K extends FlagId>(id: K): FlagValueOf<K> {
    return read(useGameStore.getState().data.flags, id) as FlagValueOf<K>
  },

  set<K extends FlagId>(id: K, value: FlagValueOf<K>): void {
    useGameStore.setState((s) => {
      s.data.flags[id] = value
    })
  },

  toggle(id: BooleanFlagId): boolean {
    const next = !flags.get(id)
    flags.set(id, next as FlagValueOf<typeof id>)
    return next
  },

  /** Adds to a number flag (e.g. a counter) and returns the new value. */
  add(id: NumberFlag, amount = 1): number {
    const next = (flags.get(id) as number) + amount
    flags.set(id, next as FlagValueOf<typeof id>)
    return next
  },

  /** Back to the starting value from src/content/flags.ts. */
  reset(id: FlagId): void {
    useGameStore.setState((s) => {
      delete s.data.flags[id]
    })
  },

  /** All flags with their current values. */
  all(): Record<FlagId, FlagValue> {
    const stored = useGameStore.getState().data.flags
    return Object.fromEntries(flags.ids.map((id) => [id, read(stored, id)])) as Record<
      FlagId,
      FlagValue
    >
  },
}

/** React: a flag's current value (re-renders when it changes). */
export function useFlag<K extends FlagId>(id: K): FlagValueOf<K> {
  return useGameStore((s) => read(s.data.flags, id)) as FlagValueOf<K>
}
