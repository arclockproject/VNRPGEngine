import { defineSkill } from '@/core/define'

export default defineSkill({
  name: 'Heal',
  description: 'Restores HP to one ally and cures poison.',
  mp: 4,
  target: 'ally',
  // 10 + 1.2 × the healer's magic.
  effects: [
    { type: 'heal', amount: 10, power: 1.2 },
    { type: 'cure', status: 'poison' },
  ],
})
