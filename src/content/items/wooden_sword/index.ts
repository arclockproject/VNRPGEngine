import { defineItem } from '@/core/define'
import icon from './icon.svg'

// Wearable: equip it in the Party window (or game.party.equip('hero', 'wooden_sword')).
export default defineItem({
  name: 'Wooden sword',
  description: 'Better than bare hands.',
  icon,
  price: 30,
  max: 1,
  // skills: usable in battle while the sword is worn.
  equip: { slot: 'weapon', stats: { attack: 3 }, skills: ['slash'] },
})
