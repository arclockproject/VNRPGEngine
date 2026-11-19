import { defineCodex } from '@/core/define'

// game.codex.unlock('anna') — when you first meet her.
// Versions change the entry as you get to know her: the first one that matches is shown.
export default defineCodex({
  title: 'Anna',
  category: 'People',
  text: 'Runs a small stall in town. Loves rock, paper, scissors, and never stops talking about the old days.',
  versions: [
    {
      when: (game) => game.relationships.get('anna') >= 30,
      text: 'A close friend. Behind the stall talk she misses someone from the old days, and you remind her of them.',
    },
    {
      when: (game) => game.relationships.get('anna') >= 10,
      text: 'Runs a small stall in town. Always up for a round of rock, paper, scissors, and always happy to see you.',
    },
    {
      when: (game) => game.relationships.get('anna') < 0,
      text: 'Runs a small stall in town. Lately she pretends not to see you.',
    },
  ],
})
