// game.crafting: making items from other items. Recipes: src/content/recipes.ts; the window:
// src/content/windows/crafting.
import config from '@/content/recipes'
import { audio } from '../audio/manager'
import type { RecipeConfig } from '../crafting'
import { t } from '../lang'
import type { ItemId } from '../registry'
import { useGameStore } from '../stores/game'
import { toast } from '../ui/toast'
import { itemInfo, items } from './items'
import { money } from './money'
import { windows } from './windows'

export type RecipeId = Extract<keyof typeof config.recipes, string>

/** Why a recipe cannot be made right now. */
export type CraftProblem = 'unknown' | 'station' | 'items' | 'tools' | 'money' | 'full'

/** A recipe as the window shows it. */
export interface RecipeView {
  id: RecipeId
  recipe: RecipeConfig
  /** Already translated. */
  name: string
  description: string
  icon: string | undefined
  needs: { id: ItemId; name: string; need: number; have: number }[]
  tools: { id: ItemId; name: string; have: boolean }[]
  /** null = it can be made now. */
  problem: CraftProblem | null
}

const recipes = config.recipes as Record<string, RecipeConfig>
const learned = () => useGameStore.getState().recipes ?? {}
const needsOf = (recipe: RecipeConfig) => Object.entries(recipe.needs) as [ItemId, number][]

export const crafting = {
  /** Whether the player knows a recipe (known from the start, or learned). */
  knows(id: RecipeId): boolean {
    const recipe = recipes[id]
    return !!recipe && ((recipe.known ?? true) || learned()[id] === true)
  },

  /** Teaches a recipe marked `known: false`. `notify` shows a toast. Returns false if already known. */
  learn(id: RecipeId, options: { notify?: boolean } = {}): boolean {
    if (!recipes[id]) {
      console.warn(`[crafting] unknown recipe "${id}" (src/content/recipes.ts)`)
      return false
    }
    if (crafting.knows(id)) return false
    useGameStore.setState((s) => {
      s.recipes = { ...s.recipes, [id]: true }
    })
    if (options.notify)
      toast(t('New recipe: {name}', { name: crafting.view(id).name }), {
        kind: 'recipe',
        params: { recipe: id },
      })
    return true
  },

  forget(id: RecipeId): void {
    useGameStore.setState((s) => {
      const rest = { ...s.recipes }
      delete rest[id]
      s.recipes = rest
    })
  },

  /**
   * Why it cannot be made (`count` times) at this station, or null when it can.
   * `station` undefined = away from any station (the pause menu).
   */
  problem(id: RecipeId, station?: string, count = 1): CraftProblem | null {
    const recipe = recipes[id]
    if (!recipe || !crafting.knows(id)) return 'unknown'
    if (recipe.station !== undefined && recipe.station !== station) return 'station'
    if (needsOf(recipe).some(([item, need]) => items.count(item) < need * count)) return 'items'
    if ((recipe.tools ?? []).some((tool) => !items.has(tool))) return 'tools'
    if (recipe.cost && !money.canAfford(recipe.cost * count)) return 'money'
    // Room for what is made (what is used up frees room only for the same item).
    const made = (recipe.count ?? 1) * count
    const max = itemInfo(recipe.makes).max ?? Number.POSITIVE_INFINITY
    const used = (recipe.needs[recipe.makes] ?? 0) * count
    if (items.count(recipe.makes) - used + made > max) return 'full'
    return null
  },

  canMake(id: RecipeId, station?: string, count = 1): boolean {
    return crafting.problem(id, station, count) === null
  },

  /**
   * Makes it `count` times: takes the items and money, gives the result. Returns null when done,
   * or why not (nothing is taken then). `notify` (default true) shows what was made.
   */
  make(
    id: RecipeId,
    options: { station?: string; count?: number; notify?: boolean } = {},
  ): CraftProblem | null {
    const count = Math.max(1, Math.floor(options.count ?? 1))
    const problem = crafting.problem(id, options.station, count)
    if (problem) return problem
    const recipe = recipes[id] as RecipeConfig
    for (const [item, need] of needsOf(recipe)) items.remove(item, need * count)
    if (recipe.cost) money.spend(recipe.cost * count)
    items.add(recipe.makes, (recipe.count ?? 1) * count, { notify: options.notify ?? true })
    if (config.sound && audio.has(config.sound)) audio.sfx(config.sound)
    return null
  },

  /** One recipe with names, counts in the bag and whether it can be made at this station. */
  view(id: RecipeId, station?: string): RecipeView {
    const recipe = recipes[id] as RecipeConfig
    const item = itemInfo(recipe.makes)
    return {
      id,
      recipe,
      name: t(recipe.name ?? item.name),
      description: t(recipe.description ?? item.description ?? ''),
      icon: item.icon,
      needs: needsOf(recipe).map(([needId, need]) => ({
        id: needId,
        name: t(itemInfo(needId).name),
        need,
        have: items.count(needId),
      })),
      tools: (recipe.tools ?? []).map((tool) => ({
        id: tool,
        name: t(itemInfo(tool).name),
        have: items.has(tool),
      })),
      problem: crafting.problem(id, station),
    }
  },

  /**
   * The known recipes that can be made at this station (undefined = the ones that need none), in
   * the order of the file.
   */
  list(station?: string): RecipeView[] {
    return (Object.keys(recipes) as RecipeId[])
      .filter((id) => crafting.knows(id) && recipes[id]?.station === station)
      .map((id) => crafting.view(id, station))
  },

  /** Whether the pause menu should offer "Crafting". */
  inMenu(): boolean {
    return config.inMenu && crafting.list().length > 0
  },

  /** Opens the crafting window: at a station ('campfire'), or without one. */
  open(station?: string): void {
    ;(windows.open as (id: string, params: unknown) => void)('crafting', { station })
  },
}

/** React: the recipes for a station, re-drawn when the bag, the money or what is known changes. */
export function useRecipes(station?: string): RecipeView[] {
  useGameStore((s) => s.data.inventory)
  useGameStore((s) => s.money)
  useGameStore((s) => s.recipes)
  return crafting.list(station)
}
