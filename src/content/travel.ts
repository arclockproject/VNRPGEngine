// Fast travel and the world map: game.travel. Edit freely: this is game content, not engine.
// The window is src/content/windows/travel.
//   map / spawn   where a place leads
//   known: false  hidden until the player has been on that map (discoverOnVisit) or the game
//                 calls game.travel.discover('id')
//   at            where it sits on the world map, in % of the board (0,0 = top left)
//   cost          money per trip
import { tx } from '@/core/lang'
import { defineTravel } from '@/core/travel'

export default defineTravel({
  // "Travel" in the pause menu, once two places are known.
  inMenu: true,
  // Walking onto a place's map adds it to the list.
  discoverOnVisit: true,
  // No travelling away from these maps.
  blockedMaps: ['heaven/before_god'],

  worldMap: {
    // true = places are shown on a board by their `at`. false = a plain list.
    show: true,
    // image: worldPng,   // import worldPng from '@/content/assets/world.png'
    ratio: 16 / 9,
  },

  places: {
    town: {
      name: tx('Town'),
      description: tx('Home. Anna and Jack live here.'),
      map: 'countryside/town',
      spawn: 'start',
      known: false,
      at: { x: 28, y: 68 },
    },
    forest: {
      name: tx('Forest'),
      description: tx('Dark, wet and full of slimes.'),
      map: 'countryside/forest',
      spawn: 'from_town',
      known: false,
      at: { x: 72, y: 30 },
    },
  },
})
