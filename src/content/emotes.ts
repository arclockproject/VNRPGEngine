// Emote balloons over heads on the map: game.maps.npc('jack').emote('surprise'),
// game.maps.player.emote('question'). Add a line and its name works (and autocompletes).
// Edit freely: this is game content, not engine.
import { defineEmotes } from '@/core/emotes'

export default defineEmotes({
  durationMs: 1400,
  size: 22,
  balloon: { fill: '#ffffff', outline: '#1d1d1d' },
  // name: 'symbol', or { text, color }.
  list: {
    surprise: { text: '!', color: '#d32f2f' },
    question: { text: '?', color: '#1565c0' },
    love: { text: '♥', color: '#e91e63' },
    anger: { text: '#', color: '#c62828' },
    sweat: { text: ';', color: '#0288d1' },
    idea: { text: '✦', color: '#f9a825' },
    music: { text: '♪', color: '#6a1b9a' },
    sleep: 'z Z',
    dots: '…',
    happy: { text: '^_^', color: '#2e7d32' },
  },
})
