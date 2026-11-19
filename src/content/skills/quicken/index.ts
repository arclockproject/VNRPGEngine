import { defineSkill } from '@/core/define'

export default defineSkill({
  name: 'Quicken',
  description: 'One ally acts more often for a while.',
  mp: 4,
  target: 'ally',
  delay: 0.6, // quick to cast
  effects: [{ type: 'status', status: 'haste' }],
})
