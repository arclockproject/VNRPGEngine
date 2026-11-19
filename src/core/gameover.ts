// Types for src/content/config/gameover.ts: what happens when the whole party is down (a lost battle,
// lethal ground) or the game calls game.gameOver(). Must not import content.

/** A button on the game-over screen. */
export type GameOverButton = 'load' | 'wakeUp' | 'title'

export interface GameOverConfig {
  /**
   * 'screen' = the game-over screen with buttons. 'wakeUp' = no screen: the party is healed and
   * the game carries on where it was (a soft game over).
   */
  mode: 'screen' | 'wakeUp'
  /** Big text on the screen. */
  title: string
  /** A smaller line under it. '' = none. */
  text: string
  /**
   * Buttons, in order. 'load' = load the newest save (left out when there is none),
   * 'wakeUp' = heal the party and carry on, 'title' = back to the title screen.
   * If none can be shown, 'title' is.
   */
  buttons: readonly GameOverButton[]
  /** A sound id played once when the screen appears ('sfx/game_over'). */
  sound?: string
  /** A sound id played as music while the screen shows. Leave out = the music fades to silence. */
  music?: string
  /** Fade of the music going quiet, ms. */
  musicFadeMs: number
  /** The toast after waking up. '' = none. */
  wakeUpMessage: string
}

export function defineGameOver(config: GameOverConfig): GameOverConfig {
  return config
}
