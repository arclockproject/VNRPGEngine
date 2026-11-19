// Runs when the game starts and on "Return to title": boot screens (first start only), "press
// any key", the title screen's entrance, then the main menu.
import type { Game } from '@/core/game'
import { canQuit, quit } from '@/core/platform'

export async function start(game: Game) {
  game.maps.preload('heaven/before_god') // load in the background while the title is up
  await game.title.boot() // src/content/boot/*.tsx, one after another; only when the game starts
  await game.title.show() // "press any key", then the title screen's entrance

  for (;;) {
    const latest = game.save.latest()
    // VN mode: routes with `afterStory` whose endings were reached (empty outside VN mode).
    const afterStories = await game.routes.afterStories()
    const pick = await game.title.menu({
      ...(latest ? { continue: 'Continue' } : {}),
      new: 'New game',
      // Offered once it is unlocked (src/content/config/newgameplus.ts). Not in visual novel mode.
      ...(!game.vnOnly && game.save.newGamePlusReady() ? { plus: 'New Game+' } : {}),
      load: 'Load game',
      // Visual novel mode (src/content/config/mode.ts): the flowchart, to load any scene already reached.
      ...(game.vnOnly ? { flowchart: 'Flowchart' } : {}),
      // Once an ending opened at least one after story (src/content/routes/<id>: afterStory).
      ...(afterStories.available.length > 0 ? { after: 'After Stories' } : {}),
      // Extras appears once something is unlocked (a picture, a scene or an achievement).
      ...(game.extras.anyUnlocked() ? { extras: 'Extras' } : {}),
      // Straight to Extras -> Voices, once the player has starred a line in the log.
      ...(game.extras.favouriteVoices().length > 0 ? { voices: 'Favourite voices' } : {}),
      settings: 'Settings',
      ...(canQuit ? { quit: 'Quit' } : {}), // desktop app only
    })
    if (pick === null) return // a save was loaded from the Load window
    if (pick === 'continue' && latest) return game.save.load(latest.slot)
    if (pick === 'new') return game.save.newGame()
    if (pick === 'plus') return game.save.newGamePlus()
    if (pick === 'load') game.windows.open('saves', { mode: 'load' })
    if (pick === 'settings') game.windows.open('settings')
    if (pick === 'flowchart') game.windows.open('flowchart')
    if (pick === 'after') {
      // A full-screen pick (src/content/minigames/after_stories): its launch() starts the story and
      // ends the minigame with that route's id; null = Back.
      if (await game.minigames.start('after_stories', afterStories)) return
    }
    if (pick === 'extras') await game.minigames.open('extras')
    if (pick === 'voices') await game.minigames.open('extras', { tab: 'voices' })
    if (pick === 'quit') {
      await game.systemVoice.finish() // the system voice's "quit" clip, if there is one
      quit()
    }
  }
}
