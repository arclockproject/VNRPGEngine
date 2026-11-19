import { defineSkill } from '@/core/define'

// Comes with the wooden sword (items/wooden_sword: equip.skills), gone when it is taken off.
export default defineSkill({
  name: 'Slash',
  description: 'A wide swing that hits every enemy.',
  mp: 3,
  target: 'all_enemies',
  effects: [{ type: 'damage', power: 0.8 }],
})
