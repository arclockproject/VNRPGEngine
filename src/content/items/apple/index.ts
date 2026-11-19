import { defineItem } from '@/core/define'
import icon from './icon.svg'

export default defineItem({
  name: 'Apple',
  description: 'Crunchy. Restores 10 health.',
  icon,
  price: 5,
  battle: { effects: [{ type: 'heal', amount: 10 }] }, // in battle: heals 10 HP
  use: ({ game }) => {
    game.state.update((d) => {
      d.stats.health = Math.min(100, d.stats.health + 10)
    })
    game.audio.sfx('sfx/confirm')
  },
})
