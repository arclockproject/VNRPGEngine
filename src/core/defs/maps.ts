// Maps, props, structures and the player. Part of core/define.ts (import from there).
import type { Game } from '../game'
import type {
  AudioId,
  CharacterAnimationOf,
  CharacterId,
  EmoteName,
  EnemyId,
  EventId,
  PropId,
  TroopId,
  WeatherKind,
} from '../registry'
import type { AnimationState, AsepriteSpriteData } from '../sprite/types'
import type { TiledMapData } from '../world/tiled'
import type { Typed } from './base'
import type { EncounterConfig } from './battle'

// ---------------------------------------------------------------- maps

declare const spawnType: unique symbol
export type SpawnOf<D> = D extends { readonly [spawnType]: infer S } ? S : never

export type MapTransition = 'instant' | 'fade'
export type Facing = 'up' | 'down' | 'left' | 'right'

/** A tile position (x = column, y = row, 0-based from the top left). */
export interface TilePos {
  x: number
  y: number
}

/** What the running map exposes to content (hooks, objects, custom setup). */
export interface WorldApi {
  player: {
    /** Centre of the player in tiles (x 2.5 = middle of column 2). */
    readonly x: number
    readonly y: number
    readonly facing: Facing
    /** Stand in the middle of tile `pos`. */
    teleport(pos: TilePos, facing?: Facing): void
    /** Exact position in tiles (x 2.5 = middle of column 2), e.g. from a save. */
    place(x: number, y: number, facing?: Facing): void
    /** Turn the player. */
    face(direction: Facing): void
    /**
     * Cutscenes: walk the player along steps ({ left: 3 }, { up: 2, speed: 2 }); the player can't
     * move meanwhile. No collision: you choose the path. Resolves on arrival.
     */
    walk(...steps: WalkStep[]): Promise<void>
    /** Walk to a tile around walls (shortest path). Resolves false if it can't be reached. */
    walkTo(pos: TilePos, options?: { speed?: number }): Promise<boolean>
    /** A speech bubble over the player (see NpcApi.bark). */
    bark(text: string, options?: BarkOptions): Promise<void>
    /** An emote balloon over the player (see NpcApi.emote). */
    emote(name: EmoteName, options?: { duration?: number }): Promise<void>
  }
  /** Where the map camera looks. */
  camera: CameraApi
  /**
   * Colour over the whole map (night, a dark cave, a red alarm). null = none. strength 0..1
   * (default 0.5); fades over `duration` ms. Overrides the day/night colour of outdoor maps.
   */
  lighting(tint: string | null, options?: { strength?: number; duration?: number }): void
  /** Rain, snow or nothing. intensity 0..1 (default 0.6). */
  weather(kind: WeatherKind | null, options?: { intensity?: number }): void
  /** The map's PixiJS container (scaled to tiles × tileSize), for custom drawing. */
  root: import('pixi.js').Container
  tileSize: number
  /** The terrain under the player's feet (a name from src/content/terrain.ts), or undefined. */
  terrain(): string | undefined
  /** Runs every frame while this map is shown. Returns an unsubscribe. */
  onTick(callback: (deltaSeconds: number) => void): () => void
  /**
   * A sprite object on this map (character id, or its id/Tiled name), to animate and walk it.
   * If it isn't on the map, the handle warns and does nothing.
   */
  npc<K extends CharacterId>(id: K): NpcApi<CharacterAnimationOf<K>>
  npc(id: string): NpcApi
}

export type { WeatherKind }

export interface CameraApi {
  /** Follow the player or a sprite object (npc/prop id). Pans there over `duration` ms (default 600). */
  follow(target: 'player' | (string & {}), options?: { duration?: number }): Promise<void>
  /** Look at a tile position (x/y in tiles, may be fractional) and stay there. */
  panTo(pos: { x: number; y: number }, options?: { duration?: number }): Promise<void>
  /** Back to following the player at zoom 1. */
  reset(options?: { duration?: number }): Promise<void>
  /**
   * Zoom on top of the map's own: 2 = twice as close, 1 = normal. Over `duration` ms (default 600).
   * Goes back to 1 on a map change.
   */
  zoom(level: number, options?: { duration?: number }): Promise<void>
}

/** One straight walk: a direction + number of tiles, optionally its own speed (tiles/second). */
export interface WalkStep {
  up?: number
  down?: number
  left?: number
  right?: number
  /** Tiles per second for this step only. Default: the NPC's `speed`. */
  speed?: number
}

/** Script control over a sprite on the map: `await jack.walk({ left: 5 }, { up: 2, speed: 6 })`. */
export interface NpcApi<A extends string = string> {
  readonly id: string
  /** False when no such sprite is on the current map (every call then does nothing). */
  readonly exists: boolean
  /** Top-left of its tile, in tiles (may be fractional while walking). */
  readonly x: number
  readonly y: number
  readonly facing: Facing
  /** Default walking speed in tiles per second. */
  speed: number
  /** Turn (the current animation keeps playing in the new direction). 'player' = look at them. */
  face(direction: Facing | 'player'): void
  /**
   * Play an animation (an Aseprite tag; direction picked by facing). Resolves when it ends:
   * tags with a repeat count play that many times and then go back to idle; looping tags
   * (repeat 0 / infinite in Aseprite) keep going and resolve at once, or after `times` loops.
   */
  play(
    animation: A,
    options?: {
      facing?: Facing | 'player'
      times?: number
      /** Stay on the last frame when it ends (instead of going back to idle). */
      hold?: boolean
    },
  ): Promise<void>
  /**
   * Back to the idle animation (stops a walk or a looping animation). Pass an animation to make
   * it the new idle, e.g. idle('open') for a chest that stays open.
   */
  idle(animation?: A): void
  /** Walk the steps one after another (no collision: you choose the path). Resolves on arrival. */
  walk(...steps: WalkStep[]): Promise<void>
  /** Walk to a tile around walls (shortest path). Resolves false if it can't be reached. */
  walkTo(pos: TilePos, options?: { speed?: number }): Promise<boolean>
  /** Jump to a tile at once. */
  teleport(pos: TilePos, facing?: Facing): void
  /** Removes it from view: no collision, no talking, no triggers. show() brings it back. */
  hide(): void
  show(): void
  readonly hidden: boolean
  /**
   * A speech bubble over its head (translated). Resolves when it disappears: after `duration` ms
   * (default: by text length, 1.5–6 s), when it barks again, or when the map changes.
   */
  bark(text: string, options?: BarkOptions): Promise<void>
  /**
   * A small balloon with a symbol over its head (src/content/emotes.ts): emote('surprise').
   * Resolves when it is gone.
   */
  emote(name: EmoteName, options?: { duration?: number }): Promise<void>
}

export type { EmoteName }

export interface ScheduleEntry {
  /** Time of day it starts: '8', '08:30' or 8.5. */
  from: string | number
  /** Tile to be on. Omit to stay where it is. */
  at?: TilePos
  facing?: Facing
  /** Idle animation once there (e.g. 'sleep'). */
  animation?: string
  /** Gone from the map (walks to `at` first, if given). Shows again with a later entry. */
  hidden?: boolean
  /** false = jump there instead of walking. Default true. */
  walk?: boolean
}

export interface BarkOptions {
  /** How long it stays, in ms. */
  duration?: number
}

export interface MapObjectContext {
  game: Game
  world: WorldApi
  object: MapObject
}

/** Anything placed on the map: NPCs, signs, chests, invisible exits/triggers. */
export interface MapObject {
  /** Optional name, e.g. to find it in setup(). */
  id?: string
  at: TilePos
  /**
   * Off-grid placement: how far (in tiles, e.g. 0.25) it is drawn from `at`. Tiled objects placed
   * between tiles get it automatically. Drawing, collision boxes and sorting use it; tile-based
   * things (talking to it, doors, triggers) still use `at`.
   */
  offset?: { x: number; y: number }
  /** In tiles. Default 1 × 1. */
  size?: { w: number; h: number }
  /** Drawn as a coloured block when set (no colour/texture = invisible). */
  color?: string
  texture?: string
  /** Small text shown above it. */
  label?: string
  solid?: boolean
  /**
   * Draw this character's map sprite (their `sprite` in characters/<id>). Script it with
   * world.npc(id) / game.maps.npc(id); id defaults to the character id.
   */
  character?: CharacterId
  /** Or any animated sprite (import x from '../sprites/x.gen'). Scriptable the same way. */
  sprite?: AsepriteSpriteData
  /**
   * An enemy (src/content/enemies/<id>) standing here, drawn with its map sprite (else its battle
   * sprite). Interacting starts the fight (unless you give your own onInteract); after a win it is
   * gone for good. In Tiled: class "enemy", property "enemy". id defaults to enemy_<id>_<x>_<y>.
   */
  enemy?: EnemyId
  /** The fight with `enemy`. Default: that enemy alone, can flee, gone after a win. */
  fight?: {
    /** Who fights (default [enemy]): ['wolf', 'wolf', 'bat']. */
    enemies?: EnemyId[]
    /** Or a named fight from src/content/troops (wins over `enemies`). */
    troop?: TroopId
    canFlee?: boolean
    /** Battle background (a name from content/battle.ts, an image or CSS). */
    background?: string
    /** Comes back after a win (every time the map is entered). Default false. */
    respawn?: boolean
  }
  /** Which way a sprite faces at first. Default 'down'. */
  facing?: Facing
  /** Animation a sprite plays at first (a tag name without the direction). Default 'idle'. */
  animation?: string
  /** Scripted walking speed in tiles per second. Default 3. */
  speed?: number
  /** Turn towards the player while they talk to it, then turn back. Default true for sprites. */
  turnToPlayer?: boolean
  /**
   * Sprites: where it is by time of day on this map. When an entry's time comes it walks there
   * (around walls); entering the map puts it straight in place. Before the first entry of the day,
   * the last one still applies. Waits while an event runs.
   * `[{ from: '8', at: { x: 14, y: 9 } }, { from: '21:30', at: { x: 30, y: 11 }, hidden: true }]`
   */
  schedule?: ScheduleEntry[]
  /** Glows in the dark (see LightConfig). Props can set it too. */
  light?: LightConfig
  /**
   * A sound zone: while the player stands in this object's area, this music plays instead of the
   * map's (null = silence). Leaving the area goes back. In Tiled: class "zone", property "music".
   */
  music?: AudioId | null
  /** Like `music`, for the ambient sound (Tiled property "ambient"). */
  ambient?: AudioId | null
  /** Random battles while the player walks in this object's area. */
  encounters?: EncounterConfig
  /**
   * A prop (src/content/props/<name>): its sprite, collision and behaviour. Fields set here
   * override the prop's. In Tiled: give the object the prop's name as its class.
   */
  prop?: PropId
  /** Custom values for props (Tiled custom properties, or spawn options). */
  properties?: Record<string, PropertyValue>
  /** A door/exit to another map (Tiled class "door" with map/spawn properties). */
  door?: DoorTarget
  /**
   * The player can push it one tile at a time by walking against it (sprite objects on whole
   * tiles only). Where it ends up is saved with the game. In Tiled: property `pushable`.
   */
  pushable?: boolean
  /** With `pushable`: it is back at its starting place every time the map is entered. */
  pushReset?: boolean
  /** After it was pushed: where from, where to, and the ids of objects it now stands on. */
  onPushed?: (ctx: MapObjectContext & PushInfo) => void
  // Hooks are typed as returning plain `void` on purpose: they may still be async (the engine
  // awaits them), but TypeScript then never needs their return type to type the map. That
  // matters because maps link to each other (town -> forest -> town) through game.maps.go().
  /** Confirm while facing it. May be async. */
  onInteract?: (ctx: MapObjectContext) => void
  /** Player steps onto it (exits, traps, cutscene triggers). May be async. */
  onEnter?: (ctx: MapObjectContext) => void
}

/** What onPushed gets on top of the usual context. */
export interface PushInfo {
  from: TilePos
  to: TilePos
  /** Ids of objects under its new place (a pressure plate, a hole). */
  on: string[]
}

export interface MapContext<P> {
  params: P
  game: Game
  world: WorldApi
}

/**
 * A map made in Tiled (import town from '../town.gen'). Layout, spawns (objects with class "spawn")
 * and object positions come from Tiled; behaviour is attached here by object name.
 */
export interface MapConfig<P, S extends string, O extends string = string> {
  tiled: TiledMapData<S, O>
  /** Behaviour for objects placed in Tiled, by their name there (typed). */
  objects?: { [K in O]?: ObjectBehaviour }
  /** Objects that only exist in code. */
  extraObjects?: MapObject[]
  title: string
  /**
   * Zoom for this map: 2 = twice as close, 0.5 = see twice as much. Default 1 (`map.tilesHigh`
   * tiles fit the screen height, see src/content/config/screen.ts).
   */
  zoom?: number
  /**
   * Background music, crossfaded when the map is entered ('music/town').
   * null = silence; leave it out to keep whatever is playing.
   */
  music?: AudioId | null
  /**
   * Looping background sound ('ambient/wind'). Leave it out to get the weather's sound
   * (src/content/ambient.ts); null = none.
   */
  ambient?: AudioId | null
  /** Colour outside the map. Default black. */
  background?: string
  /** Outdoors: tinted by the time of day (src/content/config/clock.ts). */
  outdoor?: boolean
  /** false = no minimap on this map (a maze, a dream). Default: src/content/config/screen.ts minimap. */
  minimap?: boolean
  /** A fixed colour over the map (indoors, caves). Wins over `outdoor`. */
  lighting?: { tint: string; strength?: number }
  /** Weather when entering the map. */
  weather?: { kind: WeatherKind; intensity?: number }
  /**
   * Called after the map is built, before it fades in. Return a function to clean up.
   * Annotate ctx to give the map params: `setup: ({ params }: MapContext<{ boss: boolean }>) => ...`
   */
  setup?: (ctx: MapContext<P>) => void | (() => void)
  /**
   * An event that starts while the map is still behind the black cover, so the map never shows
   * before the intro. A static event id, or a function returning one (or false to skip).
   */
  intro?: EventId | ((ctx: MapContext<P>) => EventId | false | null | undefined)
  /** With `intro`: skip it once the event has run in this playthrough. */
  introOnce?: boolean
  /** Called once the map is visible. May be async (see the note on MapObject hooks). */
  onEnter?: (ctx: MapContext<P>) => void
  /** Called before another map replaces this one. May be async. */
  onExit?: (ctx: MapContext<P>) => void
}

/** What an object placed in Tiled does. Position and size come from Tiled. */
export type ObjectBehaviour = Omit<MapObject, 'at' | 'size' | 'id'>

export type MapDefinition<P = void, S extends string = string> = MapConfig<P, S> &
  Typed<P> & { readonly [spawnType]: S }

// One signature on purpose: with overloads, editor autocomplete for half-typed object names fell
// back to the wrong overload and offered nothing.
export function defineMap<P = void, S extends string = never, O extends string = never>(
  config: MapConfig<P, S, O>,
): MapDefinition<P, S> {
  return config as unknown as MapDefinition<P, S>
}

export type PropertyValue = string | number | boolean

/** Where a door leads. Walk onto it, or face it and confirm when `interact` is set. */
export interface DoorTarget {
  map: string
  /** Spawn name in the target map (default: its first spawn). */
  spawn?: string
  transition?: MapTransition
  /** Needs the confirm button (a real door) instead of just walking onto it (an exit). */
  interact?: boolean
}

// ---------------------------------------------------------------- props

/** Saved per placed prop, e.g. whether a chest is open. */
export interface PropMemory {
  get(key: string): PropertyValue | undefined
  set(key: string, value: PropertyValue | null): void
}

export interface PropContext<A extends string = string> extends MapObjectContext {
  /** This prop on the map: play(animation), face, walk… */
  prop: NpcApi<A>
  /** Its custom properties (from Tiled, or game.props.spawn's `properties`). */
  properties: Record<string, PropertyValue>
  /** Values saved for this one prop (per map and prop id), e.g. memory.set('open', true). */
  memory: PropMemory
}

export declare const propTagType: unique symbol

/**
 * Something placed on maps: barrels, chests, trees, doors. Art, collision ("collision…" slices),
 * interaction area ("interact" slice) and walk-over areas ("trigger…" slices) come from its
 * Aseprite sprite. Place it in Tiled (object class = prop name) or with game.props.spawn().
 */
export interface PropConfig<Tag extends string = string> {
  sprite: AsepriteSpriteData<Tag>
  label?: string
  /** Glows in the dark (campfire, lamp post). */
  light?: LightConfig
  /** Blocks the player (with its collision slices, or its whole tile without any). Default true. */
  solid?: boolean
  /** Animation it starts with (a tag without the direction). Default 'idle'. */
  animation?: AnimationState<NoInfer<Tag>>
  facing?: Facing
  /** Turn towards the player while they use it. Default false. */
  turnToPlayer?: boolean
  // `=> void` on purpose, like map object hooks (they may be async).
  /** When it appears on a map (map built, or spawned): e.g. show a chest that's already open. */
  setup?: (ctx: PropContext<AnimationState<NoInfer<Tag>>>) => void
  /** Confirm while facing it (its "interact" slice, or its tile). */
  onInteract?: (ctx: PropContext<AnimationState<NoInfer<Tag>>>) => void
  /** The player walks into its "trigger" slices (or onto its tile). */
  onEnter?: (ctx: PropContext<AnimationState<NoInfer<Tag>>>) => void
  /** The player can push it one tile at a time (see MapObject.pushable). */
  pushable?: boolean
  /** Back at its starting place every time the map is entered. */
  pushReset?: boolean
  /** After it was pushed: `from`, `to` and `on` (ids of objects under it now). */
  onPushed?: (ctx: PropContext<AnimationState<NoInfer<Tag>>> & PushInfo) => void
}

export type PropDefinition<Tag extends string = string> = PropConfig<Tag> & {
  readonly [propTagType]: Tag
}

export function defineProp<Tag extends string = never>(
  config: PropConfig<Tag>,
): PropDefinition<Tag> {
  return config as PropDefinition<Tag>
}

// ---------------------------------------------------------------- structures

/**
 * A small Tiled map that can be stamped into any map at runtime (game.structures.place).
 * Its tiles, collision and objects are added at the chosen position; its non-empty tiles
 * replace the map's collision underneath.
 */
export interface StructureConfig<O extends string> {
  tiled: TiledMapData<string, O>
  /** Behaviour for the objects placed in the structure's Tiled map, by name (typed). */
  objects?: { [K in O]?: ObjectBehaviour }
}

export function defineStructure<S extends string = never, O extends string = never>(config: {
  tiled: TiledMapData<S, O>
  objects?: { [K in O]?: ObjectBehaviour }
}): StructureConfig<O> {
  return config as StructureConfig<O>
}

// ---------------------------------------------------------------- player

export interface PlayerConfig {
  /** Tiles per second. */
  speed: number
  /** Width/height of the player and its hitbox, in tiles (0..1). */
  size: number
  /** How far in front of the hitbox "facing something" reaches, in tiles. */
  reach: number
  /** Pushing objects marked `pushable`. */
  push: {
    /** Walking against it this long (ms) pushes it. */
    delayMs: number
    /** How fast it slides, tiles per second. */
    speed: number
    sound?: AudioId
  }
  /** Hopping over tiles whose terrain has `jump`. */
  jump: {
    /** Walking against it this long (ms) starts the jump. */
    delayMs: number
    /** How long the jump takes, ms. */
    ms: number
    /** How high the sprite goes, in tiles. */
    height: number
    sound?: AudioId
  }
  color: string
  texture?: string
  /** Animated sprite (idle/walk tags, by facing). Replaces the coloured square. */
  sprite?: AsepriteSpriteData
  /**
   * A light the player always has in the dark. For one that comes from an item (a lantern), give
   * the item a `light` instead (src/content/items/lantern).
   */
  light?: LightConfig
}

/**
 * A light that shows when the map is dark (night, caves): it lifts the darkness in a soft circle
 * and adds a little coloured glow. Invisible in daylight.
 */
export interface LightConfig {
  /** Radius in tiles. Default 3. */
  radius?: number
  /** Glow colour. Default warm '#ffd59a'. */
  color?: string
  /** 0..1, default 1. */
  intensity?: number
  /** 0..1: how much it flickers (fire ~0.3). Default 0. */
  flicker?: number
  /** Move the centre, in pixels from the middle of the object (or the sprite's middle). */
  offset?: { x?: number; y?: number }
}

export function definePlayer(config: PlayerConfig): PlayerConfig {
  return config
}
