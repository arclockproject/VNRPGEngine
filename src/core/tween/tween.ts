// A small tween engine: animates numbers on any object over time, with easing.
// One shared requestAnimationFrame loop drives every tween; nothing here touches React.
import { type Ease, type EaseFn, resolveEase } from './easing'

export interface TweenOptions {
  /** Milliseconds. Default 400. */
  duration?: number
  /** Default 'quadInOut'. */
  ease?: Ease
  /** Wait this long (ms) before starting. */
  delay?: number
  /** Extra times to play it (1 = plays twice). Default 0. */
  repeat?: number
  /** With repeat: every second run plays backwards (there and back). */
  yoyo?: boolean
}

export interface Tween {
  /** Resolves when the tween ends (finished or stopped). */
  readonly done: Promise<void>
  /** Stops where it is now. */
  stop(): void
  /** Jumps to the end values. */
  finish(): void
}

type Numbers = Record<string, number>

interface Running {
  target: Numbers
  keys: string[]
  from: Numbers
  to: Numbers
  start: number
  duration: number
  ease: EaseFn
  repeat: number
  yoyo: boolean
  onUpdate?: () => void
  resolve: () => void
}

/** requestAnimationFrame, or a ~60 fps timer where there is none (tests, Node). */
const hasAnimationFrame = () => typeof requestAnimationFrame === 'function'
const nextFrame = (callback: (now: number) => void): number =>
  hasAnimationFrame()
    ? requestAnimationFrame(callback)
    : (setTimeout(() => callback(performance.now()), 16) as unknown as number)
const cancelFrame = (handle: number) => {
  if (hasAnimationFrame()) cancelAnimationFrame(handle)
  else clearTimeout(handle as unknown as ReturnType<typeof setTimeout>)
}

const running = new Set<Running>()
let frame = 0

function end(tween: Running, apply: 'final' | 'none') {
  if (!running.has(tween)) return
  running.delete(tween)
  // Nothing left to animate: drop the booked frame so the next tween starts a fresh loop.
  if (running.size === 0 && frame) {
    cancelFrame(frame)
    frame = 0
  }
  if (apply === 'final') {
    // There-and-back an even number of times ends where it started.
    const backAtStart = tween.yoyo && (tween.repeat + 1) % 2 === 0
    for (const key of tween.keys)
      tween.target[key] = (backAtStart ? tween.from : tween.to)[key] ?? 0
    tween.onUpdate?.()
  }
  tween.resolve()
}

function step(tween: Running, now: number) {
  const elapsed = now - tween.start
  if (elapsed < 0) return // still in its delay
  const raw = tween.duration <= 0 ? Number.POSITIVE_INFINITY : elapsed / tween.duration
  const cycle = Math.floor(raw)
  if (cycle > tween.repeat) return end(tween, 'final')
  const progress = raw - cycle
  const forward = !tween.yoyo || cycle % 2 === 0
  const eased = tween.ease(forward ? progress : 1 - progress)
  for (const key of tween.keys) {
    const from = tween.from[key] ?? 0
    const to = tween.to[key] ?? 0
    tween.target[key] = from + (to - from) * eased
  }
  tween.onUpdate?.()
}

function loop(now: number) {
  frame = 0
  for (const tween of [...running]) step(tween, now)
  if (running.size > 0) frame = nextFrame(loop)
}

/**
 * Animates the numeric fields of `target` towards `to`. `onUpdate` runs after every change
 * (write the values to the screen there). A newer tween on the same field takes it over.
 */
let instant: () => boolean = () => false

/** While `check()` is true, every new tween jumps to its end (e.g. fast-forwarding a scene). */
export function setInstantTweens(check: () => boolean) {
  instant = check
}

export function tween<T extends { [K in keyof T]: number }>(
  object: T,
  to: Partial<T>,
  givenOptions: TweenOptions = {},
  onUpdate?: (target: T) => void,
): Tween {
  const options = instant() ? { ...givenOptions, duration: 0, delay: 0, repeat: 0 } : givenOptions
  const target = object as unknown as Numbers
  const goal = to as Partial<Numbers>
  const keys = Object.keys(goal).filter((key) => typeof goal[key] === 'number')

  // Take these fields over from older tweens on the same object.
  for (const other of running) {
    if (other.target !== target) continue
    other.keys = other.keys.filter((key) => !keys.includes(key))
    if (other.keys.length === 0) end(other, 'none')
  }

  let resolve!: () => void
  const done = new Promise<void>((r) => {
    resolve = r
  })
  const entry: Running = {
    target,
    keys,
    from: Object.fromEntries(keys.map((key) => [key, target[key] ?? 0])),
    to: Object.fromEntries(keys.map((key) => [key, goal[key] as number])),
    start: performance.now() + (options.delay ?? 0),
    duration: options.duration ?? 400,
    ease: resolveEase(options.ease),
    repeat: Math.max(0, Math.floor(options.repeat ?? 0)),
    yoyo: options.yoyo ?? false,
    onUpdate: onUpdate && (() => onUpdate(object)),
    resolve,
  }
  running.add(entry)
  if (keys.length === 0 || (entry.duration <= 0 && !options.delay)) {
    end(entry, 'final')
  } else if (!frame) {
    frame = nextFrame(loop)
  }
  return { done, stop: () => end(entry, 'none'), finish: () => end(entry, 'final') }
}

/** Stops every tween on `target` where it is (e.g. when an event ends). */
export function stopTweens(target: object) {
  for (const tween of [...running]) if (tween.target === target) end(tween, 'none')
}

/** How many tweens are running (for tests and debugging). */
export function runningTweens() {
  return running.size
}

/** Jumps every tween on `target` to its end value (and finishes it). */
export function finishTweens(target: object) {
  for (const tween of [...running]) if (tween.target === target) end(tween, 'final')
}
