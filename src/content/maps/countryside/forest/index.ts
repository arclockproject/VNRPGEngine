import { defineMap } from '@/core/define'
import forest from './forest.gen'

export default defineMap({
  title: 'Forest',
  music: 'music/forest',
  onEnter: ({ game }) => game.codex.unlock('forest'),
  background: '#050a06',
  outdoor: true,
  weather: { kind: 'rain', intensity: 0.5 },
  // Layout, the spawn, the door to town and the random-battle area (class "encounter") live in forest.tmx.
  tiled: forest,
  objects: {
    chest: {
      onInteract: ({ game }) => game.minigames.start('rock_paper_scissors'),
    },
    arcade: { onInteract: ({ game }) => game.events.start('forest/arcade') },
  },
})
