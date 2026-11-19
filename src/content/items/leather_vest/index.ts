import { defineItem } from '@/core/define'
import icon from './icon.svg'

// Wearable: equip it in the Party window (or game.party.equip('hero', 'leather_vest')).
export default defineItem({
  name: 'Leather vest',
  description: 'Soft, but it helps.',
  icon,
  price: 25,
  max: 1,
  equip: { slot: 'armor', stats: { defense: 2, hp: 5 } },
})
