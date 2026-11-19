// Voice numbers in a .vn script: which spoken line has which voices (per speaker), the next free
// number, and numbering the lines that have none. Shared by the checker, the completion and
// `pnpm story --number`. Runs through Node type stripping (no enums / namespaces here).
import {
  type Dialogue,
  dialogueSpeakers,
  OPTION_FLAGS,
  OPTION_VALUES,
  parseDialogue,
  VOICE_CLIP,
  VOICE_NUMBER,
} from './dialogue.ts'

export interface VnVoice {
  /** The name in the clip's file: character id, "Student A" -> student_a, narration -> narrator. */
  speaker: string
  /** Its voice number (anna(12), anna(voice 12), anna(7, jack 3)). */
  number?: number
  /** A clip of another event by name (anna(voice town/arrival/anna_0003)). */
  clip?: string
  /** Column (in the file line) and length of the number or clip, for underlines. */
  column: number
  length: number
}

export interface VnVoiceLine {
  /** 0-based line index in the file. */
  index: number
  /** Columns in the file line are this plus the dialogue's columns. */
  indent: number
  dialogue: Dialogue
  /** Who says the line, in order (several for jack & anna: …). */
  speakers: string[]
  /** Narration with no name: not numbered by `--number` (a number written by hand still plays). */
  plain: boolean
  /** The voices on the line, in the order written. */
  voices: VnVoice[]
}

/** Lines that are never dialogue (the same ones the checker skips). */
const NOT_DIALOGUE = /^(#|\$ |\* |choice:$|else:$|together:$|(if|elif)\s|meanwhile\s)/

/** Every spoken line of a .vn script with its speakers and voices. */
export function vnVoiceLines(source: string): VnVoiceLine[] {
  const out: VnVoiceLine[] = []
  source.split(/\r?\n/).forEach((raw, index) => {
    const indent = raw.length - raw.trimStart().length
    const text = raw.trim()
    if (!text || NOT_DIALOGUE.test(text)) return
    const dialogue = parseDialogue(text)
    if (!dialogue) return
    const speakers = dialogueSpeakers(dialogue)
    const named = dialogue.name ?? dialogue.options.find((o) => o.key === 'as')?.value
    const voices: VnVoice[] = []
    let bare = 0
    const add = (speaker: string | undefined, value: string, column: number) => {
      if (!speaker) return
      voices.push({
        speaker,
        ...(VOICE_NUMBER.test(value) ? { number: Number(value) } : { clip: value }),
        column: indent + column,
        length: value.length,
      })
    }
    for (const option of dialogue.options) {
      if (VOICE_NUMBER.test(option.key) && !option.value)
        add(speakers[bare++], option.key, option.keyColumn)
      else if (option.key === 'voice' && option.value !== 'none')
        add(speakers[0], option.value, option.valueColumn)
      else if (
        !(option.key in OPTION_FLAGS) &&
        !(option.key in OPTION_VALUES) &&
        (VOICE_NUMBER.test(option.value) || VOICE_CLIP.test(option.value))
      )
        add(option.key, option.value, option.valueColumn)
    }
    out.push({
      index,
      indent,
      dialogue,
      speakers,
      plain: dialogue.who === null && !dialogue.group && !named,
      voices,
    })
  })
  return out
}

/** The next free voice number of a speaker: one more than the highest used (never fills gaps). */
export function nextVoiceNumber(lines: readonly VnVoiceLine[], speaker: string): number {
  let top = 0
  for (const line of lines)
    for (const voice of line.voices)
      if (voice.speaker === speaker && voice.number) top = Math.max(top, voice.number)
  return top + 1
}

/** Voice numbers a speaker uses more than once: each later one, with the line it was first on. */
export function duplicateVoiceNumbers(
  lines: readonly VnVoiceLine[],
): { line: VnVoiceLine; voice: VnVoice; first: VnVoiceLine }[] {
  const seen = new Map<string, VnVoiceLine>()
  const out: { line: VnVoiceLine; voice: VnVoice; first: VnVoiceLine }[] = []
  for (const line of lines)
    for (const voice of line.voices) {
      if (voice.number === undefined) continue
      const key = `${voice.speaker}|${voice.number}`
      const first = seen.get(key)
      if (first) out.push({ line, voice, first })
      else seen.set(key, line)
    }
  return out
}

/**
 * Writes the next free voice number for every speaker of a line who has no voice on it (not plain
 * narration): anna: Hi! -> anna(0012): Hi!, anna(italic): Hi! -> anna(0012, italic): Hi!,
 * jack & anna: Bye! -> jack & anna(0003, 0007): Bye!. Never renumbers.
 */
export function numberVnLines(source: string, digits: number): { source: string; added: number } {
  const lines = vnVoiceLines(source)
  const next = new Map<string, number>()
  const rows = source.split('\n')
  let added = 0
  for (const line of lines) {
    if (line.plain) continue
    const missing = line.speakers.filter((who) => !line.voices.some((v) => v.speaker === who))
    if (missing.length === 0) continue
    const written = missing.map((who) => {
      const number = next.get(who) ?? nextVoiceNumber(lines, who)
      next.set(who, number + 1)
      return String(number).padStart(digits, '0')
    })
    // No voice yet: bare numbers in speaker order. Some already: name the missing ones.
    const parts = line.voices.length === 0 ? written : written.map((n, i) => `${missing[i]} ${n}`)
    const row = rows[line.index] as string
    const at = line.indent + line.dialogue.bracketColumn
    if (row[at] === '(') {
      const empty = row[at + 1] === ')'
      rows[line.index] =
        row.slice(0, at + 1) + parts.join(', ') + (empty ? '' : ', ') + row.slice(at + 1)
    } else rows[line.index] = `${row.slice(0, at)}(${parts.join(', ')})${row.slice(at)}`
    added += written.length
  }
  return { source: rows.join('\n'), added }
}
