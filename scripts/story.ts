// pnpm story          -> a report on the game's script: lines and words per event and per speaker,
//                        voice coverage (lines with a voice number whose clip is not recorded,
//                        clips no line plays, numbers used twice, what each voice language is
//                        missing), events nothing starts, .vn lines that can never run
// pnpm story --voice  -> also writes build/voice-script.csv: every line that has a voice number,
//                        with the sound file to record for it, and build/voice-script/<speaker>.csv
//                        (one per voice actor)
// pnpm story --number -> first writes the next free voice number on every spoken line without a
//                        voice (not plain narration; never renumbers): anna(0012): / { voice: 12 }
//                        (src/content/audio/voice/<language>/<event id>/<speaker>_<number>.<ogg, wav…>)
//
// Finds say(who, '…') and narrate('…') in src/content/events (.ts, .tsx and .vn). Text built at
// runtime (a variable, `${…}`) can't be found.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { scanAudio } from '../vite/registry.ts'
import { compileVn } from '../vite/vn/compile.ts'
import { numberVnLines } from '../vite/vn/voices.ts'
import { unquote } from './lang.ts'
import {
  callBody,
  numberTsLines,
  readVoice,
  readVoiceConfig,
  STR,
  speakersOf,
  voiceReport,
  WHO,
} from './voiceFiles.ts'

const ROOT = path.resolve(import.meta.dirname, '..')
const CONTENT = path.join(ROOT, 'src/content')
const EVENTS = path.join(CONTENT, 'events')

export interface ScriptLine {
  /** Character id, or null for narration. */
  speaker: string | null
  /** The source text, as written (with markup and {holes}). */
  text: string
  /** `voice: 12`, `voice: 'town/arrival/anna_0012'` (a clip by name), or `{ jack: 3, anna: 7 }`. */
  voice?: number | string | Record<string, number | string>
  /** Characters saying it together: say(['jack', 'anna'], …) (speaker = the first). */
  speakers?: string[]
  /** Narration with a name: narrate('…', { as: 'Student A' }). */
  as?: string
}

/** Every say() / narrate() with a literal text, in the order written. */
export function extractLines(code: string): ScriptLine[] {
  const source = code
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
    .join('\n')
  const pattern = new RegExp(
    String.raw`\b(?:say\(\s*(${WHO})\s*,\s*(${STR})|narrate\(\s*(${STR}))`,
    'g',
  )
  const lines: ScriptLine[] = []
  for (const m of source.matchAll(pattern)) {
    const text = unquote((m[2] ?? m[3]) as string)
    if (!text.trim()) continue
    const who = m[1] ? speakersOf(m[1]) : []
    const speaker = who[0] ?? null
    const body = callBody(source, (m.index ?? 0) + m[0].indexOf('('))
    const voice = readVoice(body)
    const as = new RegExp(String.raw`\bas\s*:\s*(${STR})`).exec(body)?.[1]
    lines.push({
      speaker,
      ...(who.length > 1 ? { speakers: who } : {}),
      text,
      ...(voice !== undefined ? { voice } : {}),
      ...(as && !speaker ? { as: unquote(as) } : {}),
    })
  }
  return lines
}

/** The text a player reads: no {tags}, no {holes}. */
export const plainText = (text: string) =>
  text
    .replace(/\{\{/g, '{')
    .replace(/\{ruby=[^}]*\}/g, '')
    .replace(/\{[^}]*\}/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/** Words; for text without spaces (Japanese, Chinese) every letter counts as one. */
export function countWords(text: string): number {
  const plain = plainText(text)
  if (!plain) return 0
  const cjk = plain.match(/[぀-ヿ㐀-䶿一-鿿]/g)?.length ?? 0
  const rest = plain.replace(/[぀-ヿ㐀-䶿一-鿿]/g, ' ')
  return cjk + (rest.match(/[\p{L}\p{N}]+(?:['\u2019-][\p{L}\p{N}]+)*/gu)?.length ?? 0)
}

/** .vn: lines right after `end` / `return` in the same block can never run. Returns line numbers. */
export function unreachableVnLines(source: string): number[] {
  const found: number[] = []
  let dead: number | null = null // indent of the block that has ended
  source.split(/\r?\n/).forEach((raw, i) => {
    if (!raw.trim() || /^\s*#/.test(raw)) return
    const indent = raw.length - raw.trimStart().length
    const text = raw.trim()
    if (dead !== null) {
      // A shallower line, or the next branch / option of the same block, is alive again.
      if (indent < dead || (indent === dead && /^(elif\s.+:|else:|\*\s)/.test(text))) dead = null
      else if (indent === dead && /^(elif\s.+:|else:)$/.test(text)) dead = null
      else {
        found.push(i + 1)
        return
      }
    }
    if (text === 'end' || text === 'return') dead = indent
  })
  return found
}

interface EventFile {
  id: string
  file: string
  /** TS code (a .vn script compiled). */
  code: string
  vn: string | null
}

function eventFiles(dir: string, prefix: string[] = []): EventFile[] {
  if (!existsSync(dir)) return []
  const entries = readdirSync(dir, { withFileTypes: true })
  const index = ['index.ts', 'index.tsx', 'index.vn'].find((name) =>
    entries.some((e) => e.isFile() && e.name === name),
  )
  if (index && prefix.length > 0) {
    const file = path.join(dir, index)
    const source = readFileSync(file, 'utf8')
    const vn = index.endsWith('.vn') ? source : null
    return [{ id: prefix.join('/'), file, code: vn ? compileVn(vn).code : source, vn }]
  }
  // Events written as one file each (day1_morning.vn), then the folders.
  const flat = entries
    .filter((e) => e.isFile() && /^[a-z][a-z0-9_]*\.vn$/.test(e.name) && e.name !== 'index.vn')
    .map((e) => {
      const file = path.join(dir, e.name)
      const vn = readFileSync(file, 'utf8')
      return { id: [...prefix, e.name.slice(0, -3)].join('/'), file, code: compileVn(vn).code, vn }
    })
  return [
    ...flat,
    ...entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('_') && !e.name.startsWith('.'))
      .flatMap((e) => eventFiles(path.join(dir, e.name), [...prefix, e.name])),
  ]
}

function allContentCode(dir: string): { file: string; code: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return allContentCode(full)
    if (!/\.(ts|tsx|vn)$/.test(entry.name) || /\.(test|gen)\.tsx?$/.test(entry.name)) return []
    const source = readFileSync(full, 'utf8')
    return [{ file: full, code: full.endsWith('.vn') ? compileVn(source).code : source }]
  })
}

const csv = (value: string) => `"${value.replace(/"/g, '""')}"`

/** `--number`: writes the next free voice number on every spoken line without a voice. */
function numberLines(digits: number) {
  let total = 0
  for (const event of eventFiles(EVENTS)) {
    const before = event.vn ?? event.code
    const done = event.vn ? numberVnLines(before, digits) : numberTsLines(before)
    const after = 'source' in done ? done.source : done.code
    if (done.added > 0) writeFileSync(event.file, after)
    if (done.added > 0)
      console.log(`  ${path.relative(ROOT, event.file)}: ${done.added} line(s) numbered`)
    if ('skipped' in done && done.skipped > 0)
      console.log(
        `    ! ${done.skipped} line(s) left without a number: their options are not written in place (add voice: by hand)`,
      )
    total += done.added
  }
  console.log(
    `[story] numbered ${total} line(s)${total ? '' : ': every spoken line has a voice'}\n`,
  )
}

function main() {
  const digits = readVoiceConfig(readFileSync(path.join(CONTENT, 'scenes.ts'), 'utf8')).digits
  if (process.argv.includes('--number')) numberLines(digits)
  const events = eventFiles(EVENTS)
  const sounds = scanAudio(ROOT, () => {})
  const audio = new Map(sounds.map((a) => [a.id, a.file]))
  const config = readVoiceConfig(readFileSync(path.join(CONTENT, 'scenes.ts'), 'utf8'))
  const [mainLanguage = 'en'] = config.languages
  const scripts = events.map((event) => ({ id: event.id, lines: extractLines(event.code) }))
  const report = voiceReport(scripts, [...audio.keys()], config)
  // The engine starts a few events itself (Extras plays movies through 'extras/movie'), so its
  // code counts too.
  const everything = [...allContentCode(CONTENT), ...allContentCode(path.join(ROOT, 'src/core'))]
  const speakers = new Map<string, { lines: number; words: number }>()
  const HEADER = ['event', 'speaker', 'number', 'text', 'before', 'file', 'status'].join(',')
  const rows: string[] = [HEADER]
  // One recording script per voice (the name in the file names), for each voice actor.
  const perSpeaker = new Map<string, string[]>()
  let totalLines = 0
  let totalWords = 0
  let totalNumbered = 0
  let totalRecorded = 0

  console.log('[story] event                                    lines   words  voiced  recorded')
  for (const event of events) {
    const mine = report.lines.filter((entry) => entry.event === event.id)
    let words = 0
    let numbered = 0
    let recorded = 0
    // The line before, so an actor knows what they answer.
    let previous = ''
    for (const { line, clips, status } of mine) {
      const by = line.speakers?.join(' & ') ?? line.speaker ?? line.as ?? ''
      const said = `${by}${by ? ': ' : ''}${plainText(line.text)}`
      const before = previous
      previous = said
      const count = countWords(line.text)
      words += count
      const who = by || '(narration)'
      const tally = speakers.get(who) ?? { lines: 0, words: 0 }
      speakers.set(who, { lines: tally.lines + 1, words: tally.words + count })
      if (clips.length === 0) continue
      numbered++
      if (status === 'recorded') recorded++
      // One row per clip: each voice of a line said together is recorded by its own actor.
      for (const { clip, speaker, status: clipStatus } of clips) {
        const id = `voice/${mainLanguage}/${clip}`
        const row = [
          csv(event.id),
          csv(speaker),
          csv(clip.slice(clip.lastIndexOf('_') + 1)),
          csv(plainText(line.text)),
          csv(before),
          csv(`src/content/audio/${audio.get(id) ?? `${id}.ogg`}`),
          csv(clipStatus),
        ].join(',')
        rows.push(row)
        perSpeaker.set(speaker, [...(perSpeaker.get(speaker) ?? [HEADER]), row])
      }
    }
    totalLines += mine.length
    totalWords += words
    totalNumbered += numbered
    totalRecorded += recorded
    console.log(
      `  ${event.id.padEnd(44)} ${String(mine.length).padStart(5)} ${String(words).padStart(7)} ${String(numbered).padStart(7)} ${String(recorded).padStart(9)}`,
    )
    for (const twice of report.duplicates.filter((d) => d.event === event.id))
      console.log(
        `    ! ${twice.clip.slice(twice.clip.lastIndexOf('/') + 1)}: this voice number is on ${twice.count} lines here, so they share one clip. Give each its own number.`,
      )
    if (event.vn) {
      for (const no of unreachableVnLines(event.vn))
        console.log(
          `    ! ${path.relative(ROOT, event.file)}:${no}: never runs (it comes after "end")`,
        )
    }
  }
  console.log(
    `  ${'TOTAL'.padEnd(44)} ${String(totalLines).padStart(5)} ${String(totalWords).padStart(7)} ${String(totalNumbered).padStart(7)} ${String(totalRecorded).padStart(9)}`,
  )
  console.log(
    '  voiced = lines with a voice number; recorded = their clip is in audio/voice/' +
      `${mainLanguage}/. A line without a number has no voice.`,
  )

  console.log('\n[story] per speaker                               lines   words')
  for (const [who, tally] of [...speakers].sort((a, b) => b[1].words - a[1].words))
    console.log(
      `  ${who.padEnd(44)} ${String(tally.lines).padStart(5)} ${String(tally.words).padStart(7)}`,
    )

  // An event is reachable when its id is written somewhere outside its own file.
  const orphans = events.filter((event) => {
    const quoted = new RegExp(`['"\`]${event.id.replace(/[/]/g, '\\/')}['"\`]`)
    return !everything.some(({ file, code }) => file !== event.file && quoted.test(code))
  })
  if (orphans.length > 0) {
    console.log(
      '\n[story] events that nothing starts (no map, event, item, window or engine code names them):',
    )
    for (const event of orphans) console.log(`  ${event.id}`)
  }

  const toRecord = report.lines.flatMap((entry) =>
    entry.clips.filter((c) => c.status === 'to record').map((c) => c.clip),
  )
  if (toRecord.length > 0) {
    console.log(`\n[story] voice clips that are not recorded yet (${mainLanguage}):`)
    for (const clip of toRecord) console.log(`  ${clip}`)
  }
  if (report.unused.length > 0) {
    console.log('\n[story] voice clips no line plays:')
    for (const id of report.unused) console.log(`  src/content/audio/${audio.get(id) ?? id}`)
  }
  if (report.stray.length > 0) {
    console.log(
      `\n[story] sounds in audio/voice that are not a voice clip (expected audio/voice/<${config.languages.join(' | ')}>/<event id>/<speaker>_<number>):`,
    )
    for (const id of report.stray) console.log(`  src/content/audio/${audio.get(id) ?? id}`)
  }
  for (const [lang, clips] of Object.entries(report.missing)) {
    if (clips.length === 0) continue
    console.log(
      `\n[story] voice language "${lang}" is missing ${clips.length} clip(s) that "${mainLanguage}" has (those lines play "${mainLanguage}"):`,
    )
    for (const clip of clips) console.log(`  ${clip}`)
  }

  if (process.argv.includes('--voice')) {
    const out = path.join(ROOT, 'build/voice-script.csv')
    mkdirSync(path.dirname(out), { recursive: true })
    // The BOM lets spreadsheet programs open it as UTF-8.
    writeFileSync(out, `\uFEFF${rows.join('\n')}\n`)
    console.log(`\n[story] wrote ${rows.length - 1} lines to ${path.relative(ROOT, out)}`)
    const folder = path.join(ROOT, 'build/voice-script')
    rmSync(folder, { recursive: true, force: true })
    mkdirSync(folder, { recursive: true })
    for (const [voice, lines] of [...perSpeaker].sort(([a], [b]) => a.localeCompare(b)))
      writeFileSync(path.join(folder, `${voice}.csv`), `\uFEFF${lines.join('\n')}\n`)
    console.log(
      `[story] and one script per voice in ${path.relative(ROOT, folder)}/ (${[...perSpeaker.keys()].sort().join(', ')})`,
    )
  }
}

if (process.argv[1] && import.meta.filename === path.resolve(process.argv[1])) main()
