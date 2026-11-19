import { defineTroop } from '@/core/define'

// A named fight: game.battles.start('slimes'), `battle slimes` in a .vn file, an encounter zone's
// `groups`, or a map enemy's `fight: { troop }`.
export default defineTroop({
  enemies: ['slime', 'slime'],
})
