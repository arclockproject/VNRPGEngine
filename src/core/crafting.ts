// Types for src/content/recipes.ts (game.crafting). Must not import content: ids come from the
// generated plain unions.
import type { ContentIds } from '@/generated/registry.gen'

type ItemId = ContentIds['items']

export interface RecipeConfig {
  /** The item made. */
  makes: ItemId
  /** How many one crafting gives. Default 1. */
  count?: number
  /** Items used up: { apple: 2, bread: 1 }. */
  needs: Partial<Record<ItemId, number>>
  /** Items that must be in the bag but are not used up (a knife, a hammer). */
  tools?: readonly ItemId[]
  /** Money it costs. */
  cost?: number
  /**
   * Where it can be made: a name of your own ('campfire', 'forge'). Open the crafting window
   * there with game.crafting.open('campfire'). Leave out = anywhere (the pause menu).
   */
  station?: string
  /** false = hidden until game.crafting.learn('id') (a recipe book, a teacher). Default true. */
  known?: boolean
  /** Shown instead of the item's name. */
  name?: string
  /** Shown instead of the item's description. */
  description?: string
}

export interface RecipesConfig<K extends string = string> {
  /** Shows "Crafting" in the pause menu when a known recipe needs no station. */
  inMenu: boolean
  /** A sound id played when something is made ('sfx/craft'). */
  sound?: string
  recipes: Record<K, RecipeConfig>
}

export function defineRecipes<const K extends string>(config: RecipesConfig<K>): RecipesConfig<K> {
  return config
}
