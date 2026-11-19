// Money and shops: prices, stock, restocking by day, selling.
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/content/config/money', () => ({
  default: { format: '{amount} c', start: 30, max: 100, itemStack: 99 },
}))
vi.mock('../registry', () => ({
  items: {
    apple: { name: 'Apple', price: 5 },
    lamp: { name: 'Lamp', price: 20, max: 1 },
    rock: { name: 'Rock' },
  },
  shops: {
    stall: {
      name: 'Stall',
      items: { apple: {}, lamp: { price: 25, stock: 1 } },
      priceRate: 2,
      buys: ['apple'],
    },
    market: { name: 'Market', items: { apple: { stock: 2 } }, restock: 'never' },
  },
  registry: { items: ['apple', 'lamp', 'rock'] },
}))
vi.mock('../gameRef', () => ({ getGame: () => ({}) }))

const { useGameStore, emptyEngineState } = await import('../stores/game')
const { initialData } = await import('@/content/save/data')
const { money, startMoney } = await import('./money')
const { shops } = await import('./shops')
const { items } = await import('./items')
const { clock } = await import('./clock')

const DAY = 24 * 60
beforeEach(() => {
  useGameStore.setState({ data: initialData(), ...emptyEngineState(), money: startMoney() })
})

describe('money', () => {
  it('adds up to the max, spends only what is there, formats', () => {
    expect(money.get()).toBe(30)
    expect(money.add(500)).toBe(70)
    expect(money.spend(101)).toBe(false)
    expect(money.spend(40)).toBe(true)
    expect(money.get()).toBe(60)
    expect(money.format(3)).toBe('3 c')
  })
})

describe('shops', () => {
  it('prices: listed price, else item price × priceRate', () => {
    expect(shops.list('stall' as never)).toEqual([
      { id: 'apple', price: 10, stock: Number.POSITIVE_INFINITY },
      { id: 'lamp', price: 25, stock: 1 },
    ])
  })

  it('buy checks money, stock and carry limit', () => {
    expect(shops.buy('stall' as never, 'rock' as never)).toBe('refused')
    expect(shops.buy('stall' as never, 'lamp' as never)).toBe('ok')
    expect(money.get()).toBe(5)
    expect(items.count('lamp' as never)).toBe(1)
    expect(shops.canBuy('stall' as never, 'lamp' as never)).toBe('stock')
    expect(shops.buy('stall' as never, 'apple' as never)).toBe('money')
    money.set(100)
    useGameStore.setState((s) => {
      s.shops = {}
    }) // restocked, but the lamp max is 1
    expect(shops.canBuy('stall' as never, 'lamp' as never)).toBe('full')
  })

  it('stock refills on a new day (unless restock is never)', () => {
    money.set(100)
    shops.buy('stall' as never, 'lamp' as never)
    shops.buy('market' as never, 'apple' as never, 2)
    items.remove('lamp' as never)
    expect(shops.stock('stall' as never, 'lamp' as never)).toBe(0)
    clock.set(8, 0, { nextDay: true })
    expect(useGameStore.getState().clockMinutes).toBeGreaterThan(DAY)
    expect(shops.stock('stall' as never, 'lamp' as never)).toBe(1)
    expect(shops.stock('market' as never, 'apple' as never)).toBe(0)
  })

  it('sells only what the shop buys, at sellRate (default half)', () => {
    items.add('apple' as never, 3)
    items.add('lamp' as never, 1)
    expect(shops.sellable('stall' as never)).toEqual([{ id: 'apple', count: 3, price: 2 }])
    expect(shops.sell('stall' as never, 'lamp' as never)).toBe('refused')
    expect(shops.sell('stall' as never, 'apple' as never, 4)).toBe('missing')
    expect(shops.sell('stall' as never, 'apple' as never, 3)).toBe('ok')
    expect(money.get()).toBe(36)
    money.set(100)
    items.add('apple' as never, 1)
    expect(shops.sell('stall' as never, 'apple' as never)).toBe('full') // wallet is full
  })
})
