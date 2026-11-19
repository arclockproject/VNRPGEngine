// Types for src/content/settings.ts: the game's own settings (next to the engine's), per device.
// This file must not import content.

export type GameSettingValue = boolean | number | string

/**
 * The game's own settings and their defaults. The type of each default is the setting's type; a
 * string with a few choices: `hints: 'on' as 'on' | 'off'`.
 */
export function defineSettings<T extends Record<string, GameSettingValue>>(settings: T): T {
  return settings
}

/** Stored values on top of the defaults: unknown keys and values of another type are dropped. */
export function mergeGameSettings<T extends Record<string, GameSettingValue>>(
  defaults: T,
  stored: unknown,
): T {
  const merged = { ...defaults }
  if (stored && typeof stored === 'object') {
    for (const [key, value] of Object.entries(stored as Record<string, unknown>)) {
      if (key in defaults && typeof value === typeof defaults[key]) {
        ;(merged as Record<string, unknown>)[key] = value
      }
    }
  }
  return merged
}
