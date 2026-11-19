// Anna's route: flowchart boxes. See src/content/routes/common/flow.ts.
import { defineFlow } from '@/core/define'

export default defineFlow('anna', {
  walk: {
    description: 'Anna shows you the pond.',
    // The walk gives Anna 5 points: a jump past it must give them too.
    sets: (game) => {
      game.relationships.change('anna', 5)
    },
  },
  ending: { description: 'Same time tomorrow.' },
})
