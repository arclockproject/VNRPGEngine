// The hero's map sprite: characters/hero/sprites/hero.aseprite (tags idle_* and walk_* per
// direction; left = mirrored right).
import sprite from '@/content/characters/hero/sprites/hero.gen'
import { definePlayer } from '@/core/define'

export default definePlayer({
  speed: 5, // tiles per second
  size: 0.7, // of a tile (the hitbox; the sprite stands on its bottom edge)
  reach: 0.15, // tiles in front of the hitbox that count as "facing it" (talk, open, read)
  // Objects marked `pushable` (a prop, a map object): walk against one for delayMs and it slides
  // one tile at `speed` tiles per second.
  push: { delayMs: 220, speed: 4 /*, sound: 'sfx/push' */ },
  // Tiles whose terrain has `jump` (src/content/terrain.ts): walk against one for delayMs and the
  // player hops over it in `ms`, `height` tiles high.
  jump: { delayMs: 120, ms: 280, height: 0.6 /*, sound: 'sfx/jump' */ },
  color: '#ffd54f', // used when there is no sprite
  sprite,
  // light: { radius: 2 },   // a light the player always has in the dark. The lantern's own light
  //                         // is in items/lantern.
})
