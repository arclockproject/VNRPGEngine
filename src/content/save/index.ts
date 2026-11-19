// How a new game starts and how saves are loaded. The saved data itself is in data.ts.
import { defineSave } from '@/core/save/define'
import { type GameData, initialData } from './data'

export default defineSave<GameData>({
  initial: initialData,

  newGame: (game) => {
    game.party.add('hero') // the party starts with the hero (src/content/characters/hero)
    return game.maps.go('heaven/before_god', { spawn: 'start' })
  },

  // Runs after migrations, before the game uses a loaded save: last-minute fixes go here.
  beforeLoad: (save) => {
    save.data.stats.health = Math.min(100, Math.max(0, save.data.stats.health))
    return save
  },

  // Saves from before the party existed: give them the hero.
  afterLoad: (game) => {
    if (game.party.members().length === 0) game.party.add('hero')
  },

  // Manual save slots. The Saves window also shows the autosave and the quick save as its first two
  // boxes, so 198 makes 200 boxes = 10 full pages of 20.
  slots: 198,

  // Browser build only: a browser keeps far less than a disk, so it offers fewer slots. Sizes are
  // in characters. Boxes that fit = (storage - reserved) / perSave = (2.6M - 1M) / 130k = 12
  // (autosave and quick save included, so 10 manual slots). Desktop and Android
  // offer them all.
  // Chosen to be safe, not tight: a save is about 8k today (measured 2026-11-11), so each one can
  // grow 15 times, and 1M stays free for whatever else the game stores later.
  browser: {
    storage: 2_600_000, // the smallest common browser (Safari); Chrome and Firefox give twice this
    reserved: 1_000_000, // settings, read lines, unlocks, achievements, anything added later
    perSave: 130_000, // one save: its picture (6-9k now, more for painted scenes) plus its data
  },

  // The picture in each save slot: the game screen, this many px wide (JPEG quality 0 to 1).
  thumbnail: { width: 256, quality: 0.72 },

  // Longest note a player can write on a save (Saves → Note), in characters.
  noteMax: 40,

  // When the 'auto' slot is written. A moment where saving isn't possible (mid-scene, in a
  // minigame, on the title) is skipped. Set one to false to turn it off; remove `autosave` for none.
  // Anywhere else in the game: game.save.autosave().
  autosave: {
    mapChange: true, // arrived on another map
    eventEnd: true, // a scene finished
    minigameEnd: true, // a minigame or battle finished
    windowsClosed: true, // the last window closed (shop, inventory, party...)
    appHidden: true, // the game went to the background or is closing
    everyMinutes: 5, // of play without any save (0 = never)
  },
})
