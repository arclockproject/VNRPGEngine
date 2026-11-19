import { defineCharacter } from '@/core/define'
import { fromAseprite } from '@/core/portrait/aseprite'
import battleSprite from './battle_sprite/anna.gen'
// Generated from portraits/anna.aseprite whenever you save it (the .aseprite file never ships).
// Layers: "Body" (always drawn), groups @Eyes, @Mouth and @Blush (one layer per option).
import portrait from './portraits/anna.gen'
// Map sprite: sprites/anna.aseprite (tags idle/walk/talk per direction, plus wave).
import sprite from './sprites/anna.gen'

export default defineCharacter({
  name: 'Anna',
  color: '#f48fb1',
  blip: 'sfx/blip',
  // Her own chat box while she speaks: looks from src/content/look/parts.ts (box, name, text).
  chatBox: { box: 'annaBox', text: 'annaText' },
  relationship: { start: 0, min: -50, max: 100 },
  // As a party member: quick, weaker hits, more MP.
  battle: {
    base: { hp: 24, mp: 14, attack: 4, defense: 3, magic: 7, resistance: 5, speed: 8, luck: 6 },
    growth: {
      hp: 4,
      mp: 3,
      attack: 1,
      defense: 0.8,
      magic: 1.4,
      resistance: 1,
      speed: 1.2,
      luck: 0.6,
    },
    skills: ['heal', 'fire', { skill: 'quicken', level: 3 }],
  },
  sprite,
  battleSprite,
  layered: fromAseprite(portrait, {
    // Parts not listed here start hidden: the blush only shows when an expression turns it on.
    // faceArea: where her head is (side image, Settings → Voices), a square of the 600x1200
    // portrait. It overrides a "#face" layer in the .aseprite file (hers has none).
    defaults: { eyes: 'open', mouth: 'smile', faceArea: { x: 40, y: 190, w: 520, h: 520 } },
    // Expression names are typed poses: show('anna', { pose: 'happy' }). First = default.
    // Each names every part: a pose change only resets the parts its expression sets.
    expressions: {
      neutral: { eyes: 'open', mouth: 'smile', blush: null },
      surprised: { eyes: 'wide', mouth: 'open', blush: null },
      happy: { eyes: 'happy', mouth: 'smile', blush: 'on' },
      sad: { eyes: 'open', mouth: 'frown', blush: null },
    },
    blink: { layer: 'eyes', closed: 'closed' },
    talk: { layer: 'mouth', open: 'open' },
    // Smooth painted art (drawn at 2x), not pixel art.
    pixelated: false,
  }),
})
