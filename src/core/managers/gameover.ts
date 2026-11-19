// game.gameOver(): the default flow when the party is down. Settings: src/content/config/gameover.ts,
// the screen: src/content/windows/gameover.
import config from '@/content/config/gameover'
import { audio } from '../audio/manager'
import { reportError } from '../errors'
import type { GameOverButton } from '../gameover'
import { t } from '../lang'
import { save } from '../save/manager'
import { useSystemStore } from '../stores/system'
import { toast } from '../ui/toast'
import { party } from './party'
import { session } from './session'
import { windows } from './windows'

const WINDOW = 'gameover'

/** What the game-over window gets (src/content/windows/gameover). */
export interface GameOverParams {
  /** Not translated yet. */
  title: string
  text: string
  buttons: GameOverButton[]
  answer: (button: GameOverButton) => void
}

/** How a game over ended. */
export type GameOverResult = 'wakeUp' | 'load' | 'title'

let running: Promise<GameOverResult> | undefined

/** The buttons that make sense right now ('load' needs a save). Never empty. */
export function gameOverButtons(): GameOverButton[] {
  const buttons = config.buttons.filter(
    (button, index, all) =>
      all.indexOf(button) === index && (button !== 'load' || save.latest() !== null),
  )
  return buttons.length > 0 ? buttons : ['title']
}

function wakeUp(): void {
  party.restore()
  if (config.wakeUpMessage) toast(t(config.wakeUpMessage))
}

function ask(): Promise<GameOverButton> {
  return new Promise((resolve) => {
    const params: GameOverParams = {
      title: config.title,
      text: config.text,
      buttons: gameOverButtons(),
      answer: resolve,
    }
    ;(windows.open as (id: string, params: unknown) => void)(WINDOW, params)
  })
}

async function run(): Promise<GameOverResult> {
  if (config.mode === 'wakeUp') {
    wakeUp()
    return 'wakeUp'
  }
  const before = audio.currentMusic()
  if (config.music && audio.has(config.music))
    audio.music(config.music, { fadeMs: config.musicFadeMs })
  else audio.stopMusic(config.musicFadeMs)
  if (config.sound && audio.has(config.sound)) audio.sfx(config.sound)

  for (;;) {
    const choice = await ask()
    windows.close(WINDOW)
    if (choice === 'load') {
      const latest = save.latest()
      try {
        if (!latest) throw new Error('no save to load')
        await save.load(latest.slot)
        return 'load'
      } catch (error) {
        // A broken save: say so and show the screen again.
        reportError('game over', error)
        continue
      }
    }
    if (choice === 'title') {
      await session.toTitle()
      return 'title'
    }
    wakeUp()
    if (before) audio.music(before, { fadeMs: config.musicFadeMs })
    return 'wakeUp'
  }
}

/**
 * The party is down: shows the game-over screen (or just heals everyone, by
 * src/content/config/gameover.ts `mode`). Resolves with how it ended: 'wakeUp' = the game carries on,
 * 'load' / 'title' = everything that was running has been dropped.
 * Calling it while it is already showing returns the same answer.
 */
export function gameOver(): Promise<GameOverResult> {
  running ??= run().finally(() => {
    running = undefined
  })
  return running
}

/** True while the game-over screen is showing. */
export function isGameOver(): boolean {
  return useSystemStore.getState().windows.some((w) => w.id === WINDOW)
}
