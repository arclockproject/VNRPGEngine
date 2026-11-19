// game.structures: stamp small Tiled maps (src/content/structures/<name>) into maps at runtime.
// Placements are remembered per map and saved, so a built house stays built.
import type { StructureConfig, TilePos } from '../define'
import { loadStructure, type MapId, type StructureId } from '../registry'
import { type StructurePlacement, useGameStore } from '../stores/game'
import { useSystemStore } from '../stores/system'
import { getWorld } from '../world/getWorld'
import { type Layout, layoutFromTiled, placementProblem } from '../world/layout'
import { addInUse } from '../world/textures'

export interface PlaceOptions {
  /** Where the structure's top-left tile goes. */
  at: TilePos
  /** Instance id (default: the structure name). Placing the same id again moves/replaces it. */
  id?: string
  /** Which map (default: the current one). Other maps get it the next time they are entered. */
  map?: MapId
  /**
   * Place it no matter what: parts outside the map are cut off, and if a wall lands on the player
   * they are moved to the nearest walkable tile (that happens for normal placements too).
   */
  force?: boolean
}

const layouts = new Map<string, Promise<Layout>>()

/** Loads (once) a structure and turns it into a layout. */
export function structureLayout(structure: StructureId | string): Promise<Layout> {
  let layout = layouts.get(structure)
  if (!layout) {
    layout = (loadStructure(structure as StructureId) as Promise<StructureConfig<string>>).then(
      (def) => layoutFromTiled({ tiled: def.tiled, objects: def.objects }),
    )
    layout.catch(() => layouts.delete(structure))
    layouts.set(structure, layout)
  }
  return layout
}

/** Dev: forget a structure's layout after its files changed (hot update). */
export function forgetStructureLayout(structure: string) {
  layouts.delete(structure)
}

/** Layouts for everything placed in `map` (used when the map is built). */
export async function placedLayouts(
  map: MapId,
): Promise<{ id: string; layout: Layout; at: TilePos }[]> {
  const placements = useGameStore.getState().structures[map] ?? []
  return Promise.all(
    placements.map(async (p) => ({
      id: p.id,
      layout: await structureLayout(p.structure),
      at: p.at,
    })),
  )
}

const currentMap = () => useSystemStore.getState().map?.id

function record(map: string, placement: StructurePlacement | null, removeId: string) {
  useGameStore.setState((s) => {
    const list = (s.structures[map] ?? []).filter((p) => p.id !== removeId)
    if (placement) list.push(placement)
    s.structures[map] = list
  })
}

export const structures = {
  /**
   * Stamps a structure into a map: its tiles, collision and objects (with their behaviour).
   * Resolves with the instance id. Throws if it doesn't fit, or would trap the player,
   * unless `force` is set.
   */
  async place(structure: StructureId, options: PlaceOptions): Promise<string> {
    const id = options.id ?? structure
    const map = options.map ?? currentMap()
    if (!map) throw new Error('structures.place: no map is shown (pass `map`)')
    const layout = await structureLayout(structure)
    const placement: StructurePlacement = { id, structure, at: { ...options.at } }

    if (map === currentMap()) {
      const world = await getWorld()
      const size = world.size()
      const player = world.api().player
      const problem = size && placementProblem(size, { layout, at: options.at }, player)
      if (problem && !options.force) {
        throw new Error(
          `Can't place "${structure}" here: ${problem} (use force: true to place it anyway)`,
        )
      }
      addInUse(await world.preload(layout))
      world.addStructure(id, layout, options.at)
    }
    record(map, placement, id)
    return id
  },

  /** Removes a placed structure (from the current map, or `map`). */
  async remove(id: string, options: { map?: MapId } = {}): Promise<void> {
    const map = options.map ?? currentMap()
    if (!map) return
    record(map, null, id)
    if (map === currentMap()) (await getWorld()).removeStructure(id)
  },

  /** Whether `id` is placed (in the current map, or `map`). */
  has(id: string, options: { map?: MapId } = {}): boolean {
    const map = options.map ?? currentMap()
    return !!map && (useGameStore.getState().structures[map] ?? []).some((p) => p.id === id)
  },

  list(options: { map?: MapId } = {}): StructurePlacement[] {
    const map = options.map ?? currentMap()
    return map ? [...(useGameStore.getState().structures[map] ?? [])] : []
  },

  /** Why `structure` can't be placed at `at` in the current map (null = it can). */
  async canPlace(structure: StructureId, at: TilePos): Promise<string | null> {
    const world = await getWorld()
    const size = world.size()
    if (!size) return 'no map is shown'
    return placementProblem(
      size,
      { layout: await structureLayout(structure), at },
      world.api().player,
    )
  },
}
