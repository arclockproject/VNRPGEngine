// Easing curves: how a tween moves from 0 to 1 over time.
// Names follow the common "Penner" set used by most engines (sineIn, cubicInOut, backOut, …).

export type EaseFn = (t: number) => number

const { PI, cos, sin, sqrt, pow } = Math

const BACK = 1.70158
const bounceOut: EaseFn = (t) => {
  const n = 7.5625
  const d = 2.75
  if (t < 1 / d) return n * t * t
  if (t < 2 / d) return n * (t - 1.5 / d) ** 2 + 0.75
  if (t < 2.5 / d) return n * (t - 2.25 / d) ** 2 + 0.9375
  return n * (t - 2.625 / d) ** 2 + 0.984375
}

/** Builds in / out / inOut from an "in" curve. */
function family<N extends string>(name: N, easeIn: EaseFn) {
  const easeOut: EaseFn = (t) => 1 - easeIn(1 - t)
  const easeInOut: EaseFn = (t) => (t < 0.5 ? easeIn(t * 2) / 2 : 1 - easeIn((1 - t) * 2) / 2)
  return { [`${name}In`]: easeIn, [`${name}Out`]: easeOut, [`${name}InOut`]: easeInOut } as Record<
    `${N}In` | `${N}Out` | `${N}InOut`,
    EaseFn
  >
}

export const EASINGS = {
  linear: (t: number) => t,
  ...family('sine', (t) => 1 - cos((t * PI) / 2)),
  ...family('quad', (t) => t * t),
  ...family('cubic', (t) => t * t * t),
  ...family('quart', (t) => t ** 4),
  ...family('quint', (t) => t ** 5),
  ...family('expo', (t) => (t === 0 ? 0 : pow(2, 10 * t - 10))),
  ...family('circ', (t) => 1 - sqrt(1 - t * t)),
  /** Pulls back a little before going, or (Out) overshoots and settles back. */
  ...family('back', (t) => (BACK + 1) * t * t * t - BACK * t * t),
  /** Springy wobble. */
  ...family('elastic', (t) =>
    t === 0 || t === 1 ? t : -pow(2, 10 * t - 10) * sin((t * 10 - 10.75) * ((2 * PI) / 3)),
  ),
  /** Like a dropped ball. */
  ...family('bounce', (t) => 1 - bounceOut(1 - t)),
} satisfies Record<string, EaseFn>

export type EaseName = keyof typeof EASINGS
/** A curve name, a cubicBezier(...), or any function t (0..1) -> progress. */
export type Ease = EaseName | EaseFn

/**
 * The same curves CSS and most editors use: cubicBezier(0.2, 0.8, 0.2, 1).
 * y values outside 0..1 overshoot.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): EaseFn {
  const bez = (a: number, b: number, t: number) =>
    3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3
  const slope = (a: number, b: number, t: number) =>
    3 * a * (1 - t) ** 2 + 6 * (b - a) * t * (1 - t) + 3 * (1 - b) * t * t
  return (x) => {
    if (x <= 0 || x >= 1) return x <= 0 ? 0 : 1
    // Find t for this x (Newton steps, then bisection as a fallback), then return y(t).
    let t = x
    for (let i = 0; i < 8; i++) {
      const d = slope(x1, x2, t)
      if (Math.abs(d) < 1e-6) break
      t -= (bez(x1, x2, t) - x) / d
    }
    if (t < 0 || t > 1 || Math.abs(bez(x1, x2, t) - x) > 1e-4) {
      let lo = 0
      let hi = 1
      t = x
      for (let i = 0; i < 40; i++) {
        if (bez(x1, x2, t) < x) lo = t
        else hi = t
        t = (lo + hi) / 2
      }
    }
    return bez(y1, y2, t)
  }
}

export function resolveEase(ease: Ease | undefined): EaseFn {
  if (typeof ease === 'function') return ease
  return EASINGS[ease ?? 'quadInOut']
}
