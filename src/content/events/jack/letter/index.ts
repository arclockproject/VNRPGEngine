import { defineEvent } from '@/core/define'

// Reading the letter from the inventory (items/letter).
export default defineEvent({
  title: "Jack's letter",
  run: async ({ narrate, game }) => {
    await narrate('"Thanks for helping me build the house! Come by any time. — Jack"')
    if (game.quests.isActive('jacks_letter')) {
      await narrate('There are three apples taped to the back.')
      game.quests.complete('jacks_letter')
    }
  },
})
