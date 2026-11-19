import { defineShop } from '@/core/define'

// game.shops.open('anna'). Prices default to each item's `price`.
export default defineShop({
  name: "Anna's stall",
  items: {
    apple: {},
    bread: { stock: 5 },
    lantern: { price: 40, stock: 1 },
    wooden_sword: { stock: 1 },
    leather_vest: { stock: 1 },
    lucky_charm: { stock: 1 },
  },
  buys: ['apple', 'bread', 'lantern'],
  sellRate: 0.5,
  restock: 'daily',
})
