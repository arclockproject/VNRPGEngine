import { defineSkill } from '@/core/define'

// An enemy skill: no damage, the whole party takes more damage for a while.
export default defineSkill({
  name: 'Screech',
  mp: 3,
  target: 'all_enemies',
  effects: [{ type: 'status', status: 'brittle', chance: 0.8 }],
})
