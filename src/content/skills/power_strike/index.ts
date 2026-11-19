import { defineSkill } from '@/core/define'

export default defineSkill({
  name: 'Power strike',
  description: 'A heavy hit on one enemy. The next turn comes later.',
  mp: 3,
  target: 'enemy',
  delay: 1.4, // slower than a normal action (1)
  effects: [{ type: 'damage', power: 1.9 }],
})
