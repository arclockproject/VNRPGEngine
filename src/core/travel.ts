// Types for src/content/travel.ts (game.travel: fast travel and the world map). Must not import
// content: ids come from the generated plain unions.
import type { ContentIds } from '@/generated/registry.gen'

type MapId = ContentIds['maps']

export interface TravelPlace {
  name: string
  description?: string
  /** The map it leads to. */
  map: MapId
  /** A spawn point of that map. Default: its first spawn. */
  spawn?: string
  /** false = not on the list until found (see `discoverOnVisit`, game.travel.discover). Default true. */
  known?: boolean
  /** Where it sits on the world map, in % of the picture (0,0 = top left). */
  at?: { x: number; y: number }
  /** Money one trip here costs. */
  cost?: number
}

export interface TravelConfig<K extends string = string> {
  /** "Travel" in the pause menu, once two places are known. */
  inMenu: boolean
  /** Arriving on a place's map (by any way) adds the place to the list. */
  discoverOnVisit: boolean
  /** Maps the player cannot travel away from (a dungeon, the intro). */
  blockedMaps: readonly MapId[]
  worldMap: {
    /** Show the places on a board by their `at` instead of a plain list. */
    show: boolean
    /** A picture of the world (an imported image). Leave out = a plain board. */
    image?: string
    /** Width / height of the board (the picture's shape), e.g. 16 / 9. */
    ratio: number
  }
  places: Record<K, TravelPlace>
}

export function defineTravel<const K extends string>(config: TravelConfig<K>): TravelConfig<K> {
  return config
}
