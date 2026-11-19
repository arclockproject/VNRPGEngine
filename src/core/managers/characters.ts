// game.characters: the names the player sees. A character can start hidden ("???"), be renamed
// (a fake name), and be revealed (the real name, which then sticks). Saved with the game.
import { t } from '../lang'
import { type CharacterId, characters } from '../registry'
import { useGameStore } from '../stores/game'

interface NameConfig {
  name: string
  unknownName?: string
}

const config = (id: CharacterId) => characters[id] as unknown as NameConfig | undefined

export const characterNames = {
  /** The name to show right now (translated). */
  name(id: CharacterId): string {
    const shown = useGameStore.getState().names[id]
    const c = config(id)
    return t(shown ?? c?.unknownName ?? c?.name ?? id)
  },

  /** Shows another name, e.g. a fake one: `rename('god', 'Stranger')`. Any text. */
  rename(id: CharacterId, name: string): void {
    useGameStore.setState((s) => {
      s.names[id] = name
    })
  },

  /** Shows the character's real name from now on. */
  reveal(id: CharacterId): void {
    const real = config(id)?.name ?? id
    useGameStore.setState((s) => {
      s.names[id] = real
    })
  },

  /** Back to the start (unknownName, or the real name). For tests and the dev panel. */
  forget(id: CharacterId): void {
    useGameStore.setState((s) => {
      delete s.names[id]
    })
  },

  /** False while the name is hidden (unknownName set, not revealed yet). */
  known(id: CharacterId): boolean {
    const c = config(id)
    if (useGameStore.getState().names[id] !== undefined) return true
    return c?.unknownName === undefined
  },
}

/** React: the name to show (re-renders when it changes). */
export function useCharacterName(id: CharacterId): string {
  useGameStore((s) => s.names[id])
  return characterNames.name(id)
}
