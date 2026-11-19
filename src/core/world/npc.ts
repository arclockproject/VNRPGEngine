// The NpcApi handle scripts get from world.npc(id) / game.maps.npc(id). No PixiJS here, so the
// maps manager can hand out handles before (or without) the World chunk being loaded.
import type { Facing, NpcApi, TilePos, WalkStep } from '../define'
import { facingToward } from '../sprite/anim'
import { bubbleLook } from './mapLook'

/** How long a speech bubble stays by default: longer for longer text (1.5 s to 6 s). */
/** How long a bark stays when it gives no duration (src/content/look/map.ts bubble.time). */
export const barkDuration = (text: string) => {
  const { minMs, maxMs, baseMs, perLetterMs } = bubbleLook.time
  return Math.min(maxMs, Math.max(minMs, baseMs + text.length * perLetterMs))
}

/** What a handle needs from an Actor (see world/actor.ts). */
export interface ActorLike {
  readonly x: number
  readonly y: number
  readonly facing: Facing
  speed: number
  face(facing: Facing): void
  play(state: string, options?: { times?: number; hold?: boolean }): Promise<void>
  idle(state?: string): void
  walk(steps: readonly WalkStep[]): Promise<void>
  teleport(pos: TilePos, facing?: Facing): void
  hidden: boolean
  setHidden(hidden: boolean): void
}

/**
 * A handle that looks the actor up on every call, so it stays valid across map changes
 * (and simply does nothing while that NPC isn't on the map).
 */
export function npcHandle(
  id: string,
  find: () => ActorLike | undefined,
  player: () => { x: number; y: number } | undefined,
  /** Walk steps from the actor to a tile around walls, or null (no map / unreachable). */
  pathTo: (actor: ActorLike, to: TilePos, speed?: number) => WalkStep[] | null = () => null,
  /** Shows a speech bubble over this NPC. */
  bark: (text: string, options?: { duration?: number }) => Promise<void> = () => Promise.resolve(),
  /** Shows an emote balloon over this NPC. */
  emote: (name: string, options?: { duration?: number }) => Promise<void> = () => Promise.resolve(),
): NpcApi {
  const warned = { done: false }
  const get = () => {
    const actor = find()
    if (!actor && !warned.done) {
      warned.done = true
      console.warn(`[map] npc("${id}"): no sprite object called "${id}" on this map`)
    }
    return actor
  }
  const resolveFacing = (actor: ActorLike, direction: Facing | 'player') => {
    if (direction !== 'player') return direction
    const p = player()
    // Actor x/y is the top-left of its tile; the player position is a centre.
    return p ? facingToward({ x: actor.x + 0.5, y: actor.y + 0.5 }, p, actor.facing) : actor.facing
  }
  return {
    id,
    get exists() {
      return find() !== undefined
    },
    get x() {
      return find()?.x ?? 0
    },
    get y() {
      return find()?.y ?? 0
    },
    get facing() {
      return find()?.facing ?? 'down'
    },
    get speed() {
      return find()?.speed ?? 0
    },
    set speed(value) {
      const actor = get()
      if (actor) actor.speed = value
    },
    face(direction) {
      const actor = get()
      if (actor) actor.face(resolveFacing(actor, direction))
    },
    play(animation, options = {}) {
      const actor = get()
      if (!actor) return Promise.resolve()
      if (options.facing) actor.face(resolveFacing(actor, options.facing))
      return actor.play(animation, { times: options.times, hold: options.hold })
    },
    idle(animation) {
      get()?.idle(animation)
    },
    walk(...steps) {
      return get()?.walk(steps) ?? Promise.resolve()
    },
    async walkTo(to, options = {}) {
      const actor = get()
      if (!actor) return false
      const steps = pathTo(actor, to, options.speed)
      if (!steps) {
        console.warn(`[map] npc("${id}") can't walk to ${to.x},${to.y}`)
        return false
      }
      await actor.walk(steps)
      return true
    },
    teleport(pos, facing) {
      get()?.teleport(pos, facing)
    },
    bark(text, options) {
      const actor = get()
      return actor && !actor.hidden ? bark(text, options) : Promise.resolve()
    },
    emote(name, options) {
      const actor = get()
      return actor && !actor.hidden ? emote(name, options) : Promise.resolve()
    },
    get hidden() {
      return find()?.hidden ?? true
    },
    hide() {
      get()?.setHidden(true)
    },
    show() {
      get()?.setHidden(false)
    },
  }
}
