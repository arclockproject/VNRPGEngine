// Anna's route (visual novel demo). Reached from the common route; ends the game (back to title)
// with ending('anna'): src/content/endings/anna is reached (the common route has an option that
// needs it).
import { defineRoute } from '@/core/define'

export default defineRoute({
  title: 'Anna',
  description: 'You stayed in town.',
  color: '#7fb3ff',
  run: async ({ event, ending }) => {
    await event('vn_demo/anna_walk', 'walk')
    await event('vn_demo/anna_ending', 'ending')
    return ending('anna')
  },
})
