// Game over: what happens when the whole party is down (a lost battle, lethal ground) or when the
// game calls game.gameOver(). Edit freely: this is game content, not engine.
// The screen itself is src/content/windows/gameover.
// One battle can still do its own thing: src/content/battle.ts `onLose`.
import { defineGameOver } from '@/core/gameover'
import { tx } from '@/core/lang'

export default defineGameOver({
  // 'screen' = the game-over screen below. 'wakeUp' = no screen: everyone is healed and the game
  // carries on (a soft game over).
  mode: 'screen',

  title: tx('Game over'),
  text: tx('The party has fallen.'),

  // Buttons, in order:
  //   'load'    load the newest save (hidden when there is no save)
  //   'wakeUp'  heal the party and carry on where they fell
  //   'title'   back to the title screen
  buttons: ['load', 'wakeUp', 'title'],

  // sound: 'sfx/game_over',   // played once when the screen appears
  // music: 'music/game_over', // leave out = the music fades to silence
  musicFadeMs: 800,

  wakeUpMessage: tx('You wake up, sore but alive.'),
})
