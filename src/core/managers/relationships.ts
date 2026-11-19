// game.relationships: points per character (affection, trust…), saved with the game.
// Limits and start value per character: defineCharacter({ relationship: { start, min, max } }).
import { t } from '../lang'
import { type CharacterId, characters } from '../registry'
import { useGameStore } from '../stores/game'
import { toast } from '../ui/toast'

function limits(id: CharacterId) {
  const config = (
    characters[id] as { relationship?: { start?: number; min?: number; max?: number } }
  )?.relationship
  return { start: config?.start ?? 0, min: config?.min ?? -100, max: config?.max ?? 100 }
}

function read(stored: Record<string, number>, id: CharacterId) {
  return stored[id] ?? limits(id).start
}

export const relationships = {
  get(id: CharacterId): number {
    return read(useGameStore.getState().relationships, id)
  },

  /** Sets the points (kept within the character's min..max). */
  set(id: CharacterId, value: number): void {
    const { min, max } = limits(id)
    useGameStore.setState((s) => {
      s.relationships[id] = Math.min(max, Math.max(min, value))
    })
  },

  /** Adds (or with a negative number, removes) points. `notify` shows "♥ Anna +5". */
  change(id: CharacterId, amount: number, options: { notify?: boolean } = {}): number {
    const before = relationships.get(id)
    relationships.set(id, before + amount)
    const after = relationships.get(id)
    if (options.notify && after !== before) {
      const name = t((characters[id] as { name: string }).name)
      toast(
        `${after > before ? '♥' : '💔'} ${name} ${after > before ? '+' : ''}${after - before}`,
        {
          kind: 'relationship',
          params: { character: id, change: after - before, value: after },
        },
      )
    }
    return after
  },

  /** Every character's points. */
  all(): Record<CharacterId, number> {
    const stored = useGameStore.getState().relationships
    return Object.fromEntries(
      (Object.keys(characters) as CharacterId[]).map((id) => [id, read(stored, id)]),
    ) as Record<CharacterId, number>
  },
}

/** React: a character's points. */
export function useRelationship(id: CharacterId): number {
  return useGameStore((s) => read(s.relationships, id))
}
