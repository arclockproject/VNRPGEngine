import { defineEvent } from '@/core/define'

export default defineEvent({
  title: "Jack's mailbox",
  run: async ({ narrate, game }) => {
    if (game.flags.get('took_jacks_letter')) {
      await narrate('The mailbox is empty.')
      return
    }
    await narrate('There is a letter inside, addressed to "whoever helped build this house".')
    game.flags.set('took_jacks_letter', true)
    game.items.add('letter', 1, { notify: true })
    game.quests.setStep('jacks_letter', 'read')
    game.audio.sfx('sfx/confirm')
    await narrate('You take the letter. (Read it from your inventory.)')
  },
})
