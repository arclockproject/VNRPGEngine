// Music and looping background sounds: crossfade time and where each track repeats.
// Edit freely: this is game content, not engine.
import { defineMusic } from '@/core/audio/define'

export default defineMusic({
  // Crossfade when the music (or an ambient sound) changes, in ms. game.audio.music(id, { fadeMs })
  // can still set its own.
  fadeMs: 1000,

  // Tracks with an intro: the file plays from the start once, then repeats between `start` and
  // `end` (seconds) for ever. Leave a track out to repeat the whole file. `volume` evens out
  // tracks that were mixed louder or quieter than the rest (1 = as recorded).
  //   'music/boss': { start: 12.48, end: 96.0 },
  //   'music/town': { volume: 0.8 },
  loops: {},
})
