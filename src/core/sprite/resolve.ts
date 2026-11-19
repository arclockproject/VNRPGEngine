// Turns map objects that point at content (a character, an enemy, a prop, a door) into complete objects
// the World can draw and run. No PixiJS here.
import type {
  EnemyConfig,
  MapObject,
  MapObjectContext,
  PropContext,
  PropDefinition,
  PropertyValue,
  PropMemory,
} from '../define'
import {
  characters,
  type EnemyId,
  enemies as enemyRegistry,
  type MapId,
  props as propRegistry,
} from '../registry'
import { useGameStore } from '../stores/game'
import type { AsepriteSpriteData } from './types'

const props = propRegistry as Record<string, PropDefinition>
const enemies = enemyRegistry as Record<string, EnemyConfig>

/** The sprite sheet a map object is drawn with (its own, its prop's, enemy's or character's). */
export function objectSprite(object: MapObject): AsepriteSpriteData | undefined {
  if (object.sprite) return object.sprite
  if (object.enemy) {
    const def = enemies[object.enemy]
    return def?.sprite ?? def?.battleSprite
  }
  if (object.prop) return props[object.prop]?.sprite as AsepriteSpriteData | undefined
  if (object.character)
    return characters[object.character]?.sprite as AsepriteSpriteData | undefined
  return undefined
}

/** Saved values of one prop on one map. */
export function propMemory(mapId: string, propId: string): PropMemory {
  const key = `${mapId}|${propId}`
  return {
    get: (name) => useGameStore.getState().propMemory[key]?.[name],
    set: (name, value) =>
      useGameStore.setState((s) => {
        const entry = { ...s.propMemory[key] }
        if (value === null) delete entry[name]
        else entry[name] = value
        if (Object.keys(entry).length === 0) delete s.propMemory[key]
        else s.propMemory[key] = entry
      }),
  }
}

function propContext(
  ctx: MapObjectContext,
  id: string,
  properties: Record<string, PropertyValue>,
  mapId: string,
): PropContext {
  return { ...ctx, prop: ctx.world.npc(id), properties, memory: propMemory(mapId, id) }
}

const defined = <T extends object>(o: T): Partial<T> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>

/**
 * Props get their prop's sprite, collision and behaviour (fields set on the object win).
 * Doors without their own hooks get one that changes map.
 */
export function resolveObject(object: MapObject, mapId: string): MapObject {
  let o = object
  if (o.prop) {
    const def = props[o.prop]
    if (!def) {
      console.warn(`[map] unknown prop "${o.prop}" (no src/content/props/${o.prop})`)
      return { ...o, prop: undefined }
    }
    const id = o.id ?? `${o.prop}_${o.at.x}_${o.at.y}`
    const properties = o.properties ?? {}
    type Hook = ((ctx: PropContext) => void) | undefined
    const wrap = (hook: Hook) =>
      hook && ((ctx: MapObjectContext) => hook(propContext(ctx, id, properties, mapId)))
    o = {
      sprite: def.sprite as AsepriteSpriteData,
      label: def.label,
      light: def.light,
      solid: def.solid ?? true,
      animation: def.animation,
      facing: def.facing,
      turnToPlayer: def.turnToPlayer ?? false,
      onInteract: wrap(def.onInteract as Hook),
      onEnter: wrap(def.onEnter as Hook),
      pushable: def.pushable,
      pushReset: def.pushReset,
      onPushed: wrap(def.onPushed as Hook) as MapObject['onPushed'],
      ...defined(o),
      at: o.at,
      id,
      properties,
    }
  }
  if (o.enemy) o = resolveEnemy(o, mapId)
  const door = o.door
  if (door && !o.onEnter && !o.onInteract) {
    const go = ({ game }: MapObjectContext) =>
      (game.maps.go as (id: MapId, options: object) => Promise<void>)(door.map as MapId, {
        spawn: door.spawn,
        transition: door.transition,
      })
    o = door.interact ? { ...o, onInteract: go } : { ...o, onEnter: go }
  }
  return o
}

/** An enemy on the map: its sprite, an id, and a fight when the player interacts with it. */
function resolveEnemy(object: MapObject, mapId: string): MapObject {
  const enemy = object.enemy as EnemyId
  if (!enemies[enemy]) {
    console.warn(`[map] unknown enemy "${enemy}" (no src/content/enemies/${enemy})`)
    return { ...object, enemy: undefined }
  }
  const id = object.id ?? `enemy_${enemy}_${object.at.x}_${object.at.y}`
  const fight = object.fight ?? {}
  const onInteract: MapObject['onInteract'] = async ({ game, world }) => {
    const outcome = await game.battles.start({
      troop: fight.troop,
      enemies: fight.troop ? undefined : (fight.enemies ?? [enemy]),
      canFlee: fight.canFlee,
      background: fight.background,
    })
    if (outcome !== 'win' || fight.respawn) return
    propMemory(mapId, id).set('defeated', true)
    world.npc(id).hide()
  }
  return {
    sprite: objectSprite(object),
    solid: true,
    turnToPlayer: false,
    onInteract,
    ...defined(object),
    at: object.at,
    id,
  }
}

/** True for an enemy beaten earlier (it is left off the map). */
export function isDefeated(object: MapObject, mapId: string): boolean {
  return !!object.enemy && !!object.id && propMemory(mapId, object.id).get('defeated') === true
}

/** A prop's setup hook, ready to call once it is on the map (undefined if it has none). */
export function propSetup(object: MapObject, mapId: string) {
  const setup = object.prop ? props[object.prop]?.setup : undefined
  if (!setup || !object.id) return undefined
  const id = object.id
  return (ctx: MapObjectContext) =>
    (setup as (ctx: PropContext) => void)(propContext(ctx, id, object.properties ?? {}, mapId))
}
