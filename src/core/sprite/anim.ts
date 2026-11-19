// Pure helpers for sprite animation and scripted walks (no PixiJS, easy to test).
import type { Facing, WalkStep } from '../define'
import type { SpriteAnimationData } from './types'

const OPPOSITE: Partial<Record<Facing, Facing>> = { left: 'right', right: 'left' }

/**
 * The tag to play for `state` while facing `facing`: state_facing, else the mirrored side
 * (walk_left = walk_right flipped), else the plain state. Undefined if the sprite has none.
 */
export function pickAnimation(
  names: readonly string[],
  state: string,
  facing: Facing,
): { name: string; flip: boolean } | undefined {
  const has = (name: string) => names.includes(name)
  if (has(`${state}_${facing}`)) return { name: `${state}_${facing}`, flip: false }
  const other = OPPOSITE[facing]
  if (other && has(`${state}_${other}`)) return { name: `${state}_${other}`, flip: true }
  if (has(state)) return { name: state, flip: false }
  return undefined
}

/** Every state name a sprite has ('idle_down', 'walk_up', 'wave' -> idle, walk, wave). */
export function animationStates(names: readonly string[]): string[] {
  return [...new Set(names.map((n) => n.replace(/_(up|down|left|right)$/, '')))]
}

/**
 * Which frame shows `elapsed` ms after an animation started. `done` once a non-looping
 * animation has played all its repeats (it then holds its last frame).
 */
export function frameAt(
  animation: SpriteAnimationData,
  elapsed: number,
  loop = animation.repeat === 0,
): { cell: number; done: boolean } {
  const { frames, durations } = animation
  const total = durations.reduce((sum, d) => sum + d, 0)
  const last = frames[frames.length - 1] ?? 0
  if (total <= 0) return { cell: last, done: !loop }
  const times = Math.max(1, animation.repeat)
  if (!loop && elapsed >= total * times) return { cell: last, done: true }
  let t = elapsed % total
  for (let i = 0; i < frames.length; i++) {
    const d = durations[i] ?? 0
    if (t < d) return { cell: frames[i] ?? 0, done: false }
    t -= d
  }
  return { cell: last, done: false }
}

const DIRECTIONS: Facing[] = ['up', 'down', 'left', 'right']
const DELTA: Record<Facing, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

export interface WalkLeg {
  facing: Facing
  /** Target position (tiles). */
  x: number
  y: number
  /** Tiles per second. */
  speed: number
}

/**
 * Turns walk steps into straight legs from (x, y). Each step names one direction and a number of
 * tiles ({ left: 5 }); `speed` (tiles/second) is for that step only, else `defaultSpeed`.
 * Throws on steps with no or several directions, so script typos show up right away.
 */
export function walkLegs(
  from: { x: number; y: number },
  steps: readonly WalkStep[],
  defaultSpeed: number,
): WalkLeg[] {
  let { x, y } = from
  return steps.map((step, i) => {
    const dirs = DIRECTIONS.filter((d) => step[d] !== undefined)
    const facing = dirs[0]
    if (dirs.length !== 1 || !facing)
      throw new Error(
        `walk step ${i + 1} needs exactly one direction (like { left: 5 }), got ${JSON.stringify(step)}`,
      )
    const tiles = step[facing] ?? 0
    const speed = step.speed ?? defaultSpeed
    if (!(speed > 0)) throw new Error(`walk step ${i + 1}: speed must be above 0`)
    x += DELTA[facing].x * tiles
    y += DELTA[facing].y * tiles
    return { facing, x, y, speed }
  })
}

/** The direction from one point to another (the bigger axis wins). */
export function facingToward(
  from: { x: number; y: number },
  to: { x: number; y: number },
  fallback: Facing,
): Facing {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (dx === 0 && dy === 0) return fallback
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left'
  return dy > 0 ? 'down' : 'up'
}

/**
 * The resting animation: idle for this facing (mirrored if needed), else idle facing down,
 * else the first tag. Undefined only for a sprite without animations.
 */
export function idleAnimation(
  names: readonly string[],
  facing: Facing,
): { name: string; flip: boolean } | undefined {
  return (
    pickAnimation(names, 'idle', facing) ??
    pickAnimation(names, 'idle', 'down') ??
    (names[0] ? { name: names[0], flip: false } : undefined)
  )
}
