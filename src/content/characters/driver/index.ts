import { defineCharacter } from '@/core/define'
import { fromSpine } from '@/core/portrait/spine'
// A Spine export (the editor's Export: driver.json + driver.atlas + driver.png in portraits/),
// turned into driver.gen.ts whenever the files change. Binary .skel exports work the same way.
import driver from './portraits/driver.gen'

// The bus driver: an animated Spine portrait. Spine needs a Spine Editor licence to ship
// (docs/world/art.html "Spine portraits").
export default defineCharacter({
  name: 'Bus driver',
  color: '#8fa8d8',
  blip: 'sfx/blip',
  spine: fromSpine(driver, {
    // Pose name -> animation (typed from the export). The first is the default.
    // show('driver', { pose: 'wave' }), or `driver:happy: …` in a .vn file.
    expressions: {
      neutral: 'idle',
      happy: 'happy',
      // intro: played once (the arm comes up), then `animation` loops.
      wave: { intro: 'wave_in', animation: 'wave', parts: { hat: 'cap' } },
      surprised: 'surprised',
    },
    // Changing pose crossfades every bone into the new animation (mix, default 0.2 s).
    // Its own time for one pair: lowering the arm after waving takes a bit longer.
    mixes: { 'wave>idle': 0.5 },
    // Laid over the pose: the mouth while his line types, and a blink now and then.
    talk: 'talk',
    blink: 'blink',
    // Skins as a part: show('driver', { parts: { hat: 'party' } }).
    parts: { hat: { cap: 'hat/cap', party: 'hat/party', none: null } },
    // His face, for the side image (portrait pixels from the top left of the drawn box).
    faceArea: { x: 211, y: 206, w: 300, h: 300 },
  }),
})
