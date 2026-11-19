// The game's own settings (src/content/settings.ts): game.settings outside React, useGameSetting()
// in React components.
import { type GameSettings, useSettingsStore } from '../stores/settings'

export type GameSettingId = Extract<keyof GameSettings, string>

/** React: a setting of src/content/settings.ts; re-renders when it changes. */
export function useGameSetting<K extends GameSettingId>(id: K): GameSettings[K] {
  return useSettingsStore((s) => s.game[id] as GameSettings[K])
}

export const gameSettings = {
  /** A setting of src/content/settings.ts. */
  get<K extends GameSettingId>(id: K): GameSettings[K] {
    return useSettingsStore.getState().game[id] as GameSettings[K]
  },

  /** Changes it (kept on this device). */
  set<K extends GameSettingId>(id: K, value: GameSettings[K]): void {
    useSettingsStore.setState((s) => {
      ;(s.game as Record<string, unknown>)[id] = value
    })
  },
}
