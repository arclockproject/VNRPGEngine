// Lets managers hand `game` to content (event/map contexts) without importing game.ts,
// which would create an import cycle.
import type { Game } from './game'

let current: Game | undefined

export function setGame(game: Game) {
  current = game
}

export function getGame(): Game {
  if (!current) throw new Error('game is not initialised yet')
  return current
}
