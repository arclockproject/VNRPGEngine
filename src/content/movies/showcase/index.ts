import { defineMovie } from '@/core/define'
// A video is imported like a picture (mp4 or webm). In a voice-language folder (en/, ja/ … as in
// src/content/scenes.ts voice.languages) it plays in the voice language the player picked: put
// ja/clip.webm next to en/clip.webm. Import any one of them; a missing language plays the next
// one in the list that has it.
import video from './en/clip.webm'

// Played in events with movie('showcase'), which also unlocks it in Extras → Movies
// (movie('showcase', { unlock: false }) plays it without unlocking).
export default defineMovie({
  title: 'Showcase clip',
  video,
  // poster: a picture for its Extras tile (default: the video's first frame).
  // The movie() options work here too: skippable, fit, volume, keepMusic, background.
})
