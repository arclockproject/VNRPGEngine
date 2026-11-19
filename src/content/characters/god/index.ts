import { defineCharacter } from '@/core/define'

// import { fromAseprite } from '@/core/portrait/aseprite'
// import portrait from './portraits/god.gen'

import battleSprite from './battle_sprite/god.gen'
import sprite from './sprites/god.gen'

// All face parts live in one image (an atlas). Frame names become typed: face.eyes_open, …
export default defineCharacter({
  name: 'God',
  // Hidden until God introduces themself (see events/heaven/before_god/meeting).
  unknownName: '???',
  color: '#90caf9',
  blip: 'sfx/blip',
  sprite,
  battleSprite,
  //   layered: fromAseprite(portrait, {
  //     // Parts not listed here start hidden: Jack wears just his t-shirt until an outfit is chosen.
  //     defaults: { eyes: 'open', mouth: 'smile' },
  //     expressions: {
  //       neutral: {},
  //       happy: { eyes: 'happy', mouth: 'open' },
  //       surprised: { mouth: 'open' },
  //       sad: { mouth: 'frown' },
  //       sleepy: { eyes: 'closed' },
  //     },
  //     blink: { layer: 'eyes', closed: 'closed' },
  //     talk: { layer: 'mouth', open: 'open' },
  //   }),
})
