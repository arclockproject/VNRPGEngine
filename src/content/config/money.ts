// The currency: how it is shown and how much a new game starts with. game.money.add(10) etc.
// Also how many of one item fit in the bag.
import { defineMoney } from '@/core/define'
import { tx } from '@/core/lang'

export default defineMoney({
  format: tx('{amount} coins'),
  start: 50,
  max: 999999,
  // Most of one item the player can carry, for items without their own `max`.
  itemStack: 99,
})
