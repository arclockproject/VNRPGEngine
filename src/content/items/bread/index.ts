import { defineItem } from '@/core/define'
import icon from './icon.svg'

export default defineItem({
  name: 'Bread',
  description: 'Fresh from the bakery. Less hungry.',
  icon,
  price: 8,
  battle: {
    effects: [
      { type: 'heal', amount: 20 },
      { type: 'cure', status: 'bad' },
    ],
  }, // in battle
  use: ({ game }) => {
    game.state.update((d) => {
      d.stats.hunger = Math.max(0, d.stats.hunger - 25)
    })
    game.audio.sfx('sfx/confirm')
  },
})
