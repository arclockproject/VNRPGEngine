// What the ground does. In Tiled, give a tileset tile the custom property `terrain` (a name from
// this list), or paint a marker layer and give the LAYER the property `terrain` (the layer may be
// hidden). Edit freely: this is game content, not engine.
//   footstep      a sound per tile walked, e.g. 'sfx/step_grass' (a file in src/content/audio)
//   speed         × walking speed (0.5 = half)
//   damage        HP each party member loses per tile (stops at 1 HP unless lethal: true)
//   encounters    × the chance of random battles (0 = never, 2 = twice as often)
//   ladder        the player faces up and only moves up / down
//   jump          a blocking tile (hole, ledge) the player hops over by walking into it:
//                 true = from any side, 'down' = only when moving down (one-way ledge)
import { defineTerrain } from '@/core/terrain'

export default defineTerrain({
  footsteps: {
    volume: 0.4,
    everyTiles: 1,
    pitchSpread: 0.08,
    // default: 'sfx/step',   // ground without a terrain of its own
  },
  kinds: {
    grass: {},
    tall_grass: { encounters: 2, speed: 0.85 },
    road: { encounters: 0 },
    mud: { speed: 0.55 },
    water: { speed: 0.6, encounters: 0.5 },
    lava: { damage: 3, speed: 0.8, damageSound: 'sfx/hit' },
    ladder: { ladder: true, speed: 0.6, encounters: 0 },
    gap: { jump: true },
    ledge_down: { jump: 'down' },
  },
})
