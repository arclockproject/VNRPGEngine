// The one object content code talks to:
//   import { game } from '@/core/game'
//   game.maps.go('countryside/town'); game.events.start('anna/hello'); game.windows.open('inventory')

import modeConfig from '@/content/config/mode'
import { audio } from './audio/manager'
import { systemVoice } from './audio/systemVoice'
import { setGame } from './gameRef'
import { input } from './input/manager'
import { lang, t } from './lang'
import { achievements } from './managers/achievements'
import { battles } from './managers/battles'
import { chapterManager } from './managers/chapters'
import { characterNames } from './managers/characters'
import { clock } from './managers/clock'
import { codex } from './managers/codex'
import { crafting } from './managers/crafting'
import { dialog } from './managers/dialog'
import { difficulty } from './managers/difficulty'
import { events } from './managers/events'
import { extras } from './managers/extras'
import { flags } from './managers/flags'
import { fonts } from './managers/fonts'
import { gameOver } from './managers/gameover'
import { gameSettings } from './managers/gameSettings'
import { items } from './managers/items'
import { maps } from './managers/maps'
import { minigames } from './managers/minigames'
import { money } from './managers/money'
import { party } from './managers/party'
import { persistentGame } from './managers/persistentGame'
import { props } from './managers/props'
import { quests } from './managers/quests'
import { relationships } from './managers/relationships'
import { routes } from './managers/routes'
import { session } from './managers/session'
import { shops } from './managers/shops'
import { structures } from './managers/structures'
import { timers } from './managers/timers'
import { title } from './managers/title'
import { travel } from './managers/travel'
import { windows } from './managers/windows'
import { save } from './save/manager'
import { screenshot } from './screenshot'
import { state } from './state'
import { toast } from './ui/toast'
import { variants } from './variants'

export const game = {
  /** true = visual novel only (src/content/config/mode.ts): routes and the flowchart, no maps or RPG menus. */
  vnOnly: modeConfig.vnOnly,
  maps,
  events,
  minigames,
  windows,
  input,
  title,
  audio,
  /** The menus' character voice (src/content/audio/system_voice): game.systemVoice.play('saved'). */
  systemVoice,
  /** Which version of the game this build is (src/content/config/variants.ts): game.variants.is('adult'). */
  variants,
  save,
  structures,
  props,
  state,
  flags,
  items,
  quests,
  lang,
  clock,
  relationships,
  characters: characterNames,
  dialog,
  session,
  extras,
  money,
  shops,
  achievements,
  codex,
  party,
  battles,
  difficulty,
  crafting,
  chapters: chapterManager,
  travel,
  timers,
  /** VN mode: the story's routes and their flowcharts (src/content/routes). */
  routes,
  /** Translate UI text: t('Hello {name}', { name }). */
  t,
  /** A short message at the top of the screen. */
  toast,
  /** The font the player picked: game.fonts.current(); useFont() in React. */
  fonts,
  /** The game's own settings (src/content/settings.ts): get / set. */
  settings: gameSettings,
  /** The game's own data kept across all saves (src/content/save/persistent.ts): get / set. */
  persistent: persistentGame,
  /**
   * The party is down: the game-over screen, or a soft wake-up (src/content/config/gameover.ts).
   * Resolves 'wakeUp' when the game carries on, 'load' / 'title' when it did not.
   */
  gameOver,
  /** Saves a picture of the game screen (settings: src/content/config/screen.ts `screenshot`). */
  screenshot,
}

export type Game = typeof game

setGame(game)
