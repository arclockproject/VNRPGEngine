// Battle settings: music, backgrounds, and what happens when the whole party falls.
import forest from '@/content/assets/battle/forest.svg'
import { defineBattle } from '@/core/define'

export default defineBattle({
  // music: 'music/battle',   // a track while fighting (the map's music comes back after)
  // Named backgrounds: an encounter zone (Tiled property "background") or
  // game.battles.start({ background: 'forest' }) picks one. Images or any CSS background.
  backgrounds: {
    forest,
    night: 'linear-gradient(#1b2735, #090a0f)',
  },
  // Used when a battle names none.
  background: 'night',
  // spriteScale: 4,   // screen pixels per sprite pixel
  // true = a small label over each enemy says what it will do next ("Bite", "Defend").
  showIntent: false,
  // Random battles in encounter zones on maps.
  encounters: {
    // Tiles to walk after a map change or a battle before the next one can start.
    minSteps: 5,
    // Chance per tile walked, for zones that don't set their own `rate` (0.08 = 8%).
    rate: 0.08,
  },
  // A lost battle shows the game-over screen (src/content/config/gameover.ts). To do something else
  // after every lost battle instead, add:
  //   onLose: (game) => { game.party.restore() },
})
