// New Game+: starting over while keeping some of what was earned. Edit freely: this is game
// content, not engine. The title menu entry is in src/content/start.ts.
// In your newGame (src/content/save/index.ts) and events, game.save.cycle() says which
// playthrough this is: 0 = the first, 1 = the first New Game+, …
import { defineNewGamePlus } from '@/core/newgameplus'

export default defineNewGamePlus({
  enabled: true,
  // 'ending' = offered once any ending() was reached. 'manual' = only after your game calls
  // game.save.unlockNewGamePlus() (after the credits, say).
  unlock: 'ending',

  // What the next playthrough starts with, taken at the moment New Game+ was unlocked.
  carry: {
    party: true, // levels, XP, equipment, learned skills
    money: 1, // × the money (0.5 = half, 0 = none)
    items: true, // the bag
    itemsExcept: ['letter'], // …but not these (keys, quest items)
    codex: true, // journal entries
    relationships: false,
    difficulty: true,
    flags: [], // flag names to keep, e.g. ['saw_true_ending']
    data: [], // other keys of src/content/save/data.ts to copy whole, e.g. ['stats']
  },
})
