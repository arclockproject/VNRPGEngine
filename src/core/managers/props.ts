// game.props: spawn props (src/content/props/<name>) into maps at runtime. Saved spawns are
// remembered per map (and in save files); unsaved ones vanish when the map changes.
import type { Facing, NpcApi, PropDefinition, PropertyValue, TilePos } from '../define'
import { lang } from '../lang'
import { type MapId, type PropAnimationOf, type PropId, props as propRegistry } from '../registry'
import { spriteSheet } from '../sprite/types'
import { type PropPlacement, useGameStore } from '../stores/game'
import { useSystemStore } from '../stores/system'
import { getWorld, peekWorld } from '../world/getWorld'
import { npcHandle } from '../world/npc'
import { addInUse } from '../world/textures'

const propDefs = propRegistry as Record<string, PropDefinition>

export interface SpawnOptions {
  /** Tile it stands on. */
  at: TilePos
  /** Instance id (default: prop name + tile). Spawning the same id again replaces it. */
  id?: string
  /** Which map (default: the current one). Saved spawns on other maps appear when entered. */
  map?: MapId
  facing?: Facing
  /** Custom values the prop's hooks get as `properties`. */
  properties?: Record<string, PropertyValue>
  /** Remember it (default true). False = only until the map changes. */
  save?: boolean
}

const currentMap = () => useSystemStore.getState().map?.id

function record(map: string, placement: PropPlacement | null, removeId: string) {
  useGameStore.setState((s) => {
    const list = (s.props[map] ?? []).filter((p) => p.id !== removeId)
    if (placement) list.push(placement)
    if (list.length > 0) s.props[map] = list
    else delete s.props[map]
  })
}

/** Saved spawns of a map (the maps manager adds them after building it). */
export function placedProps(map: string): PropPlacement[] {
  return useGameStore.getState().props[map] ?? []
}

export const props = {
  /** Puts a prop on a map. Resolves with its id. */
  async spawn<K extends PropId>(prop: K, options: SpawnOptions): Promise<string> {
    const def = propDefs[prop]
    if (!def) throw new Error(`props.spawn: unknown prop "${prop}"`)
    const id = options.id ?? `${prop}_${options.at.x}_${options.at.y}`
    const map = options.map ?? currentMap()
    if (!map) throw new Error('props.spawn: no map is shown (pass `map`)')
    const placement: PropPlacement = {
      id,
      prop,
      at: { ...options.at },
      ...(options.facing ? { facing: options.facing } : {}),
      ...(options.properties ? { properties: { ...options.properties } } : {}),
    }
    if (options.save !== false) record(map, placement, id)
    if (map === currentMap()) {
      const world = await getWorld()
      addInUse(await world.preloadSprites([spriteSheet(def.sprite, lang.current())]))
      world.addProp(placement)
    }
    return id
  },

  /** Removes a spawned prop (current map, or `map`). Props placed in Tiled can't be removed. */
  async remove(id: string, options: { map?: MapId } = {}): Promise<void> {
    const map = options.map ?? currentMap()
    if (!map) return
    record(map, null, id)
    if (map === currentMap()) (await getWorld()).removeProp(id)
  },

  /** Whether a saved spawn with this id exists (current map, or `map`). */
  has(id: string, options: { map?: MapId } = {}): boolean {
    const map = options.map ?? currentMap()
    return !!map && placedProps(map).some((p) => p.id === id)
  },

  /** Saved spawns (current map, or `map`). */
  list(options: { map?: MapId } = {}): PropPlacement[] {
    const map = options.map ?? currentMap()
    return map ? [...placedProps(map)] : []
  },

  /** Script a prop on the current map (spawned or placed in Tiled): play, face, walk… */
  get<K extends PropId>(id: string, _prop?: K): NpcApi<PropAnimationOf<K>> {
    const world = peekWorld()
    return (
      world
        ? world.npc(id)
        : npcHandle(
            id,
            () => undefined,
            () => undefined,
          )
    ) as NpcApi<PropAnimationOf<K>>
  },
}
