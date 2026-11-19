// Types for src/content/config/timers.ts (game.timers: countdowns and stopwatches on screen).
// Must not import content.
import type { CSSProperties } from 'react'

/** Where a timer keeps running besides walking around on a map. */
export interface TimerRunsDuring {
  /** Conversations and cutscenes. */
  event: boolean
  /** Minigames and battles. */
  minigame: boolean
  /** While a window is open (inventory, pause menu, shop). */
  window: boolean
}

export interface TimersConfig {
  /** Default for timers that don't say (`during` in game.timers.start). */
  runsDuring: TimerRunsDuring
  /** Where the timers sit on the screen: CSS position values (top / left / right / bottom). */
  place: CSSProperties
  /** A countdown gets the `timerWarning` look for its last seconds. 0 = never. */
  warnSeconds: number
  /** Show tenths of a second under this many seconds left ("0:09.4"). 0 = never. */
  tenthsUnder: number
  /** Sound ids ('sfx/tick'). `tick` plays each second of the warning time, `end` when one runs out. */
  sounds: { tick?: string; end?: string }
}

export function defineTimers(config: TimersConfig): TimersConfig {
  return config
}

/** "1:05", "12:00", "1:02:03"; with `tenths`: "0:09.4". Never negative. */
export function formatTime(ms: number, tenths = false): string {
  const safe = Math.max(0, ms)
  // A countdown shows the second it is in (0:10 until it drops under 9 s), a stopwatch too.
  const total = Math.floor(safe / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const two = (n: number) => String(n).padStart(2, '0')
  const base = h > 0 ? `${h}:${two(m)}:${two(s)}` : `${m}:${two(s)}`
  return tenths ? `${base}.${Math.floor((safe % 1000) / 100)}` : base
}
