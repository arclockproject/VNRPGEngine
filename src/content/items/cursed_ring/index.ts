import { defineItem } from '@/core/define'
import icon from './icon.svg'

// Worn equipment that acts by itself in battle (equip.battle): each turn it heals the wearer, but
// keeps them poisoned.
export default defineItem({
  name: 'Cursed ring',
  description: 'Mends its wearer every turn. The poison is the price.',
  icon,
  price: 60,
  max: 1,
  equip: {
    slot: 'accessory',
    stats: { magic: 2 },
    battle: {
      // Once, when the fight begins:
      onStart: [{ type: 'status', status: 'strong' }],
      // At the start of each of the wearer's turns:
      onTurn: [
        { type: 'heal', amount: 6 },
        { type: 'status', status: 'poison', turns: 1 },
      ],
    },
  },
})
