import { defineItem } from '@/core/define'
import icon from './icon.svg'

// Wearable: equip it in the Party window (or game.party.equip('hero', 'lucky_charm')).
export default defineItem({
  name: 'Lucky charm',
  description: 'Light on your feet, and never sleepy.',
  icon,
  price: 20,
  max: 1,
  equip: { slot: 'accessory', stats: { speed: 2, luck: 5 }, immune: ['sleep'] },
})
