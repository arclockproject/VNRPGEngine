import { defineSkill } from '@/core/define'

export default defineSkill({
  name: 'Trip',
  description: "A light hit that pushes the enemy's next turn back.",
  mp: 2,
  target: 'enemy',
  effects: [
    { type: 'damage', power: 0.7 },
    // Chained: only when the hit above lands. `evenOnMiss: true` would make it happen either way,
    // and `chance: 0.5` would give it its own roll.
    { type: 'delay', amount: 0.5 }, // half of one of its turns
  ],
})
