import { defineStructure } from '@/core/define'
// Generated from house.tmx (10×7). Place it with game.structures.place('house', { at: { x, y } }).
import house from './house.gen'

export default defineStructure({
  tiled: house,
  // Event tiles that come with the house, wherever it is placed.
  objects: {
    door: { onInteract: ({ game }) => game.events.start('jack/house_door') },
    mailbox: { onInteract: ({ game }) => game.events.start('jack/mailbox') },
  },
})
