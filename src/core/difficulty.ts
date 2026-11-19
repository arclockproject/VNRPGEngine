// Types for src/content/config/difficulty.ts. Must not import content.

export interface DifficultyLevel {
  name: string
  /** Shown when picking one. */
  description?: string
  /** × enemy stats in battle, by stat name: { hp: 1.5, attack: 1.2 }. Missing = 1. */
  enemyStats?: Record<string, number>
  /** × XP from battles. Default 1. */
  xp?: number
  /** × money from battles. Default 1. */
  money?: number
  /** × the chance of random battles. Default 1. */
  encounters?: number
  /** × HP lost on damaging ground (src/content/terrain.ts). Default 1. */
  terrainDamage?: number
  /** × shop prices when buying. Default 1. */
  prices?: number
}

export interface DifficultyConfig<K extends string = string> {
  /** What a new game starts with. */
  default: NoInfer<K>
  /** Ask the player at the start of every new game. */
  askOnNewGame: boolean
  /** The player can change it later in Settings. false = only your code can (game.difficulty.set). */
  canChange: boolean
  /** In the order they are listed to the player. One level = no difficulty setting is shown. */
  levels: Record<K, DifficultyLevel>
}

export function defineDifficulty<const K extends string>(
  config: DifficultyConfig<K>,
): DifficultyConfig<K> {
  return config
}
