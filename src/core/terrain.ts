// Types for src/content/terrain.ts: what the ground does (footsteps, slow mud, hot lava, tall
// grass with more battles, ladders). A tile gets its terrain in Tiled: the tile property
// `terrain` in the tileset, or the layer property `terrain` on a (possibly hidden) marker layer.
// Must not import content (content imports this file).

export interface TerrainKind {
  /** A sound id played for each tile walked ('sfx/step_grass'). */
  footstep?: string
  /** × the player's walking speed (0.5 = half as fast). Default 1. */
  speed?: number
  /** HP every party member loses per tile walked. Never drops anyone below 1 unless `lethal`. */
  damage?: number
  /** With `damage`: it can bring party members down to 0 HP. */
  lethal?: boolean
  /** A sound id played when it hurts. */
  damageSound?: string
  /** × the chance of random battles here (0 = never, 2 = twice as often). Default 1. */
  encounters?: number
  /** A ladder / climbing wall: the player faces up and only moves up and down. */
  ladder?: boolean
  /**
   * A tile the player hops over by walking into it (it must block walking: a hole, a ledge),
   * landing on the tile behind it. true = from any side; a direction = only when moving that way
   * (a ledge you can jump down but not up).
   */
  jump?: true | 'up' | 'down' | 'left' | 'right'
}

export interface TerrainConfig<K extends string = string> {
  footsteps: {
    /** 0..1 on top of the sound effects volume. */
    volume: number
    /** A footstep sound every this many tiles (1 = each tile). */
    everyTiles: number
    /** Random pitch change per step, 0..1 (0.1 = ±10%), so steps don't sound like a machine. */
    pitchSpread: number
    /** Used on ground without a terrain (or a terrain without its own `footstep`). */
    default?: string
  }
  kinds: Record<K, TerrainKind>
}

export function defineTerrain<const K extends string>(config: TerrainConfig<K>): TerrainConfig<K> {
  return config
}
