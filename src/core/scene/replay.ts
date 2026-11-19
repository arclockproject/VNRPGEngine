// Records what happens while a top-level event runs (lines continued, choices, minigame results,
// random numbers), so a save made mid-scene can bring the player back to the same line: restore
// the game as it was when the event started, then replay the record instantly ("fast-forward").
// Rollback uses the same trick with one line fewer.

import { setInstantTweens } from '../tween'

/**
 * l = a line was continued, c = choice, m = minigame result, r = random number, i = typed text,
 * p = what the player changed in a window while the scene waited (the changed parts of the game),
 * s = the game after something whose result cannot be replayed (a battle: HP left, items used, drops).
 */
export type ReplayStep =
  | { k: 'l' }
  | { k: 'c'; v: string | number }
  | { k: 'm'; v: unknown }
  | { k: 'r'; v: number }
  | { k: 'i'; v: string }
  | { k: 'p'; v: unknown }
  | { k: 's'; v: unknown }

export interface EventRecord {
  id: string
  params: unknown
  steps: ReplayStep[]
}

interface Recording extends EventRecord {
  /** The game when the event started (a save file), or null if it can't be saved/replayed. */
  start: unknown
}

let recording: Recording | null = null
/** A loaded save (or Back) is on its way to the line it was made at: true until that line shows. */
let catchingUp = false
/**
 * Back (or a log jump) is under way: from before the scene is torn down until it waits for the
 * player again. Meanwhile everything runs instantly (isFastForward) and the screen keeps showing
 * the scene as it was, so nothing flashes; it is redrawn once, on the line Back went to.
 */
let rewinding = false
/**
 * Dev start (src/core/dev/start.ts): `event` runs instantly (lines go by, choices take their
 * default) from when it starts until it reaches its devStart() marker.
 */
let rush: { event: string; active: boolean } | null = null

/** How to notice and put back what the player changed while a scene waited (save manager). */
export interface PlayerChanges {
  /** The game as it is now, cheap (references), to compare with later. */
  mark(): unknown
  /** What changed since `mark` (a copy that can be saved), or null when nothing did. */
  changed(mark: unknown): unknown | null
  /** Puts a `changed()` value back. */
  restore(value: unknown): void
}
let playerChanges: PlayerChanges | null = null
/** The game when the current wait began (null = not waiting, or already recorded). */
let waitMark: unknown = null
/** Increases with every recording: log lines remember which run they belong to. */
let run = 0
let replaying: { steps: ReplayStep[]; index: number; done: () => void } | null = null
/** The event is waiting for the player (a line or a choice is shown). */
let waiting = false
let captureStart: (() => unknown) | null = null
const listeners = new Set<() => void>()

const notify = () => {
  for (const listener of listeners) listener()
}

/** Called when fast-forward starts or ends (the engine shows a cover meanwhile). */
export function onReplayChange(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** The save manager registers how to snapshot the game (avoids an import cycle). */
export function setStartCapture(capture: () => unknown) {
  captureStart = capture
}

/** The save manager registers how to track the player's changes (avoids an import cycle). */
export function setPlayerChanges(hooks: PlayerChanges | null) {
  playerChanges = hooks
}

/** The 'p' step for the wait that is ending (or still going on), if the player changed anything. */
function playerStep(): ReplayStep | null {
  if (waitMark === null || !playerChanges) return null
  const value = playerChanges.changed(waitMark)
  return value === null ? null : { k: 'p', v: value }
}

export function beginRecording(id: string, params: unknown) {
  run++
  waitMark = null
  recording = { id, params, steps: [], start: captureStart?.() ?? null }
  if (rush && !rush.active && id === rush.event) {
    rush.active = true
    notify()
  }
}

/** Where the running scene is: its run number and how many steps are recorded. Null = no scene. */
export function recordingPoint(): { run: number; step: number } | null {
  return recording ? { run, step: recording.steps.length } : null
}

/** The run number of the scene being recorded (or of the last one). */
export function currentRun(): number {
  return run
}

/** A scene that ended, kept so Back and the log can go into it again (routes only). */
export interface PastScene {
  run: number
  record: EventRecord
  /** The game when it started (a save file). */
  start: unknown
}

const past: PastScene[] = []

/**
 * The event ended. `keep` > 0: remember it (its start and its steps) among the last `keep` scenes,
 * so Back from the next scene's first line lands on its last line. 0 = forget it (an abort, a load,
 * the map game).
 */
export function endRecording(keep = 0) {
  if (rush?.active) {
    console.warn(`[dev start] "${rush.event}" ended before it reached its marker`)
    endRush()
  }
  // The scene ended before it reached a line or choice to wait on (its script changed).
  if (catchingUp) endRewind()
  if (keep > 0 && recording?.start) {
    const { start, ...record } = recording
    past.push({ run, record: { ...record, steps: [...record.steps] }, start })
    while (past.length > keep) past.shift()
  }
  catchingUp = false
  recording = null
  waiting = false
  waitMark = null
  if (replaying) {
    // The event ended before the record did (its script changed): stop fast-forwarding.
    const { done } = replaying
    replaying = null
    done()
    notify()
  }
}

/** Scenes that ended before the running one (oldest first), that Back can still reach. */
export function pastScenes(): readonly PastScene[] {
  return past
}

/** Forgets remembered scenes: all of them, or those from the run `fromRun` on. */
export function forgetPast(fromRun?: number) {
  if (fromRun === undefined) past.length = 0
  else while (past.length > 0 && (past.at(-1)?.run ?? 0) >= fromRun) past.pop()
}

/** The running top-level event's record and start state, or null. */
export function currentRecording(): { record: EventRecord; start: unknown } | null {
  if (!recording) return null
  const { start, ...record } = recording
  // Saved in the middle of a wait: what the player changed so far belongs to the record.
  const pending = playerStep()
  return {
    record: { ...record, steps: pending ? [...record.steps, pending] : [...record.steps] },
    start,
  }
}

let quiet = 0

/**
 * True while replaying recorded steps: waits, tweens, walks and typing finish at once. Also inside
 * quietly() (toasts and sounds stay silent).
 */
export function isFastForward(): boolean {
  return replaying !== null || quiet > 0 || rewinding || rush?.active === true
}

/**
 * True from the start of a replay until the scene waits for the player again. Longer than
 * isFastForward(): the script between the last replayed step and the line the save was made at
 * runs after fast-forward ended. The player saw that part already (chapter cards stay away).
 */
export function isCatchingUp(): boolean {
  return catchingUp
}

/**
 * Runs `fn` (synchronous) without telling the player anything: no toasts, sounds or rumble. For
 * engine work that changes the game on the side (flowchart jumps running flow.ts `sets`).
 */
export function quietly<T>(fn: () => T): T {
  quiet++
  try {
    return fn()
  } finally {
    quiet--
  }
}

export function setWaiting(value: boolean) {
  waiting = value
  if (value && !replaying) {
    catchingUp = false
    endRewind()
  }
  // The mark stays after the wait: recordStep() compares against it, whichever is called first.
  if (value) waitMark = recording && !replaying ? (playerChanges?.mark() ?? null) : null
}

/** A line or choice is on screen and nothing is fast-forwarding: a good moment to save. */
export function isWaitingForPlayer(): boolean {
  return waiting && replaying === null && recording !== null
}

/**
 * During fast-forward: the next recorded step of this kind (consumed). Undefined when not
 * replaying, or when the script asked for something else (it changed): replay stops there.
 */
export function takeStep<K extends ReplayStep['k']>(
  kind: K,
): Extract<ReplayStep, { k: K }> | undefined {
  if (!replaying) return undefined
  // The player's changes at this point of the scene come back first. Here and not earlier: they
  // already hold what the script did up to this wait.
  let step = replaying.steps[replaying.index]
  while (step?.k === 'p') {
    playerChanges?.restore(step.v)
    recording?.steps.push(step)
    replaying.index++
    step = replaying.steps[replaying.index]
  }
  if (!step) {
    // The record ended with the player's changes: the scene waits here for real.
    finishReplay()
    return undefined
  }
  if (!step || step.k !== kind) {
    if (step) console.warn('[replay] the event changed since it was saved; continuing from here')
    finishReplay()
    return undefined
  }
  replaying.index++
  if (replaying.index >= replaying.steps.length) {
    // Leave fast-forward once this step has been applied.
    queueMicrotask(finishReplay)
  }
  return step as Extract<ReplayStep, { k: K }>
}

/**
 * For game code whose result a replay cannot work out again (a battle played by the player): call
 * gameMark() before it and settleGame(mark) right after it changed the game. While recording, the
 * changed parts are stored as an 's' step; while replaying, that step puts them back at this very
 * point, so whatever the script does next lands on top as it did the first time.
 */
export function gameMark(): unknown {
  return recording && playerChanges ? playerChanges.mark() : null
}

export function settleGame(mark: unknown): void {
  if (!recording || !playerChanges) return
  if (replaying) {
    const step = replaying.steps[replaying.index]
    if (step?.k !== 's') return // a record from before 's' steps existed: nothing to put back
    playerChanges.restore(step.v)
    recording.steps.push(step)
    replaying.index++
    return
  }
  if (mark === null) return
  const value = playerChanges.changed(mark)
  if (value !== null) recording.steps.push({ k: 's', v: value })
}

/** Remember a step (always, also while replaying, so the record is complete again). */
export function recordStep(step: ReplayStep) {
  const changed = playerStep()
  waitMark = null
  if (changed) recording?.steps.push(changed)
  recording?.steps.push(step)
}

/** Replays `steps` in the next event that starts. Resolves when fast-forward is over. */
export function startReplay(steps: ReplayStep[]): Promise<void> {
  catchingUp = true
  if (steps.length === 0) return Promise.resolve()
  return new Promise((resolve) => {
    replaying = { steps, index: 0, done: resolve }
    notify()
  })
}

function finishReplay() {
  if (!replaying) return
  const { done } = replaying
  replaying = null
  done()
  notify()
}

setInstantTweens(isFastForward)

/** Back starts (save manager): keep the screen as it is and run everything instantly. */
export function beginRewind() {
  if (rewinding) return
  rewinding = true
  notify()
}

/** Back is over: the scene waits on its line again (or there was nothing to wait on). */
export function endRewind() {
  if (!rewinding) return
  rewinding = false
  notify()
}

/** True while Back runs (see beginRewind). */
export function isRewinding(): boolean {
  return rewinding
}

/** Dev start: run `event` instantly up to its marker once it starts. */
export function armRush(event: string) {
  rush = { event, active: false }
}

/** Dev start: the marked event is running towards its marker. */
export function isRushing(): boolean {
  return rush?.active === true
}

/** Dev start: the marker was reached (or the event ended): play on normally from here. */
export function endRush() {
  if (!rush) return
  const was = rush.active
  rush = null
  if (was) notify()
}

/** Tests: forget everything. */
export function resetReplay() {
  rush = null
  catchingUp = false
  rewinding = false
  recording = null
  waitMark = null
  replaying = null
  waiting = false
}
