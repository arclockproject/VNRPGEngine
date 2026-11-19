// Flowchart progress kept across playthroughs (persistent store): which boxes the player has
// reached, and which they picked in the chart. Both hold a time, so "the most recent" can win.
import type { Stage } from '../scene/stage'
import { usePersistentStore } from '../stores/persistent'

const id = (route: string, key: string) => `${route}/${key}`
let clock = 0
/** Times in ms, always increasing (two marks in the same millisecond still have an order). */
const now = () => {
  clock = Math.max(clock + 1, Date.now())
  return clock
}

function mark(what: 'seen' | 'picked', route: string, key: string) {
  usePersistentStore.setState((s) => {
    s.routes ??= { seen: {}, picked: {} }
    s.routes[what][id(route, key)] = now()
  })
}

/** The player reached this box (its event started), in any playthrough. */
export const markSeen = (route: string, key: string) => mark('seen', route, key)
/** The player picked this box in the flowchart. */
export const markPicked = (route: string, key: string) => mark('picked', route, key)

export { optionKey } from './graph'

/** When the box was last reached, or 0 if never. */
export const seenAt = (route: string, key: string) =>
  usePersistentStore.getState().routes?.seen[id(route, key)] ?? 0
/** When the box was last picked in the chart, or 0 if never. */
export const pickedAt = (route: string, key: string) =>
  usePersistentStore.getState().routes?.picked[id(route, key)] ?? 0

/** The stage a box's event ended on, kept on this device: a flowchart jump starts after it there. */
export function rememberStage(route: string, key: string, stage: Stage): void {
  usePersistentStore.setState((s) => {
    s.routes ??= { seen: {}, picked: {} }
    s.routes.stages ??= {}
    s.routes.stages[id(route, key)] = stage
  })
}

/** The stage that box ended on last time it played, if it ever did on this device. */
export const stageAfter = (route: string, key: string): Stage | undefined =>
  usePersistentStore.getState().routes?.stages?.[id(route, key)]
