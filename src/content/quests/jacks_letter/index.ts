import { defineQuest } from '@/core/define'

export default defineQuest({
  title: "Jack's letter",
  description: 'Jack built a house in the meadow. Something seems to be waiting in its mailbox.',
  // Ordered steps: game.quests.setStep('jacks_letter', 'read') (typed).
  steps: {
    mailbox: 'Check the mailbox of the new house',
    read: 'Read the letter (inventory)', // a plain text: shown once the quest gets there
    // With `when`: listed from the start, but reads "???" until it returns true.
    talk_with_jack: {
      text: 'Talk with Jack',
      when: ({ game }) => game.flags.get('took_jacks_letter'),
      // hiddenText: '???',   // what it reads while hidden ('???' if you leave it out)
    },
  },
  onComplete: ({ game }) => {
    game.items.add('apple', 3, { notify: true })
  },
})
