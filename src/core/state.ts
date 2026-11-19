// game.state: read and change the saved game data from anywhere.
import { type GameData, useGameStore } from './stores/game'

export const state = {
  /** The current game data (read only; use update() to change it). */
  get(): GameData {
    return useGameStore.getState().data
  },

  /** Changes game data: game.state.update((d) => { d.flags.met_anna = true }) */
  update(recipe: (data: GameData) => void): void {
    useGameStore.setState((s) => {
      recipe(s.data)
    })
  },
}

/**
 * React: re-renders when the selected value changes.
 * Select single values (or use zustand's useShallow) rather than building new objects.
 */
export function useGameData<T>(selector: (data: GameData) => T): T {
  return useGameStore((s) => selector(s.data))
}
