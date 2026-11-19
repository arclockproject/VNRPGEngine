// What to suggest at the cursor in a .vn script. Pure; the editor extension shows the result.

import { voiceSpeaker } from '../../src/core/scene/lineCode.ts'
import { COMMAND_ARGS, HELPER_ARGS } from './check.ts'
import { OPTION_FLAGS, OPTION_VALUES, parseDialogue } from './dialogue.ts'
import type { VnIds } from './ids.ts'
import { nextVoiceNumber, vnVoiceLines } from './voices.ts'

export type SuggestionKind = 'command' | 'character' | 'keyword' | 'value' | 'tag' | 'snippet'

export interface Suggestion {
  label: string
  kind: SuggestionKind
  detail?: string
  /** Text to insert (default: the label). May contain snippet tabstops ($1, $0). */
  insert?: string
  snippet?: boolean
}

export interface Completion {
  /** Column where the replaced word starts. */
  start: number
  items: Suggestion[]
}

/** Commands with a short description and a snippet. */
export const COMMANDS: { name: string; detail: string; insert: string }[] = [
  {
    name: 'show',
    detail:
      'show <who> [at <place>] [pose <pose>] [distance <name>] [tint <name>] [frame <from> <to>] [flip]',
    insert: 'show $1',
  },
  { name: 'hide', detail: 'hide [who]', insert: 'hide $1' },
  {
    name: 'bg',
    detail: 'bg <background id> [variant] | <colour | file | none>, then [with <transition> [ms]]',
    insert: 'bg ${1:none}',
  },
  {
    name: 'cg',
    detail: 'cg <gallery picture | none> [variant] [with <transition> [ms]]',
    insert: 'cg $1',
  },
  {
    name: 'inset',
    detail: 'inset <inset id | none> [variant] [ms n] (a framed picture in the middle)',
    insert: 'inset $1',
  },
  { name: 'movie', detail: 'movie <video file> (plays it, then goes on)', insert: 'movie $1' },
  {
    name: 'image',
    detail:
      'image <name> <file | none> [x %] [y %] [width %] [layer back|front|top] [ms n] | image none',
    insert: 'image ${1:name} ${2:/img/picture.png}',
  },
  { name: 'weather', detail: 'weather <kind | none> [intensity]', insert: 'weather $1' },
  {
    name: '@start',
    detail:
      '@start [box <route>/<key>] ["option" | yes | no …] (dev only: the dev server opens here)',
    insert: '@start',
  },
  {
    name: 'frame',
    detail:
      'frame <who> <from> <to> [ms n] (animate which part of the portrait shows: 0 0.35 = the face)',
    insert: 'frame $1 ${2:0} ${3:0.35} ms ${4:1500}',
  },
  {
    name: 'move',
    detail: 'move <who> <move> (src/content/scenes.ts moves)',
    insert: 'move $1 $2',
  },
  {
    name: 'nvl',
    detail: 'nvl on | off | clear (full-page text)',
    insert: 'nvl ${1|on,off,clear|}',
  },
  { name: 'ending', detail: 'ending <id> (marks it reached)', insert: 'ending $1' },
  {
    name: 'title',
    detail: "title <text> (the event's title, shown on saves; once, not indented)",
    insert: 'title $1',
  },
  { name: 'chapter', detail: 'chapter <id> (a chapter begins here)', insert: 'chapter $1' },
  {
    name: 'filter',
    detail: 'filter <preset or tint | none> [on <part or who>]',
    insert: 'filter $1',
  },
  { name: 'fade', detail: 'fade <colour | none> [ms]', insert: 'fade ${1:#000000} ${2:400}' },
  { name: 'wait', detail: 'wait <seconds>', insert: 'wait ${1:0.5}' },
  { name: 'music', detail: 'music <id | none>', insert: 'music $1' },
  { name: 'ambient', detail: 'ambient <id | none>', insert: 'ambient $1' },
  { name: 'sfx', detail: 'sfx <id>', insert: 'sfx $1' },
  { name: 'event', detail: 'event <id> (runs it here)', insert: 'event $1' },
  { name: 'set', detail: 'set <flag> = <value> | += <n>', insert: 'set $1 = ${2:true}' },
  { name: 'give', detail: 'give <item> [count]', insert: 'give $1' },
  { name: 'take', detail: 'take <item> [count]', insert: 'take $1' },
  { name: 'money', detail: 'money +10 | money -5', insert: 'money +${1:10}' },
  { name: 'love', detail: 'love <who> +5', insert: 'love $1 +${2:5}' },
  { name: 'xp', detail: 'xp <amount> (whole party)', insert: 'xp ${1:10}' },
  { name: 'join', detail: 'join <who> (party)', insert: 'join $1' },
  { name: 'achievement', detail: 'achievement <id>', insert: 'achievement $1' },
  { name: 'codex', detail: 'codex <id> (journal entry)', insert: 'codex $1' },
  {
    name: 'quest',
    detail: 'quest start|step|done <id> [step]',
    insert: 'quest ${1|start,step,done|} $2',
  },
  { name: 'window', detail: 'window <id>', insert: 'window $1' },
  { name: 'shop', detail: 'shop <id>', insert: 'shop $1' },
  { name: 'battle', detail: 'battle <troop> | <enemy>, <enemy>…', insert: 'battle $1' },
  { name: 'end', detail: 'stop the event here', insert: 'end' },
]

const BLOCKS: Suggestion[] = [
  {
    label: 'choice:',
    kind: 'snippet',
    detail: 'a choice with options',
    insert: 'choice:\n  * ${1:Yes}\n    $0',
    snippet: true,
  },
  {
    label: 'if',
    kind: 'snippet',
    detail: 'if <condition>:',
    insert: "if ${1:flag('$2')}:\n  $0",
    snippet: true,
  },
  {
    label: 'elif',
    kind: 'snippet',
    detail: 'elif <condition>:',
    insert: 'elif ${1:condition}:\n  $0',
    snippet: true,
  },
  {
    label: 'together:',
    kind: 'snippet',
    detail: 'run the lines below at the same time',
    insert: 'together:\n  $0',
    snippet: true,
  },
  {
    label: 'meanwhile',
    kind: 'snippet',
    detail: "meanwhile <command>: start it, don't wait",
    insert: 'meanwhile $0',
    snippet: true,
  },
  { label: 'else:', kind: 'snippet', detail: 'else block', insert: 'else:\n  $0', snippet: true },
  { label: '>', kind: 'snippet', detail: 'narration', insert: '> $0', snippet: true },
  { label: '*', kind: 'snippet', detail: 'choice option', insert: '* $0', snippet: true },
  { label: '$', kind: 'snippet', detail: 'a line of TypeScript', insert: '$ $0', snippet: true },
]

const TAGS: Suggestion[] = [
  { label: 'b', kind: 'tag', detail: 'bold {b}…{/b}' },
  { label: 'i', kind: 'tag', detail: 'italic {i}…{/i}' },
  { label: 'color=', kind: 'tag', detail: '{color=#e53935}…{/color}' },
  { label: 'size=', kind: 'tag', detail: 'small | large | huge | 1.4' },
  { label: 'shake', kind: 'tag', detail: 'shaking letters' },
  { label: 'wave', kind: 'tag', detail: 'wavy letters' },
  { label: 'ruby', kind: 'tag', detail: 'small reading text above: {ruby=とうきょう}東京{/ruby}' },
  { label: 'w=', kind: 'tag', detail: 'pause while typing (seconds)' },
  { label: '/', kind: 'tag', detail: 'close the latest tag' },
]

const values = (list: string[], kind: SuggestionKind = 'value', detail?: string): Suggestion[] =>
  list.map((label) => ({ label, kind, detail }))

function listFor(kind: string, ids: VnIds): string[] {
  switch (kind) {
    case 'character':
      return ids.characters
    case 'item':
      return ids.items
    case 'event':
      return ids.events
    case 'window':
      return ids.windows
    case 'shop':
      return ids.shops
    case 'enemy':
      return [...ids.troops, ...ids.enemies]
    case 'achievement':
      return ids.achievements
    case 'codex':
      return ids.codex
    case 'gallery':
      return ids.gallery
    case 'audio':
      return ids.audio
    case 'flag':
      return ids.flags
    case 'filter':
      return ids.filters
    case 'weather':
      return ids.weather ?? []
    case 'ending':
      return ids.endings ?? []
    case 'chapter':
      return ids.chapters ?? []
    default:
      return []
  }
}

/** `source` = the whole file (for the next free voice number); optional. */
export function completeVn(
  lineText: string,
  column: number,
  ids: VnIds,
  source?: string,
): Completion {
  // "meanwhile <command>": suggest as if the word weren't there (commands only, no dialogue).
  const typed = lineText.slice(0, column)
  const before = typed.replace(/^(\s*)meanwhile\s+/, (m) => ' '.repeat(m.length))
  const meanwhile = before !== typed
  const partial = /[a-z0-9_/]*$/i.exec(before)?.[0] ?? ''
  const start = column - partial.length
  const trimmed = before.trimStart()
  const done = (items: Suggestion[]): Completion => ({ start, items })

  if (meanwhile && /^[a-z0-9_]*$/i.test(trimmed)) {
    return done([
      ...COMMANDS.filter((c) => !['wait', 'event', 'end'].includes(c.name)).map((c) => ({
        label: c.name,
        kind: 'command' as const,
        detail: c.detail,
        insert: c.insert,
        snippet: true,
      })),
      {
        label: '$',
        kind: 'snippet',
        detail: 'a line of TypeScript',
        insert: '$ $0',
        snippet: true,
      },
    ])
  }

  // Inside a markup tag in dialogue text: "{" not yet closed.
  const open = before.lastIndexOf('{')
  if (open > before.lastIndexOf('}') && (parseDialogue(trimmed) || /^\*\s/.test(trimmed)))
    return done(TAGS)

  // Line options: "anna(" … before the colon.
  const inOptions =
    /^(?:((?:[a-z][a-z0-9_]*(?::[a-z][a-z0-9_]*)?\s*&\s*)*[a-z][a-z0-9_]*)(?::[a-z][a-z0-9_]*)?|"[^"]+"|>)\(((?:[^()"]|"[^"]*")*)$/.exec(
      trimmed,
    )
  if (inOptions) {
    const part = (inOptions[2] ?? '').split(',').at(-1)?.trimStart() ?? ''
    const [key, ...more] = part.split(/\s+/)
    // The next free voice number of this speaker in this file, first (anna( -> 0012); for a line
    // said together, one per speaker in name order (jack & anna( -> 0004, 0012).
    const numbers: Suggestion[] = []
    const first = !(inOptions[2] ?? '').includes(',')
    if (more.length === 0 && source !== undefined && /^\d*$/.test(key ?? '') && first) {
      const name = /^"([^"]+)"/.exec(trimmed)?.[1]
      const speakers = inOptions[1]
        ? inOptions[1].split('&').map((m) => m.trim().split(':')[0] as string)
        : [voiceSpeaker(null, name)]
      const lines = vnVoiceLines(source)
      const pad = (n: number) => String(n).padStart(ids.voiceDigits ?? 4, '0')
      numbers.push({
        label: speakers.map((who) => pad(nextVoiceNumber(lines, who))).join(', '),
        kind: 'value',
        detail: `the next free voice number of ${speakers.join(' & ')}`,
      })
    }
    if (more.length === 0)
      return done([
        ...numbers,
        ...Object.keys(OPTION_FLAGS).map((label) => ({ label, kind: 'keyword' as const })),
        ...Object.entries(OPTION_VALUES).map(([label, detail]) => ({
          label,
          kind: 'keyword' as const,
          detail,
        })),
        ...values(ids.lineStyles ?? [], 'value', 'line style (src/content/scenes.ts)'),
      ])
    // A clip of another event by name; this event's own clips are just their number.
    if (key === 'voice') return done(values(ids.voiceClips ?? []))
    if (key === 'face') return done(values(ids.poses[inOptions[1] ?? ''] ?? []))
    if (key === 'size') return done(values(['small', 'normal', 'large'], 'keyword'))
    return done([])
  }

  // Helper calls in conditions: flag('…'), has('…'), love('…'), inParty('…').
  const helper = /\b(flag|has|love|inParty|seen)\(\s*['"][a-z0-9_]*$/.exec(before)
  if (helper) return done(values(listFor(HELPER_ARGS[helper[1] as string] as string, ids)))

  // First word on the line: commands, speakers, blocks.
  if (/^[a-z0-9_]*$/i.test(trimmed)) {
    return done([
      ...ids.characters.map((c) => ({
        label: `${c}:`,
        kind: 'character' as const,
        detail: 'a line spoken by this character',
        insert: `${c}: $0`,
        snippet: true,
      })),
      ...COMMANDS.map((c) => ({
        label: c.name,
        kind: 'command' as const,
        detail: c.detail,
        insert: c.insert,
        snippet: true,
      })),
      ...BLOCKS,
    ])
  }

  // "anna:" -> her poses ("anna:happy: …").
  const pose = /^([a-z][a-z0-9_]*):([a-z0-9_]*)$/.exec(trimmed)
  if (pose && ids.characters.includes(pose[1] as string)) {
    return done(
      (ids.poses[pose[1] as string] ?? []).map((p) => ({
        label: p,
        kind: 'value' as const,
        detail: 'pose',
        insert: `${p}: $0`,
        snippet: true,
      })),
    )
  }

  // Command arguments.
  const words = trimmed.split(/[\s,]+/)
  const command = words[0] ?? ''
  const index = words.length - 1 // the word being typed
  const previous = words[index - 1]
  if (command === 'show') {
    if (index === 1) return done(values(ids.characters, 'character'))
    if (previous === 'at') return done(values(ids.stages))
    if (previous === 'distance') return done(values(ids.distances ?? []))
    if (previous === 'tint') return done(values([...ids.filters, 'none']))
    if (previous === 'pose') return done(values(ids.poses[words[1] ?? ''] ?? []))
    return done(values(['at', 'pose', 'distance', 'tint', 'frame', 'flip'], 'keyword'))
  }
  if (command === 'filter' && index === 2) return done(values(['on'], 'keyword'))
  if (command === 'filter' && previous === 'on')
    return done(values(['all', 'background', 'characters', ...ids.characters]))
  // bg / cg … with <transition>
  if ((command === 'bg' || command === 'cg') && index >= 2 && words[index - 1] === 'with')
    return done(values(ids.transitions ?? []))
  if (command === 'bg' && index === 1)
    return done([
      ...values(Object.keys(ids.backgrounds ?? {})),
      { label: 'none', kind: 'keyword' as const },
    ])
  if (command === 'bg' && index === 2 && ids.backgrounds?.[words[1] ?? ''])
    return done([
      ...values(ids.backgrounds[words[1] ?? ''] ?? []),
      { label: 'with', kind: 'keyword' as const },
    ])
  if (command === 'inset' && index === 1)
    return done([
      ...values(Object.keys(ids.insets ?? {})),
      { label: 'none', kind: 'keyword' as const },
    ])
  if (command === 'inset' && index === 2 && ids.insets?.[words[1] ?? ''])
    return done([
      ...values(ids.insets[words[1] ?? ''] ?? []),
      { label: 'ms', kind: 'keyword' as const },
    ])
  if (command === 'cg' && index === 2)
    return done([
      ...values(ids.cgVariants[words[1] ?? ''] ?? []),
      { label: 'with', kind: 'keyword' as const },
    ])
  if ((command === 'bg' || command === 'cg') && index >= 2)
    return done([{ label: 'with', kind: 'keyword' }])
  if (command === 'move') {
    if (index === 1) return done(values(ids.characters, 'character'))
    if (index === 2) return done(values(ids.moves ?? []))
    return done([])
  }
  if (command === 'nvl') return done(index === 1 ? values(['on', 'off', 'clear'], 'keyword') : [])
  if (command === 'image') {
    if (index === 1) return done([{ label: 'none', kind: 'keyword' }])
    if (index === 2) return done([{ label: 'none', kind: 'keyword' }])
    if (index >= 3 && previous === 'layer') return done(values(['back', 'front', 'top'], 'keyword'))
    if (index >= 3 && index % 2 === 1)
      return done(
        values(
          ['x', 'y', 'width', 'height', 'opacity', 'scale', 'rotate', 'layer', 'ms'],
          'keyword',
        ),
      )
    return done([])
  }
  if (command === 'quest') {
    if (index === 1) return done(values(['start', 'step', 'done'], 'keyword'))
    if (index === 2) return done(values(Object.keys(ids.quests)))
    if (index === 3 && words[1] === 'step') return done(values(ids.quests[words[2] ?? ''] ?? []))
    return done([])
  }
  const kind = COMMAND_ARGS[command]
  if (kind && (index === 1 || command === 'battle')) {
    const list = values(listFor(kind, ids), kind === 'character' ? 'character' : 'value')
    const canBeNone = ['cg', 'filter', 'music', 'ambient', 'weather'].includes(command)
    return done(canBeNone ? [...list, { label: 'none', kind: 'keyword' }] : list)
  }
  if ((command === 'bg' || command === 'fade') && index === 1)
    return done([{ label: 'none', kind: 'keyword' }])
  return done([])
}
