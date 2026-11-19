import { defineTroop } from '@/core/define'

export default defineTroop({
  enemies: ['wolf', 'wolf', 'bat'],
  background: 'forest',
  canFlee: false,
  // Instead of what each enemy gives:
  rewards: { xp: 60, money: 40, drops: [{ item: 'bread', chance: 1 }] },
})
