// Checks the ids in a .vn script (characters, poses, flags, items, …) against the project's ids,
// with exact columns so the editor can underline them. Used by the editor extension and the dev server.
import { isPlainBackground } from './compile.ts'
import {
  OPTION_FLAGS,
  OPTION_VALUES,
  optionCode,
  parseDialogue,
  VOICE_CLIP,
  VOICE_NUMBER,
} from './dialogue.ts'
import type { VnIds } from './ids.ts'
import { duplicateVoiceNumbers, vnVoiceLines } from './voices.ts'

export interface VnProblem {
  /** 1-based line. */
  line: number
  /** 0-based column and length of the bad word. */
  column: number
  length: number
  message: string
}

type Kind =
  | 'character'
  | 'item'
  | 'event'
  | 'window'
  | 'shop'
  | 'enemy'
  | 'achievement'
  | 'codex'
  | 'gallery'
  | 'audio'
  | 'flag'
  | 'quest'
  | 'stage'
  | 'distance'
  | 'filter'
  | 'transition'
  | 'move'
  | 'weather'
  | 'ending'
  | 'chapter'

const LIST: Record<Kind, (ids: VnIds) => string[]> = {
  character: (i) => i.characters,
  item: (i) => i.items,
  event: (i) => i.events,
  window: (i) => i.windows,
  shop: (i) => i.shops,
  enemy: (i) => [...i.enemies, ...i.troops],
  achievement: (i) => i.achievements,
  codex: (i) => i.codex,
  gallery: (i) => i.gallery,
  audio: (i) => i.audio,
  flag: (i) => i.flags,
  quest: (i) => Object.keys(i.quests),
  stage: (i) => i.stages,
  distance: (i) => i.distances ?? [],
  filter: (i) => i.filters,
  transition: (i) => i.transitions ?? [],
  move: (i) => i.moves ?? [],
  weather: (i) => i.weather ?? [],
  ending: (i) => i.endings ?? [],
  chapter: (i) => i.chapters ?? [],
}

/** Which id list each command's arguments come from. */
export const COMMAND_ARGS: Record<string, Kind> = {
  hide: 'character',
  rename: 'character',
  reveal: 'character',
  join: 'character',
  love: 'character',
  give: 'item',
  take: 'item',
  event: 'event',
  window: 'window',
  shop: 'shop',
  battle: 'enemy',
  achievement: 'achievement',
  codex: 'codex',
  cg: 'gallery',
  music: 'audio',
  ambient: 'audio',
  sfx: 'audio',
  set: 'flag',
  filter: 'filter',
  weather: 'weather',
  ending: 'ending',
  chapter: 'chapter',
}

/** Condition helpers and the list their argument comes from. */
export const HELPER_ARGS: Record<string, Kind> = {
  flag: 'flag',
  has: 'item',
  love: 'character',
  inParty: 'character',
  seen: 'event',
}

/** Closest id by edit distance, for "did you mean". */
function closest(word: string, list: string[]): string | undefined {
  let best: string | undefined
  let bestScore = Math.max(2, Math.floor(word.length / 3)) + 1
  for (const candidate of list) {
    const a = word
    const b = candidate
    const row = Array.from({ length: b.length + 1 }, (_, j) => j)
    for (let i = 1; i <= a.length; i++) {
      let prev = row[0] as number
      row[0] = i
      for (let j = 1; j <= b.length; j++) {
        const temp = row[j] as number
        row[j] = Math.min(
          (row[j] as number) + 1,
          (row[j - 1] as number) + 1,
          prev + (a[i - 1] === b[j - 1] ? 0 : 1),
        )
        prev = temp
      }
    }
    const score = row[b.length] as number
    if (score < bestScore) {
      bestScore = score
      best = candidate
    }
  }
  return best
}

export function checkVn(source: string, ids: VnIds): VnProblem[] {
  const problems: VnProblem[] = []
  source.split(/\r?\n/).forEach((original, index) => {
    // "meanwhile <command>": check the command as if the word weren't there (same columns).
    const raw = original.replace(/^(\s*)meanwhile\s+/, (m) => ' '.repeat(m.length))
    const line = index + 1
    const expect = (word: string, column: number, kind: Kind, list = LIST[kind](ids)) => {
      if (!word || list.includes(word)) return
      const guess = closest(word, list)
      problems.push({
        line,
        column,
        length: word.length,
        message: `unknown ${kind} "${word}"${guess ? ` (did you mean "${guess}"?)` : ''}`,
      })
    }
    const indent = raw.length - raw.trimStart().length
    const text = raw.trim()
    if (!text || text.startsWith('#')) return

    // Conditions: if/elif lines and "* option if …". Plain code lines ($) are left to TypeScript.
    if (/^(if|elif)\s|^\*\s.*\sif\s/.test(text)) {
      for (const m of raw.matchAll(/\b(flag|has|love|inParty|seen)\(\s*(['"])([^'"]*)\2/g)) {
        const kind = HELPER_ARGS[m[1] as string] as Kind
        const column = (m.index ?? 0) + m[0].length - (m[3] as string).length - 1
        expect(m[3] as string, column, kind)
      }
      return
    }
    if (
      text.startsWith('$ ') ||
      text.startsWith('* ') ||
      text === 'choice:' ||
      text === 'else:' ||
      text === 'together:'
    )
      return

    // Spoken lines: "anna: …", "anna:happy(italic): …", '"Student A": …', "> …", ">(italic) …".
    const spoken = parseDialogue(text)
    if (spoken) {
      const who = spoken.who
      if (who) expect(who, indent, 'character')
      for (const member of spoken.group ?? []) {
        expect(member.who, indent + member.column, 'character')
        if (member.pose && ids.characters.includes(member.who))
          expectPose(member.who, member.pose, indent + (member.poseColumn ?? 0))
      }
      const known = who !== null && ids.characters.includes(who)
      if (who && spoken.pose && known)
        expectPose(who, spoken.pose, indent + (spoken.poseColumn ?? 0))
      const options = optionCode(spoken)
      if ('error' in options) {
        const first = spoken.options[0]
        const last = spoken.options.at(-1)
        const from = first?.keyColumn ?? 0
        const to = last ? last.valueColumn + last.value.length : from + 1
        problems.push({
          line,
          column: indent + from,
          length: Math.max(1, to - from),
          message: options.error,
        })
        return
      }
      for (const option of spoken.options) {
        const column = indent + option.valueColumn
        // A clip by name must exist (in any voice language); a number may still be unrecorded.
        if (VOICE_NUMBER.test(option.key)) continue
        const voiceOf =
          option.key === 'voice' ||
          (!(option.key in OPTION_FLAGS) &&
            !(option.key in OPTION_VALUES) &&
            (VOICE_NUMBER.test(option.value) || VOICE_CLIP.test(option.value)))
        if (voiceOf) {
          if (!VOICE_NUMBER.test(option.value) && ids.voiceClips)
            expect(option.value, column, 'voice clip' as Kind, ids.voiceClips)
        } else if (option.key === 'face' && who && known) expectPose(who, option.value, column)
        else if (option.key === 'size')
          expect(option.value, column, 'size' as Kind, ['small', 'normal', 'large'])
        else if (!(option.key in OPTION_FLAGS) && !(option.key in OPTION_VALUES) && ids.lineStyles)
          expect(option.key, indent + option.keyColumn, 'line style' as Kind, ids.lineStyles)
      }
      return
    }

    function expectPose(who: string, pose: string, column: number) {
      const list = ids.poses[who] ?? []
      if (list.length === 0) return // placeholder portraits: any pose is fine
      if (!list.includes(pose)) {
        const guess = closest(pose, list)
        problems.push({
          line,
          column,
          length: pose.length,
          message: `${who} has no pose "${pose}" (poses: ${list.join(', ')})${guess ? `; did you mean "${guess}"?` : ''}`,
        })
      }
    }

    // Commands: find each word with its column.
    const words = [...raw.matchAll(/[^\s,]+/g)].map((m) => ({ word: m[0], column: m.index ?? 0 }))
    const command = words[0]?.word ?? ''
    const arg = words[1]
    // bg / cg … with <transition> [ms]: check the name, then the rest as usual.
    if (command === 'bg' || command === 'cg') {
      const at = words.findIndex((w, i) => i > 1 && w.word === 'with')
      if (at !== -1) {
        const name = words[at + 1]
        if (name) expect(name.word, name.column, 'transition')
        words.length = at
      }
    }
    if (command === 'show' && arg) {
      expect(arg.word, arg.column, 'character')
      for (let i = 2; i < words.length - 1; i++) {
        const key = words[i]?.word
        const value = words[i + 1] as { word: string; column: number }
        if (key === 'at') expect(value.word, value.column, 'stage')
        if (key === 'distance' && ids.distances) expect(value.word, value.column, 'distance')
        if (key === 'tint' && value.word !== 'none') expect(value.word, value.column, 'filter')
        if (key === 'pose' && ids.characters.includes(arg.word))
          expectPose(arg.word, value.word, value.column)
      }
      return
    }
    if (command === 'bg') {
      // Colours, files and "none" are not ids.
      if (!arg || !ids.backgrounds || isPlainBackground(arg.word)) return
      const list = Object.keys(ids.backgrounds)
      expect(arg.word, arg.column, 'background' as Kind, list)
      const variant = words[2]
      if (variant && list.includes(arg.word))
        expect(variant.word, variant.column, 'variant' as Kind, ids.backgrounds[arg.word] ?? [])
      return
    }
    if (command === 'inset') {
      if (!arg || arg.word === 'none' || !ids.insets) return
      const list = Object.keys(ids.insets)
      expect(arg.word, arg.column, 'inset' as Kind, list)
      const variant = words[2]
      if (variant && variant.word !== 'ms' && list.includes(arg.word))
        expect(variant.word, variant.column, 'variant' as Kind, ids.insets[arg.word] ?? [])
      return
    }
    if (command === 'cg') {
      if (arg && arg.word !== 'none') expect(arg.word, arg.column, 'gallery')
      const variant = words[2]
      if (arg && variant && ids.gallery.includes(arg.word))
        expect(variant.word, variant.column, 'gallery', ids.cgVariants[arg.word] ?? [])
      return
    }
    if (command === 'frame') {
      if (arg) expect(arg.word, arg.column, 'character')
      return
    }
    if (command === 'move') {
      if (arg) expect(arg.word, arg.column, 'character')
      const name = words[2]
      if (name) expect(name.word, name.column, 'move')
      return
    }
    if (command === 'quest') {
      const id = words[2]
      if (id) expect(id.word, id.column, 'quest')
      const step = words[3]
      if (words[1]?.word === 'step' && id && step && ids.quests[id.word])
        expect(step.word, step.column, 'quest', ids.quests[id.word])
      return
    }
    if (command === 'filter') {
      if (arg && arg.word !== 'none') expect(arg.word, arg.column, 'filter')
      const target = words[2]?.word === 'on' ? words[3] : undefined
      if (target)
        expect(target.word, target.column, 'filter target' as Kind, [
          'all',
          'background',
          'characters',
          ...ids.characters,
        ])
      return
    }
    const kind = COMMAND_ARGS[command]
    if (!kind || !arg || arg.word === 'none') return
    if (command === 'set') {
      expect(/^[a-z][a-z0-9_]*/.exec(arg.word)?.[0] ?? arg.word, arg.column, 'flag')
      return
    }
    // battle takes a list; the others one id.
    for (const w of command === 'battle' ? words.slice(1) : [arg]) expect(w.word, w.column, kind)
  })
  // Two lines of one speaker with the same voice number would play the same clip.
  for (const { line, voice, first } of duplicateVoiceNumbers(vnVoiceLines(source)))
    problems.push({
      line: line.index + 1,
      column: voice.column,
      length: voice.length,
      message: `voice number ${voice.number} of ${voice.speaker} is already on line ${first.index + 1}: give this line its own number`,
    })
  problems.sort((a, b) => a.line - b.line)
  return problems
}
