import { defineEvent } from '@/core/define'

// Run from other events with event('anna/flashback'). Shares their scene.
export default defineEvent({
  title: 'The pond',
  // Replayable from Extras → Scenes once seen. Its card shows `preview`, or without one the first
  // CG / background below (here the pond picture). For your own picture, put preview.png next to
  // this file (it gets a small thumbnail):
  //   import preview from './preview.png'
  //   replay: { title: 'The pond', preview },
  replay: { title: 'The pond' },
  run: async ({ narrate, filter, hide, fade, camera, cg, game }) => {
    // Fade to black, set up the memory, fade back in.
    await fade('#000000', 400)
    hide('anna')
    cg('pond_memory', 'base') // the picture, unlocked in Extras → Gallery
    filter('flashback')
    await fade(null, 600)

    // A slow push-in while the memory is told (not awaited: it runs during the narration).
    void camera({ zoom: 1.15, focus: { x: 50, y: 40 } }, { duration: 6000, ease: 'sineInOut' })
    await narrate(
      'A long time ago, two kids played rock, paper, scissors by the pond every evening.',
      { italic: true, speed: 0.6 },
    )
    // The same picture with its "+full moon" layer on (a variant, see gallery/pond_memory).
    cg('pond_memory', 'full_moon')
    await narrate('They stayed until the moon came up.', { italic: true, speed: 0.6 })

    // Back to the present.
    await fade('#000000', 300)
    cg(null)
    filter(null)
    await camera({ zoom: 1, focus: { x: 50, y: 50 } }, { duration: 0 })
    await fade(null, 400)
    game.achievements.unlock('old_friends') // a secret one
    // if (!game.extras.isReplaying()) {}
  },
})
