import { defineEvent } from '@/core/define'

export default defineEvent({
  title: 'The arcade',
  run: async ({ narrate, choice, game }) => {
    await narrate('An old arcade cabinet hums between the trees. "DODGE!", it flashes.')
    const pick = await choice({
      normal: 'Play (20 s)',
      hard: 'Play hard mode (40 s)',
      leave: 'Leave',
    })
    if (pick === 'leave') return

    const result = await game.minigames.start('dodge', { seconds: pick === 'hard' ? 40 : 20 })
    await narrate(
      result.won
        ? `You survived! ${result.score} blocks dodged.`
        : `Game over. ${result.score} blocks dodged.`,
    )
  },
})
