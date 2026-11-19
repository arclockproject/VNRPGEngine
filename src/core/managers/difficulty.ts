// game.difficulty: the level of this playthrough (saved). Levels: src/content/config/difficulty.ts.
import config from '@/content/config/difficulty'
import type { DifficultyLevel } from '../difficulty'
import { t } from '../lang'
import { useGameStore } from '../stores/game'
import { dialog } from './dialog'

export type DifficultyId = Extract<keyof typeof config.levels, string>

const levels = config.levels as Record<string, DifficultyLevel>

export const difficulty = {
  /** The level of this playthrough. */
  get(): DifficultyId {
    const saved = useGameStore.getState().difficulty
    return (saved && saved in levels ? saved : config.default) as DifficultyId
  },

  set(id: DifficultyId): void {
    if (!(id in levels)) {
      console.warn(`[difficulty] unknown level "${id}" (src/content/config/difficulty.ts)`)
      return
    }
    useGameStore.setState((s) => {
      s.difficulty = id
    })
  },

  /** The current level's settings. */
  level(): DifficultyLevel {
    return levels[difficulty.get()] as DifficultyLevel
  },

  /** Every level, in the order of src/content/config/difficulty.ts. */
  list(): { id: DifficultyId; level: DifficultyLevel }[] {
    return Object.entries(levels).map(([id, level]) => ({ id: id as DifficultyId, level }))
  },

  /** Whether there is anything to choose (more than one level). */
  hasChoice(): boolean {
    return Object.keys(levels).length > 1
  },

  /** Whether the player may change it in Settings. */
  canChange(): boolean {
    return config.canChange && difficulty.hasChoice()
  },

  /**
   * One of the current level's multipliers: `difficulty.rate('xp')`, or an enemy stat with
   * `difficulty.rate('enemyStats', 'hp')`. 1 when the level does not set it.
   */
  rate(what: Exclude<keyof DifficultyLevel, 'name' | 'description'>, stat?: string): number {
    const level = difficulty.level()
    if (what === 'enemyStats') return (stat && level.enemyStats?.[stat]) || 1
    return level[what] ?? 1
  },

  /**
   * Asks the player to pick a level (a question window) and sets it. Resolves with the level in
   * use afterwards. Does nothing with only one level.
   */
  async ask(): Promise<DifficultyId> {
    if (!difficulty.hasChoice()) return difficulty.get()
    const current = difficulty.get()
    // The current level first: the first button is the default.
    const order = [...difficulty.list()].sort(
      (a, b) => Number(b.id === current) - Number(a.id === current),
    )
    const options = Object.fromEntries(
      order.map(({ id, level }) => [
        id,
        level.description ? `${t(level.name)}: ${t(level.description)}` : t(level.name),
      ]),
    ) as Record<DifficultyId, string>
    const answer = await dialog.ask(t('Pick a difficulty'), options, {
      title: t('Difficulty'),
    })
    if (answer) difficulty.set(answer)
    return difficulty.get()
  },
}

/** React: the current level id. */
export function useDifficulty(): DifficultyId {
  useGameStore((s) => s.difficulty)
  return difficulty.get()
}
