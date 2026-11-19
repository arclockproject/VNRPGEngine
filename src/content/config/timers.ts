// Timers on screen: game.timers.start('bomb', { seconds: 60 }). Edit freely: this is game
// content, not engine. Their look: `timer` and `timerWarning` in src/content/look/parts.ts.
import { defineTimers } from '@/core/timers'

export default defineTimers({
  // Timers always run while the player walks around. Where else? A timer can set its own with
  // game.timers.start(id, { during: { event: true } }).
  runsDuring: {
    event: false, // conversations and cutscenes
    minigame: true, // minigames and battles
    window: false, // inventory, pause menu, shop…
  },

  // Where they sit on the screen (CSS). Under the money in the top left by default.
  place: { top: 56, left: 16 },

  // The last seconds of a countdown look different (look/parts.ts `timerWarning`). 0 = never.
  warnSeconds: 10,
  // Under this many seconds a countdown also shows tenths: 0:09.4. 0 = never.
  tenthsUnder: 10,

  sounds: {
    // tick: 'sfx/tick',   // each second of the warning time
    // end: 'sfx/alarm',   // when a countdown runs out
  },
})
