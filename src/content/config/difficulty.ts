// Difficulty levels. Edit freely: this is game content, not engine. Every number is a multiplier
// (1 = unchanged); leave out what a level does not change. With only one level the game shows no
// difficulty setting at all.
//   enemyStats     × enemy stats in battle, by stat name from src/content/stats.ts
//   xp, money      × what battles give
//   encounters     × the chance of random battles
//   terrainDamage  × HP lost on damaging ground (src/content/terrain.ts)
//   prices         × shop prices when buying
import { defineDifficulty } from '@/core/difficulty'
import { tx } from '@/core/lang'

export default defineDifficulty({
  default: 'normal',
  // true = every new game starts with the question "Pick a difficulty".
  askOnNewGame: false,
  // The player can change it later in Settings.
  canChange: true,

  levels: {
    easy: {
      name: tx('Easy'),
      description: tx('Weaker enemies and fewer random battles. For the story.'),
      enemyStats: { hp: 0.75, attack: 0.75, magic: 0.75 },
      encounters: 0.7,
      terrainDamage: 0.5,
    },
    normal: {
      name: tx('Normal'),
      description: tx('The game as it was balanced.'),
    },
    hard: {
      name: tx('Hard'),
      description: tx('Tougher enemies that hit harder, for a little more reward.'),
      enemyStats: { hp: 1.4, attack: 1.25, magic: 1.25, speed: 1.1 },
      xp: 1.15,
      money: 1.15,
    },
  },
})
