import { defineMap } from '@/core/define'
import tiled from './heaven.gen'

export default defineMap({
  title: 'Forest',
  music: 'music/forest',
  // Starts behind the black cover, so the map never flashes; once per playthrough.
  intro: 'heaven/before_god/spawning',
  introOnce: true,
  background: '#94e3ea',
  outdoor: false,
  tiled: tiled,
  // The prologue begins here (src/content/chapters.ts).
  onEnter: ({ game }) => {
    game.chapters.reach('heaven')
  },
  // keys auto completed
  objects: {
    // no autocomplete for keys,
    god_sight_line: {
      // no autocomplete for keys, but auto compelte for values...
      onEnter: ({ game }) => game.events.start('heaven/before_god/meeting'),
    },
    god: {
      // no autocomplete for keys, but auto compelte for values...
      character: 'god',
    },
  },
})
