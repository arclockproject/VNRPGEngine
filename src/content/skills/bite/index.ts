import { defineSkill } from '@/core/define'

// An enemy skill.
export default defineSkill({
  name: 'Bite',
  target: 'enemy',
  effects: [{ type: 'damage', power: 1.5 }],
})
