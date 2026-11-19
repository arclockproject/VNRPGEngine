// Everything the game remembers in a save. Typed everywhere via game.state / useGameData.
// Kept in its own file (without any `game` imports) so the data type never depends on game code.

export const initialData = () => ({
  stats: { health: 100, hunger: 0 },
  /** Story flags, e.g. flags.met_anna = true. */
  flags: {} as Record<string, boolean | number | string>,
  /** Item id -> how many. */
  inventory: {} as Record<string, number>,
})

export type GameData = ReturnType<typeof initialData>
