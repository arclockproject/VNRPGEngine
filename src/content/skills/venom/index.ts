import { defineSkill } from '@/core/define'

// An enemy skill: weak hit, likely poison.
export default defineSkill({
  name: 'Venom',
  target: 'enemy',
  element: 'poison',
  effects: [
    { type: 'damage', power: 0.6 },
    { type: 'status', status: 'poison', chance: 0.7 },
  ],
})
