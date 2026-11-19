// A spoken line of a .vn script, taken apart: who speaks, the options in ( ), and the text.
//   anna: Hi!                         anna:happy: Hi!
//   anna(italic, speed 0.5): Hi!      anna:happy(as ???): Hi!
//   anna(12): Hi!                     anna:happy(0012, italic): Hi!   (a number = the voice number)
//   "Student A": Hi!                  "Student A"(thought): Hi!       (a speaker with no character)
//   jack & anna(3, 7): Bye!           anna(7, jack 3): Hm.   (said together / someone else's voice too)
//   > Narration.                      >(italic) Narration.
// Shared by the compiler, the checker and the completion (columns are kept for underlines).
// Runs through Node type stripping: no enums, namespaces or parameter properties here.
import { voiceSpeaker } from '../../src/core/scene/lineCode.ts'

export interface DialogueOption {
  /** The first word: 'italic', 'voice', 'as', or a named line style. */
  key: string
  /** The rest, trimmed ('' for a word alone). */
  value: string
  /** 0-based columns in the text given to parseDialogue(). */
  keyColumn: number
  valueColumn: number
}

export interface Dialogue {
  /** A character id; null for narration and for a named speaker without a character. */
  who: string | null
  whoColumn: number
  pose?: string
  poseColumn?: number
  /** "Student A": a speaker who is no character. */
  name?: string
  /** jack & anna:happy: … = said together (who is null then). Columns as for who / pose. */
  group?: { who: string; column: number; pose?: string; poseColumn?: number }[]
  options: DialogueOption[]
  /** Column of the "(" of the options, or where it would go: anna|: Hi! (tools insert options there). */
  bracketColumn: number
  text: string
  textColumn: number
}

const ID = '[a-z][a-z0-9_]*'
const MEMBER = `${ID}(?::${ID})?`
const HEAD = new RegExp(
  String.raw`^(?:(${MEMBER}(?:\s*&\s*${MEMBER})+)|(${ID})(?::(${ID}))?|"([^"]+)"|(>))(\((?:[^()"]|"[^"]*")*\))?`,
)

/** Splits "a, b c, d" at commas outside quotes, keeping each part's column. */
function splitOptions(inner: string, offset: number): DialogueOption[] {
  const options: DialogueOption[] = []
  let start = 0
  let quoted = false
  for (let i = 0; i <= inner.length; i++) {
    const c = inner[i]
    if (c === '"') quoted = !quoted
    if (i < inner.length && (c !== ',' || quoted)) continue
    const raw = inner.slice(start, i)
    const lead = raw.length - raw.trimStart().length
    const part = raw.trim()
    if (part) {
      const space = part.search(/\s/)
      const key = space === -1 ? part : part.slice(0, space)
      const rest = space === -1 ? '' : part.slice(space)
      const value = rest.trim()
      const keyColumn = offset + start + lead
      options.push({
        key,
        value,
        keyColumn,
        valueColumn: keyColumn + key.length + (rest.length - rest.trimStart().length),
      })
    }
    start = i + 1
  }
  return options
}

/** The line as dialogue, or null when it is something else (a command, code, a block). */
export function parseDialogue(text: string): Dialogue | null {
  const head = HEAD.exec(text)
  if (!head) return null
  const [all, together, who, pose, name, narration, brackets] = head
  let rest = text.slice(all.length)
  let textColumn = all.length
  if (narration) {
    // "> text" as before; ">(options) text".
    const space = /^\s+/.exec(rest)
    if (!space) return null
    textColumn += space[0].length
    rest = rest.slice(space[0].length)
  } else {
    const colon = /^\s*:\s+/.exec(rest)
    if (!colon) return null
    textColumn += colon[0].length
    rest = rest.slice(colon[0].length)
  }
  if (!rest) return null
  const optionsAt = all.length - (brackets?.length ?? 0)
  const group = together
    ? [...together.matchAll(new RegExp(`(${ID})(?::(${ID}))?`, 'g'))].map((m) => ({
        who: m[1] as string,
        column: m.index ?? 0,
        ...(m[2] ? { pose: m[2], poseColumn: (m.index ?? 0) + (m[1] as string).length + 1 } : {}),
      }))
    : undefined
  return {
    who: who ?? null,
    whoColumn: 0,
    ...(group ? { group } : {}),
    ...(pose ? { pose, poseColumn: (who as string).length + 1 } : {}),
    ...(name ? { name } : {}),
    options: brackets ? splitOptions(brackets.slice(1, -1), optionsAt + 1) : [],
    bracketColumn: optionsAt,
    text: rest,
    textColumn,
  }
}

/** Options that take no value. */
export const OPTION_FLAGS: Record<string, string> = {
  italic: 'italic',
  shake: 'shake',
  nopause: 'noAutoPause',
}

/** Options with a value, and what they are for (shown by the editor). */
export const OPTION_VALUES: Record<string, string> = {
  as: 'as <name>: show another name',
  voice:
    'voice <number> | voice <clip of another event, e.g. town/arrival/anna_0012>; another voice too: <speaker> <number>',
  face: 'face <pose>: the pose of the side image',
  size: 'size small | normal | large',
  color: 'color <css colour>',
  speed: 'speed <number>: typing speed, 2 = twice as fast',
  auto: 'auto <ms>: continue by itself',
}

/** A voice number as written on a line: 12 or 0012. */
export const VOICE_NUMBER = /^\d+$/
/** A clip by name: <event id>/<speaker>_<number>. */
export const VOICE_CLIP = /^[a-z][a-z0-9_/]*\/[a-z][a-z0-9_]*_\d+$/

const unquote = (value: string) => value.replace(/^"(.*)"$/, '$1')
const str = (value: string) => JSON.stringify(value)

/**
 * The options as `key: value` pieces of a say()/narrate() options object, or an error message.
 * A word that is no option is a named line style (src/content/scenes.ts `lineStyles`).
 */
export function optionCode(dialogue: Dialogue): { parts: string[] } | { error: string } {
  const parts: string[] = []
  const used = new Set<string>()
  // Voices: bare numbers go to the speakers in order (anna(12), jack & anna(3, 7)); `voice x` is
  // the first speaker's; `<speaker> <number | clip>` names whose it is (anna(7, jack 3)).
  const speakers = dialogueSpeakers(dialogue)
  const bare: string[] = []
  const named: [string, string][] = []
  if (dialogue.name) {
    parts.push(`as: ${str(dialogue.name)}`)
    used.add('as')
  }
  for (const { key, value } of dialogue.options) {
    if (VOICE_NUMBER.test(key)) {
      if (value) return { error: `use: ${key} (the voice number alone)` }
      bare.push(key)
      continue
    }
    if (key === 'voice' && value !== 'none') {
      if (!VOICE_NUMBER.test(value) && !VOICE_CLIP.test(value))
        return { error: `use: ${OPTION_VALUES.voice}` }
      bare.unshift(value)
      continue
    }
    if (
      !(key in OPTION_FLAGS) &&
      !(key in OPTION_VALUES) &&
      /^[a-z][a-z0-9_]*$/.test(key) &&
      (VOICE_NUMBER.test(value) || VOICE_CLIP.test(value))
    ) {
      named.push([key, value])
      continue
    }
    const name = OPTION_FLAGS[key] ?? (key in OPTION_VALUES ? key : 'style')
    if (used.has(name))
      return {
        error:
          name === 'as' && dialogue.name
            ? `"${dialogue.name}" is already the name shown: leave out "as"`
            : `"${key}": ${name === 'style' ? 'only one named line style per line' : 'given twice'}`,
      }
    used.add(name)
    if (key in OPTION_FLAGS) {
      if (value) return { error: `"${key}" takes no value` }
      parts.push(`${name}: true`)
    } else if (key in OPTION_VALUES) {
      if (!value) return { error: `use: ${OPTION_VALUES[key]}` }
      if (key === 'speed' || key === 'auto') {
        const n = Number(value)
        if (!Number.isFinite(n) || n <= 0) return { error: `use: ${OPTION_VALUES[key]}` }
        parts.push(`${key === 'auto' ? 'autoAdvance' : 'speed'}: ${n}`)
      } else if (key === 'voice') {
        // Any other voice value was taken above.
        return { error: 'a line without a voice number has no voice: leave "voice none" out' }
      } else {
        parts.push(`${key}: ${str(unquote(value))}`)
      }
    } else {
      if (value || !/^[A-Za-z_]\w*$/.test(key))
        return {
          error: `unknown line option "${key}${value ? ` ${value}` : ''}" (options: ${[...Object.keys(OPTION_FLAGS), ...Object.keys(OPTION_VALUES)].join(', ')}, or a line style from src/content/scenes.ts)`,
        }
      parts.push(`style: ${str(key)}`)
    }
  }
  if (bare.length > speakers.length)
    return {
      error: `${bare.length} voice numbers for ${speakers.length} speaker${speakers.length === 1 ? '' : 's'}: one each, in the order they are named`,
    }
  const voices: [string, string][] = [
    ...bare.map((value, i) => [speakers[i] as string, value] as [string, string]),
    ...named,
  ]
  const whose = new Set<string>()
  for (const [who] of voices) {
    if (whose.has(who)) return { error: `two voices for ${who}` }
    whose.add(who)
  }
  const code = (value: string) => (VOICE_NUMBER.test(value) ? String(Number(value)) : str(value))
  if (voices.length === 1 && speakers.length === 1 && named.length === 0)
    parts.push(`voice: ${code((voices[0] as [string, string])[1])}`)
  else if (voices.length > 0)
    parts.push(`voice: { ${voices.map(([who, value]) => `${who}: ${code(value)}`).join(', ')} }`)
  return { parts }
}

/**
 * The voices a line is said in, in order: its character, everyone of a group, or for narration the
 * name shown ("Student A" -> student_a; plain narration -> narrator).
 */
export function dialogueSpeakers(dialogue: Dialogue): string[] {
  if (dialogue.group) return dialogue.group.map((member) => member.who)
  const as = dialogue.options.find((o) => o.key === 'as')?.value.replace(/^"(.*)"$/, '$1')
  return [voiceSpeaker(dialogue.who, dialogue.name ?? as)]
}
