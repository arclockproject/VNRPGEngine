// Sounds the UI plays by itself. Ids are files in src/content/audio/ (without the extension).
// Remove a line for silence. `{ id, volume }` sets a volume from 0 to 1.
// One element can differ:  <Button data-sound="buy">  plays the `buy` line below,
// <Button data-sound="none"> plays nothing (e.g. when its onClick plays its own sound).
import type { LookSounds } from '@/core/look'

export default {
  // Focus moved to another control (keyboard / gamepad).
  move: { id: 'sfx/blip', volume: 0.4 },
  // The mouse moved onto a control.
  // hover: { id: 'sfx/blip', volume: 0.2 },
  // A button, menu row or dropdown was clicked.
  click: { id: 'sfx/click', volume: 0.6 },
  // A tab was picked.
  tab: { id: 'sfx/click', volume: 0.6 },
  // A switch or checkbox was flipped.
  toggle: { id: 'sfx/click', volume: 0.6 },
  // A window opened / closed.
  // open: 'sfx/confirm',
  // close: 'sfx/click',

  // ---- your own, for data-sound="..." ----
  // buy: 'sfx/confirm',
} satisfies LookSounds
