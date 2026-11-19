// Animated sprite sheets made from Aseprite files in a `sprites/` folder (vite/aseprite/sprite.ts).
import type { Facing } from '../define'

export interface SpriteAnimationData {
  /** Indexes into `cells`, in play order. */
  readonly frames: readonly number[]
  /** Milliseconds per entry in `frames`. */
  readonly durations: readonly number[]
  /** 0 = loop forever, N = play N times. */
  readonly repeat: number
}

/** What a generated sprites/name.gen.ts exports. `T` = its tag names ('idle_down' | 'walk_left' …). */
export interface AsepriteSpriteData<T extends string = string> {
  sheet: string
  /** Language -> its own sheet (same layout), from layers named "<name>.<lang>". */
  sheets?: Readonly<Record<string, string>>
  sheetWidth: number
  sheetHeight: number
  /** Aseprite canvas size. */
  width: number
  height: number
  /** Area of the canvas every frame image covers. */
  box: { x: number; y: number; w: number; h: number }
  /** Top-left of each frame image in the sheet (box.w × box.h). */
  cells: readonly (readonly number[])[]
  animations: { readonly [K in T]: SpriteAnimationData }
  /** The feet, in canvas pixels ("origin" slice; default bottom centre of the canvas). */
  origin: { x: number; y: number }
  /** Hitbox in pixels relative to the origin ("collision…" slices). Empty = engine default. */
  collision: readonly SpriteBox[]
  /** Where the player must face to use it ("interact" slices). Empty = the collision boxes. */
  interact: readonly SpriteBox[]
  /** Walk-over areas that fire onEnter without blocking ("trigger…" slices). */
  triggers: readonly SpriteBox[]
}

export interface SpriteBox {
  x: number
  y: number
  w: number
  h: number
}

/** One rectangle around all collision boxes (pixels, relative to the origin), or undefined. */
export function collisionBounds(data: AsepriteSpriteData): SpriteBox | undefined {
  if (data.collision.length === 0) return undefined
  const x0 = Math.min(...data.collision.map((b) => b.x))
  const y0 = Math.min(...data.collision.map((b) => b.y))
  const x1 = Math.max(...data.collision.map((b) => b.x + b.w))
  const y1 = Math.max(...data.collision.map((b) => b.y + b.h))
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

/** 'idle_down' | 'walk_left' | 'wave' -> 'idle' | 'walk' | 'wave'. */
export type AnimationState<T extends string> = T extends `${infer S}_${Facing}` ? S : T

/** Animation names you can play on a sprite (directions are picked by facing). */
export type SpriteAnimationsOf<D> =
  D extends AsepriteSpriteData<infer T> ? AnimationState<T> : never

/** The sheet to draw in `lang` (a language folder, or 'source'): its own, else the main one. */
export function spriteSheet(data: AsepriteSpriteData, lang: string): string {
  return data.sheets?.[lang] ?? data.sheet
}
