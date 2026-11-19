// Types for src/content/save/persistent.ts: the game's own data kept across all saves and new games
// on this device (next to read lines, unlocks, achievements). This file must not import content.

export type PersistentValue =
  | boolean
  | number
  | string
  | null
  | PersistentValue[]
  | { [key: string]: PersistentValue }

/** The game's own cross-save data and its starting values (its types come from them). */
export function definePersistent<T extends Record<string, PersistentValue>>(data: T): T {
  return data
}

const kind = (value: unknown) =>
  value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value

/**
 * Stored values on top of the starting values: a value of another kind than its starting value
 * (a number where a string was) is dropped, and keys no longer listed are dropped too.
 */
export function mergePersistentGame<T extends Record<string, PersistentValue>>(
  defaults: T,
  stored: unknown,
): T {
  const merged = structuredClone(defaults)
  if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
    for (const [key, value] of Object.entries(stored as Record<string, unknown>)) {
      if (key in defaults && (defaults[key] === null || kind(value) === kind(defaults[key]))) {
        ;(merged as Record<string, unknown>)[key] = value
      }
    }
  }
  return merged
}
