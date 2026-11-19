import { defineSkill } from '@/core/define'

export default defineSkill({
  name: 'Fire',
  description: 'Burns every enemy a little. May leave them burning.',
  mp: 5,
  target: 'all_enemies',
  element: 'fire',
  effects: [
    { type: 'damage', power: 1.1, uses: 'magic', against: 'resistance' },
    { type: 'status', status: 'burn', chance: 0.3 },
  ],
})
