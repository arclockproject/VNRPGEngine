// Who is "talking" right now, for mouth flaps: their line is typing out ('typing': the mouth flips
// open and shut), or their voice clip is playing ('voice': each mouth follows how loud its own
// clip is). Several at once on a line said together, or with a second voice.
export type TalkMode = 'typing' | 'voice'
type Listener = (talkers: readonly string[], mode: TalkMode) => void

let talkers: readonly string[] = []
let mode: TalkMode = 'typing'
const listeners = new Set<Listener>()
/** How loud the voice clip is right now, 0..1, or null when that can't be measured. */
let levelSource: (who?: string) => number | null = () => null

/** Who talks now: one id, several, or null / [] for no one. */
export function setTalking(next: string | readonly string[] | null, how: TalkMode = 'typing') {
  const list = next === null ? [] : typeof next === 'string' ? [next] : [...new Set(next)]
  const same = list.length === talkers.length && list.every((who, i) => talkers[i] === who)
  if (same && (list.length === 0 || how === mode)) return
  talkers = list
  mode = how
  for (const listener of listeners) listener(talkers, mode)
}

export function onTalking(listener: Listener): () => void {
  listeners.add(listener)
  listener(talkers, mode)
  return () => listeners.delete(listener)
}

/** The audio manager says how loud the playing voice clip is (set once, at start). */
export function setVoiceLevelSource(source: (who?: string) => number | null) {
  levelSource = source
}

/** With `who`: only that speaker's clip (several voices on one line). */
export const voiceLevel = (who?: string): number | null => levelSource(who)
