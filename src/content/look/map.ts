// Text and speech bubbles on the map. Edit freely. Colours are CSS ('#fff', 'white').
// Their size grows with the screen: these are px at the normal size (content/config/screen.ts
// `map.textHeight`). Emote balloons take their colours from src/content/emotes.ts.
import { defineMapLook } from '@/core/look'

export default defineMapLook({
  // Names over objects and NPCs (the Tiled `label` property).
  label: {
    font: 'system-ui, sans-serif',
    size: 13,
    color: '#ffffff',
    outline: '#000000', // the line around each letter
    outlineWidth: 3, // 0 = none
  },
  // Over the player when something can be used: the confirm key or button (E, A, ✕…).
  prompt: {
    font: 'system-ui, sans-serif',
    size: 22,
    color: '#ffffff',
    outline: '#000000',
    outlineWidth: 3,
    touch: '!', // shown instead on touch screens
  },
  // npc.bark('Hi!') and player.bark().
  bubble: {
    fill: '#ffffff',
    outline: '#1d1d1d',
    outlineWidth: 2,
    radius: 8, // corner roundness
    padding: 7, // between the text and the border
    tail: 7, // the little point under the balloon
    maxWidth: 200, // longer lines wrap
    text: { font: 'system-ui, sans-serif', size: 14, color: '#1d1d1d' },
    fadeMs: 150,
    // How long a bark stays (unless bark() gives a duration): baseMs + perLetterMs per letter,
    // kept between minMs and maxMs.
    time: { minMs: 1500, maxMs: 6000, baseMs: 900, perLetterMs: 55 },
  },
})
