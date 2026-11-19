// Dev start marker: `@start` in a .vn event, devStart() in a .ts event. On the dev server the game
// skips the boot screens and the title, loads the route box that plays that event and runs it
// instantly up to the marker, where it waits for the player (src/core/dev/startRun.ts). Routes
// (visual novel mode) only. A build with a marker left in fails (vite/registry.ts).
// This file stays tiny on purpose: event files import it.
import { endRush, isRushing } from '../scene/replay'

/** The route's answers on the way: choice() option texts, true / false for flag() / check(). */
export type DevWayAnswer = string | boolean

export interface DevStartOptions {
  /** 'route/key': the box to load, when the event plays in more than one. */
  box?: string
  /**
   * The route's answers on the way to the box, in the order they are asked (from the first
   * route): devStart({ way: ['Go left', true] }). Needed where several ways lead to the box.
   */
  way?: DevWayAnswer[]
}

/**
 * The marker: the dev server opens the game here. Remove it before building. Its options are read
 * from the file itself (vite/devStart.ts), so write them as a plain literal.
 */
export function devStart(_options?: DevStartOptions): void {
  if (isRushing()) endRush()
}
