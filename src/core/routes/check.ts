// DEV only: after a box's event really played, compare what it changed with what its flow.ts
// `sets` would have done (that is what a flowchart jump uses instead of playing it), and warn when
// they differ. Flags the route branches on with flag() are left out: jumps set those by themselves.
import { quietly } from '../scene/replay'
import { type GameState, useGameStore } from '../stores/game'

/** The parts of the game an event can leave behind (like the player parts of mid-scene saves). */
const PARTS = [
  'data',
  'quests',
  'relationships',
  'money',
  'codex',
  'names',
  'party',
  'itemsOn',
  'places',
  'recipes',
] as const satisfies readonly (keyof GameState)[]

export type StateMark = Pick<GameState, (typeof PARTS)[number]>

/** The game's parts as they are now (store values are never changed in place: no copy needed). */
export function stateMark(): StateMark {
  const state = useGameStore.getState()
  return Object.fromEntries(PARTS.map((part) => [part, state[part]])) as StateMark
}

/** Paths where two values differ ('data.flags.met_anna', 'money'), at most `limit`. */
export function differences(a: unknown, b: unknown, path = '', out: string[] = [], limit = 12) {
  if (out.length >= limit || Object.is(a, b)) return out
  const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
  if (isObj(a) && isObj(b) && Array.isArray(a) === Array.isArray(b)) {
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      differences(a[key], b[key], path ? `${path}.${key}` : key, out, limit)
    }
    return out
  }
  out.push(path || '(everything)')
  return out
}

/**
 * Runs `sets` on the game as it was before the event (quietly), reads the result, and puts the
 * real game back. Returns the paths where `sets` and the real event disagree.
 */
export function compareSets(
  before: StateMark,
  sets: (() => void) | undefined,
  branchFlags: ReadonlySet<string>,
): string[] {
  const actual = stateMark()
  let predicted = before
  if (sets) {
    useGameStore.setState(before)
    try {
      quietly(sets)
      predicted = stateMark()
    } finally {
      useGameStore.setState(actual)
    }
  }
  return differences(predicted, actual).filter((path) => {
    const flag = /^data\.flags\.(.+)$/.exec(path)?.[1]
    return !(flag && branchFlags.has(flag))
  })
}
