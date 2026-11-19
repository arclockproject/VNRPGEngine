// Voice clips: src/content/audio/voice/<language>/<event id>/<speaker>_<number>.*
// Which clip each line plays, which lines still need recording, which clips no line plays, and
// numbers used twice. Pure: scripts/story.ts reads the files and writes the reports.
import { parseVoiceClip, voiceClip, voiceSpeaker } from '../src/core/scene/lineCode.ts'

/** A string literal in TS code ('…', "…", or a template without ${}). */
export const STR = String.raw`'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|\x60(?:[^\x60\\$]|\\.)*\x60`

/** From the "(" at `open` to its matching ")", skipping strings. */
export function callBody(code: string, open: number): string {
  let depth = 0
  for (let i = open; i < code.length; i++) {
    const c = code[i] as string
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1
      while (j < code.length && code[j] !== c) j += code[j] === '\\' ? 2 : 1
      i = j
      continue
    }
    if (c === '(') depth++
    else if (c === ')') {
      depth--
      if (depth === 0) return code.slice(open, i + 1)
    }
  }
  return code.slice(open)
}

export interface VoiceLine {
  /** Character id, or null for narration. */
  speaker: string | null
  /** Narration with a name: narrate('…', { as: 'Student A' }). */
  as?: string
  /** The source text (markup and {holes} included). */
  text: string
  /**
   * `voice: 12` (this event's clip of the speaker), `voice: 'town/arrival/anna_0012'`, or several:
   * `voice: { jack: 3, anna: 7 }`.
   */
  voice?: number | string | Record<string, number | string>
  /** Characters saying the line together: say(['jack', 'anna'], …) (speaker = the first). */
  speakers?: string[]
}

/** src/content/scenes.ts `voice`: the language folders (first = default) and the number's digits. */
export interface VoiceConfig {
  languages: string[]
  digits: number
}

/** Reads `languages` and `digits` out of the text of src/content/scenes.ts (without running it). */
export function readVoiceConfig(scenesSource: string): VoiceConfig {
  const at = scenesSource.search(/\bvoice\s*:\s*\{/)
  const block = at === -1 ? scenesSource : scenesSource.slice(at)
  const list = /\blanguages\s*:\s*\[([^\]]*)\]/.exec(block)?.[1] ?? ''
  const languages = [...list.matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1] as string)
  const digits = Number(/\bdigits\s*:\s*(\d+)/.exec(block)?.[1] ?? 4)
  return { languages: languages.length ? languages : ['en'], digits }
}

/** One clip of a line: "<event id>/<speaker>_<number>" (no language), whose voice, from a number? */
export interface LineClip {
  clip: string
  speaker: string
  numbered: boolean
}

/** The clips a line plays (several for { voice: { jack: 3, anna: 7 } }); none without a voice. */
export function clipsOf(eventId: string, line: VoiceLine, digits: number): LineClip[] {
  const { voice } = line
  if (voice === undefined) return []
  const one = (speaker: string, value: number | string): LineClip =>
    typeof value === 'number'
      ? { clip: voiceClip(eventId, speaker, value, digits), speaker, numbered: true }
      : { clip: value, speaker: parseVoiceClip(value)?.speaker ?? speaker, numbered: false }
  if (typeof voice === 'object') return Object.entries(voice).map(([who, value]) => one(who, value))
  return [one(voiceSpeaker(line.speaker, line.as), voice)]
}

/** 'voice/ja/town/arrival/anna_0012' -> its language and clip; null for any other sound. */
export function splitVoiceId(id: string): { lang: string; clip: string } | null {
  const m = /^voice\/([^/]+)\/(.+)$/.exec(id)
  return m ? { lang: m[1] as string, clip: m[2] as string } : null
}

export interface VoiceReport {
  /**
   * Per event, per line (in script order): its clips, each with whether the default language has
   * it; the line's status = 'recorded' when all are.
   */
  lines: {
    event: string
    line: VoiceLine
    clips: (LineClip & { status: 'recorded' | 'to record' })[]
    status: 'recorded' | 'to record' | 'no voice'
  }[]
  /** Sound ids under voice/<language>/ that no line plays. */
  unused: string[]
  /** A voice number written on more than one line of an event (they would share one clip). */
  duplicates: { event: string; clip: string; count: number }[]
  /** Per language other than the default: clips the default has that this one is missing. */
  missing: Record<string, string[]>
  /** Sounds in src/content/audio/voice that are not in a language folder of the config. */
  stray: string[]
}

export function voiceReport(
  events: readonly { id: string; lines: readonly VoiceLine[] }[],
  audioIds: readonly string[],
  config: VoiceConfig,
): VoiceReport {
  const [main = 'en', ...others] = config.languages
  const have = new Set(audioIds)
  const lines: VoiceReport['lines'] = []
  const duplicates: VoiceReport['duplicates'] = []
  const played = new Set<string>()
  for (const event of events) {
    const numbered = new Map<string, number>()
    for (const line of event.lines) {
      const clips = clipsOf(event.id, line, config.digits).map((clip) => ({
        ...clip,
        status: have.has(`voice/${main}/${clip.clip}`)
          ? ('recorded' as const)
          : ('to record' as const),
      }))
      for (const { clip, numbered: fromNumber } of clips) {
        played.add(clip)
        if (fromNumber) numbered.set(clip, (numbered.get(clip) ?? 0) + 1)
      }
      lines.push({
        event: event.id,
        line,
        clips,
        status:
          clips.length === 0
            ? 'no voice'
            : clips.every((c) => c.status === 'recorded')
              ? 'recorded'
              : 'to record',
      })
    }
    for (const [clip, count] of numbered)
      if (count > 1) duplicates.push({ event: event.id, clip, count })
  }
  const unused: string[] = []
  const stray: string[] = []
  for (const id of [...audioIds].sort()) {
    if (!id.startsWith('voice/')) continue
    const voice = splitVoiceId(id)
    if (!voice || !config.languages.includes(voice.lang) || !parseVoiceClip(voice.clip))
      stray.push(id)
    else if (!played.has(voice.clip)) unused.push(id)
  }
  const missing: Record<string, string[]> = {}
  for (const lang of others) {
    missing[lang] = [...played]
      .filter((clip) => have.has(`voice/${main}/${clip}`) && !have.has(`voice/${lang}/${clip}`))
      .sort()
  }
  return { lines, unused, duplicates, missing, stray }
}

/** Comment lines blanked out (same length), so offsets in the result match the code. */
function maskComments(code: string): string {
  return code
    .split('\n')
    .map((line) => (/^\s*(\/\/|\/\*|\*)/.test(line) ? ' '.repeat(line.length) : line))
    .join('\n')
}

/** The arguments of a call body "(a, b, { c })": [start, end) offsets inside it, at depth 0. */
function topArgs(body: string): { start: number; end: number }[] {
  const args: { start: number; end: number }[] = []
  let depth = 0
  let start = 1
  for (let i = 0; i < body.length; i++) {
    const c = body[i] as string
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1
      while (j < body.length && body[j] !== c) j += body[j] === '\\' ? 2 : 1
      i = j
    } else if ('([{'.includes(c)) depth++
    else if (')]}'.includes(c)) {
      depth--
      if (depth === 0) {
        if (body.slice(start, i).trim()) args.push({ start, end: i })
        return args
      }
    } else if (c === ',' && depth === 1) {
      args.push({ start, end: i })
      start = i + 1
    }
  }
  return args
}

/** Who says a line in TS: 'anna' / 'anna:happy', or a list ['jack', 'anna:happy']. */
export const WHO = String.raw`${STR}|\[\s*(?:${STR})(?:\s*,\s*(?:${STR}))*\s*,?\s*\]`

/** The character ids in a WHO match (poses left out). */
export function speakersOf(who: string): string[] {
  return [...who.matchAll(new RegExp(STR, 'g'))].map(
    (m) => m[0].slice(1, -1).split(':')[0] as string,
  )
}

/** A call's `voice:` option: a number, a clip, or { speaker: number | clip }; undefined = none. */
export function readVoice(body: string): VoiceLine['voice'] {
  const m = new RegExp(String.raw`\bvoice\s*:\s*(\d+|${STR}|\{[^}]*\})`).exec(body)?.[1]
  if (m === undefined) return undefined
  if (/^\d+$/.test(m)) return Number(m)
  if (!m.startsWith('{')) return m.slice(1, -1)
  const map: Record<string, number | string> = {}
  for (const e of m.matchAll(new RegExp(String.raw`(\w+|${STR})\s*:\s*(\d+|${STR})`, 'g'))) {
    const key = /^['"`]/.test(e[1] as string) ? (e[1] as string).slice(1, -1) : (e[1] as string)
    map[key] = /^\d+$/.test(e[2] as string) ? Number(e[2]) : (e[2] as string).slice(1, -1)
  }
  return map
}

/**
 * Writes the next free voice number on every say() / narrate(…, { as }) with literal text and no
 * `voice` in a TypeScript event: say('anna', 'Hi!') -> say('anna', 'Hi!', { voice: 12 }); a line
 * said together gets one per speaker: { voice: { jack: 3, anna: 7 } }. Plain narration is left
 * alone. Never renumbers. `skipped` = lines whose options are not written in place (a variable).
 */
export function numberTsLines(code: string): { code: string; added: number; skipped: number } {
  const masked = maskComments(code)
  const pattern = new RegExp(
    String.raw`\b(?:say\(\s*(${WHO})\s*,\s*(${STR})|narrate\(\s*(${STR}))`,
    'g',
  )
  const calls: { open: number; body: string; say: boolean; speakers: string[] }[] = []
  const top = new Map<string, number>()
  const seen = (speaker: string, value: number | string) => {
    if (typeof value === 'number') top.set(speaker, Math.max(top.get(speaker) ?? 0, value))
  }
  for (const m of masked.matchAll(pattern)) {
    const open = (m.index ?? 0) + m[0].indexOf('(')
    const body = callBody(masked, open)
    const voice = readVoice(body)
    const as = new RegExp(String.raw`\bas\s*:\s*(${STR})`).exec(body)?.[1]?.slice(1, -1)
    const say = m[1] !== undefined
    if (!say && !as) continue
    const speakers = say ? speakersOf(m[1] as string) : [voiceSpeaker(null, as)]
    if (typeof voice === 'object')
      for (const [who, value] of Object.entries(voice)) seen(who, value)
    else if (voice !== undefined) seen(speakers[0] as string, voice)
    if (voice !== undefined) continue
    calls.push({ open, body, say, speakers })
  }
  const edits: { at: number; text: string }[] = []
  let skipped = 0
  for (const call of calls) {
    const args = topArgs(call.body)
    const needed = call.say ? 2 : 1
    const numbers = call.speakers.map((who) => (top.get(who) ?? 0) + 1)
    const value =
      call.speakers.length === 1
        ? String(numbers[0])
        : `{ ${call.speakers.map((who, i) => `${who}: ${numbers[i]}`).join(', ')} }`
    if (args.length === needed) {
      edits.push({
        at: call.open + (args[needed - 1] as { end: number }).end,
        text: `, { voice: ${value} }`,
      })
    } else if (args.length === needed + 1) {
      const arg = args[needed] as { start: number; end: number }
      const text = call.body.slice(arg.start, arg.end)
      const brace = text.indexOf('{')
      if (brace === -1 || text.slice(0, brace).trim()) {
        skipped++
        continue
      }
      const after = text.slice(brace + 1)
      const space = /^\s*/.exec(after)?.[0] ?? ''
      const at = call.open + arg.start + brace + 1
      edits.push(
        after.trimStart().startsWith('}')
          ? { at, text: ` voice: ${value} ` }
          : { at: at + space.length, text: `voice: ${value},${space || ' '}` },
      )
    } else {
      skipped++
      continue
    }
    call.speakers.forEach((who, i) => {
      top.set(who, numbers[i] as number)
    })
  }
  let out = code
  for (const edit of edits.sort((a, b) => b.at - a.at))
    out = out.slice(0, edit.at) + edit.text + out.slice(edit.at)
  return { code: out, added: edits.length, skipped }
}
