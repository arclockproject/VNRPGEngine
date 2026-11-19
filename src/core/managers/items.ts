// game.items: the player's inventory, with typed item ids (src/content/items/<id>).
// Counts are stored in the saved game data (data.inventory: id -> count).
import { useMemo } from 'react'
import moneyConfig from '@/content/config/money'
import type { ItemChangeContext, ItemConfig, LightConfig } from '../define'
import { getGame } from '../gameRef'
import { t } from '../lang'
import { type ItemId, items as itemDefs, registry } from '../registry'
import { useGameStore } from '../stores/game'
import { toast } from '../ui/toast'

const DEFAULT_MAX = moneyConfig.itemStack

export interface InventoryEntry {
  id: ItemId
  count: number
  item: ItemConfig
}

/** An item id that is no longer in src/content/items (e.g. from an old save). */
const unknownItem = (id: string): ItemConfig => ({ name: id, description: '(unknown item)' })

export function itemInfo(id: string): ItemConfig {
  return itemDefs[id as ItemId] ?? unknownItem(id)
}

/** Runs an item's onObtain / onLose (they may be async; errors are only logged). */
function notify(hook: 'onObtain' | 'onLose', id: ItemId, count: number) {
  const run = itemInfo(id)[hook] as ((ctx: ItemChangeContext) => unknown) | undefined
  if (!run || count <= 0) return
  Promise.resolve()
    .then(() => run({ game: getGame(), id, count, total: items.count(id) }))
    .catch((error) => console.error(`[items]  of "" failed`, error))
}

function entries(inventory: Record<string, number>): InventoryEntry[] {
  // Registry order first (stable, alphabetical), unknown leftovers at the end.
  const known = registry.items.filter((id) => (inventory[id] ?? 0) > 0)
  const unknown = Object.keys(inventory).filter(
    (id) => !(id in itemDefs) && (inventory[id] ?? 0) > 0,
  )
  return [...known, ...(unknown as ItemId[])].map((id) => ({
    id,
    count: inventory[id] ?? 0,
    item: itemInfo(id),
  }))
}

export const items = {
  /** The item's definition (name, icon, …). */
  info(id: ItemId): ItemConfig {
    return itemInfo(id)
  },

  count(id: ItemId): number {
    return useGameStore.getState().data.inventory[id] ?? 0
  },

  has(id: ItemId, count = 1): boolean {
    return items.count(id) >= count
  },

  /**
   * Adds items (up to the item's `max`). Returns how many were really added.
   * `notify` shows a short message ("Got Apple ×2").
   */
  add(id: ItemId, count = 1, options: { notify?: boolean } = {}): number {
    if (!(id in itemDefs)) console.warn(`[items] unknown item "${id}"`)
    const max = itemInfo(id).max ?? DEFAULT_MAX
    const before = items.count(id)
    const after = Math.min(max, before + Math.max(0, count))
    useGameStore.setState((s) => {
      s.data.inventory[id] = after
    })
    const added = after - before
    notify('onObtain', id, added)
    if (options.notify && added > 0) {
      const name = t(itemInfo(id).name)
      toast(added > 1 ? `${name} ×${added}` : name, {
        icon: itemInfo(id).icon,
        kind: 'item',
        params: { item: id, count: added },
      })
    }
    return added
  },

  /** Takes items away. If there aren't enough, nothing is taken and it returns false. */
  remove(id: ItemId, count = 1): boolean {
    const have = items.count(id)
    if (have < count) return false
    useGameStore.setState((s) => {
      if (have - count > 0) s.data.inventory[id] = have - count
      else delete s.data.inventory[id]
    })
    notify('onLose', id, count)
    return true
  },

  /** Uses one: runs its `use` and then removes one (unless keepOnUse). False if not usable. */
  async use(id: ItemId): Promise<boolean> {
    const item = itemInfo(id)
    if (!item.use || !items.has(id)) return false
    await item.use({ game: getGame(), id })
    if (!item.keepOnUse) items.remove(id)
    return true
  },

  /** Is this item switched on (a lit lantern)? Saved. Items start off. */
  isOn(id: ItemId): boolean {
    return useGameStore.getState().itemsOn[id] ?? false
  },

  /** Switches an item on or off (see ItemConfig.light). */
  setOn(id: ItemId, on: boolean): void {
    useGameStore.setState((s) => {
      if (on) s.itemsOn[id] = true
      else delete s.itemsOn[id]
    })
  },

  /** Flips on / off. Returns the new state. */
  toggle(id: ItemId): boolean {
    const on = !items.isOn(id)
    items.setOn(id, on)
    return on
  },

  /** Lights of the carried items that are switched on (drawn around the player). */
  lights(): LightConfig[] {
    const { itemsOn, data } = useGameStore.getState()
    const result: LightConfig[] = []
    for (const id of Object.keys(itemsOn)) {
      const light = itemInfo(id).light
      if (light && (data.inventory[id] ?? 0) > 0) result.push(light)
    }
    return result
  },

  /** The inventory button's text for a usable item, translated ("Use" unless it sets `useLabel`). */
  actionLabel(id: ItemId): string {
    const label = itemInfo(id).useLabel
    return typeof label === 'function'
      ? label({ game: getGame(), id })
      : label
        ? t(label)
        : t('Use')
  },

  /** Everything the player carries. */
  list(): InventoryEntry[] {
    return entries(useGameStore.getState().data.inventory)
  },
}

/** React: the inventory as a list (re-renders when it changes). */
export function useInventory(): InventoryEntry[] {
  const inventory = useGameStore((s) => s.data.inventory)
  return useMemo(() => entries(inventory), [inventory])
}

/** React: which items are switched on (re-renders when one is toggled). */
export function useItemsOn(): Record<string, boolean> {
  return useGameStore((s) => s.itemsOn)
}

/** React: how many of one item the player has. */
export function useItemCount(id: ItemId): number {
  return useGameStore((s) => s.data.inventory[id] ?? 0)
}
