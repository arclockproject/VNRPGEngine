// game.shops: buying and selling (src/content/shops/<id>). Stock left per shop is saved.
import moneyConfig from '@/content/config/money'
import type { ShopConfig, ShopItem } from '../define'
import { getGame } from '../gameRef'
import { type ItemId, registry, type ShopId, shops as shopDefs } from '../registry'
import { useGameStore } from '../stores/game'
import { clock } from './clock'
import { difficulty } from './difficulty'
import { itemInfo, items } from './items'
import { money } from './money'

const DEFAULT_MAX = moneyConfig.itemStack

/**
 * Why a purchase or sale failed: 'money' (can't afford), 'stock' (sold out), 'full' (can't carry
 * more), 'missing' (player doesn't have it), 'refused' (shop doesn't sell/buy that).
 */
export type TradeResult = 'ok' | 'money' | 'stock' | 'full' | 'missing' | 'refused'

export interface ShopEntry {
  id: ItemId
  price: number
  /** Left in stock (Infinity = no limit). */
  stock: number
}

export interface SellEntry {
  id: ItemId
  count: number
  price: number
}

const def = (shop: ShopId) => (shopDefs as Record<string, ShopConfig>)[shop] as ShopConfig
const entry = (shop: ShopId, item: ItemId) => def(shop).items[item] as ShopItem | undefined

/** Bought counts per item for today (empty when the shop restocked). */
function sold(shop: ShopId): Record<string, number> {
  const state = useGameStore.getState().shops[shop]
  if (!state) return {}
  if (def(shop).restock !== 'never' && state.day !== clock.day()) return {}
  return state.sold
}

export const shops = {
  /** Opens the shop window. */
  open(shop: ShopId): void {
    getGame().windows.open('shop', { shop })
  },

  info(shop: ShopId): ShopConfig {
    return def(shop)
  },

  /** What one costs here. */
  price(shop: ShopId, item: ItemId): number {
    const listed = entry(shop, item)?.price
    const base = listed ?? (itemInfo(item).price ?? 0) * (def(shop).priceRate ?? 1)
    return Math.round(base * difficulty.rate('prices'))
  },

  /** What the shop pays the player for one (0 = it doesn't buy it). */
  sellPrice(shop: ShopId, item: ItemId): number {
    const { buys = true, sellRate = 0.5 } = def(shop)
    const accepted = buys === true || (Array.isArray(buys) && buys.includes(item))
    if (!accepted) return 0
    // Cheaper shops (difficulty) also pay less, so buying and selling back never makes money.
    return Math.floor(
      (itemInfo(item).price ?? 0) * sellRate * Math.min(1, difficulty.rate('prices')),
    )
  },

  /** Left in stock. Infinity = no limit; 0 = sold out or not sold here. */
  stock(shop: ShopId, item: ItemId): number {
    const listed = entry(shop, item)
    if (!listed) return 0
    if (listed.stock === undefined) return Number.POSITIVE_INFINITY
    return Math.max(0, listed.stock - (sold(shop)[item] ?? 0))
  },

  /** What the shop sells, in its file's order. */
  list(shop: ShopId): ShopEntry[] {
    return (Object.keys(def(shop).items) as ItemId[]).map((id) => ({
      id,
      price: shops.price(shop, id),
      stock: shops.stock(shop, id),
    }))
  },

  /** What the player could sell here. */
  sellable(shop: ShopId): SellEntry[] {
    return registry.items
      .map((id) => ({ id, count: items.count(id), price: shops.sellPrice(shop, id) }))
      .filter((e) => e.count > 0 && e.price > 0)
  },

  /** Why buying would fail (or 'ok'), without buying. */
  canBuy(shop: ShopId, item: ItemId, count = 1): TradeResult {
    if (!entry(shop, item)) return 'refused'
    if (shops.stock(shop, item) < count) return 'stock'
    if (items.count(item) + count > (itemInfo(item).max ?? DEFAULT_MAX)) return 'full'
    if (!money.canAfford(shops.price(shop, item) * count)) return 'money'
    return 'ok'
  },

  buy(shop: ShopId, item: ItemId, count = 1, options: { notify?: boolean } = {}): TradeResult {
    const result = shops.canBuy(shop, item, count)
    if (result !== 'ok') return result
    money.spend(shops.price(shop, item) * count)
    items.add(item, count, options)
    if (entry(shop, item)?.stock !== undefined) {
      const already = sold(shop)
      useGameStore.setState((s) => {
        s.shops[shop] = {
          day: clock.day(),
          sold: { ...already, [item]: (already[item] ?? 0) + count },
        }
      })
    }
    return 'ok'
  },

  sell(shop: ShopId, item: ItemId, count = 1): TradeResult {
    const price = shops.sellPrice(shop, item)
    if (price <= 0) return 'refused'
    if (!items.has(item, count)) return 'missing'
    if (money.get() + price * count > money.max()) return 'full'
    items.remove(item, count)
    money.add(price * count)
    return 'ok'
  },
}
