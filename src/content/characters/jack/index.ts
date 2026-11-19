import { defineCharacter } from '@/core/define'
import { fromAseprite } from '@/core/portrait/aseprite'
import battleSprite from './battle_sprite/jack.gen'
// Generated from portraits/jack.aseprite whenever you save it (the .aseprite file never ships).
import jack from './portraits/jack.gen'
// Map sprite: sprites/jack.aseprite (tags idle/walk/talk per direction, plus wave).
import sprite from './sprites/jack.gen'

export default defineCharacter({
  name: 'Jack',
  color: '#90caf9',
  blip: 'sfx/blip',
  sprite,
  battleSprite,
  layered: fromAseprite(jack, {
    // Parts not listed here start hidden: Jack wears just his t-shirt until an outfit is chosen.
    // His face box (side image, Settings → Voices) is the "#face" layer in jack.aseprite. To
    // change it here: faceArea: { x, y, w, h } in `defaults` (all expressions) or in one
    // expression (e.g. a tilted head), in portrait pixels; it overrides the "#face" layer.
    defaults: { eyes: 'open', mouth: 'smile' },
    expressions: {
      neutral: {},
      happy: { eyes: 'happy', mouth: 'open' },
      surprised: { mouth: 'open' },
      sad: { mouth: 'frown' },
      sleepy: { eyes: 'closed' },
    },
    blink: { layer: 'eyes', closed: 'closed' },
    talk: { layer: 'mouth', open: 'open' },
  }),
})
