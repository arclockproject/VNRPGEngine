// Compiles a .vn dialogue script (src/content/events/**/index.vn) into a TypeScript event module.
// The output is ordinary TS, so character, flag and item ids are type checked like hand-written events.
// Runs through Node type stripping: no enums, namespaces or parameter properties here.

import { parseVnStart } from '../devStart.ts'
import { optionCode, parseDialogue } from './dialogue.ts'

export interface VnError {
  line: number
  message: string
}

interface Line {
  no: number
  indent: number
  text: string
}

type Node =
  | {
      kind: 'code'
      no: number
      code: string
      /** 'state' = only changes the game (set, love, give…); 'raw' = a `$` line. */
      what?: 'state' | 'raw'
    }
  | {
      kind: 'choice'
      no: number
      options: { no: number; label: string; when?: string; body: Node[] }[]
    }
  | { kind: 'if'; no: number; branches: { no: number; cond: string | null; body: Node[] }[] }
  | { kind: 'together'; no: number; body: Node[] }

const ID = '[a-z][a-z0-9_]*'
const PATH_ID = '[a-z][a-z0-9_/]*'
const str = (text: string) => JSON.stringify(text)

/** The CSS colour words `bg` takes as colours (a background with one of these names needs another). */
const COLOUR_WORDS = new Set(
  'none transparent black white gray grey silver red maroon yellow olive lime green aqua teal blue navy fuchsia purple orange pink brown'.split(
    ' ',
  ),
)

/** `bg` values that are not a background id: "none", a colour, a gradient, a file or a URL. */
export function isPlainBackground(value: string): boolean {
  return (
    COLOUR_WORDS.has(value) ||
    /^[#/.]/.test(value) ||
    /[(:]/.test(value) ||
    /\.[A-Za-z0-9]{2,5}([?#].*)?$/.test(value)
  )
}

/** Helpers every script can use in conditions: flag('met_anna'), has('apple'), love('anna') … */
const HELPERS = [
  'const flag = (id: Parameters<typeof game.flags.get>[0]) => game.flags.get(id)',
  'const has = (id: Parameters<typeof game.items.has>[0], count = 1) => game.items.has(id, count)',
  'const love = (id: Parameters<typeof game.relationships.get>[0]) => game.relationships.get(id)',
  'const money = () => game.money.get()',
  'const inParty = (id: Parameters<typeof game.party.has>[0]) => game.party.has(id)',
  // seen('heaven/before_god/meeting'): the event has started in this playthrough.
  'const seen = (id: Parameters<typeof game.events.seen>[0]) => game.events.seen(id)',
  // variant('adult'): this build is that content variant (src/content/config/variants.ts).
  'const variant = (value: Parameters<typeof game.variants.is>[0]) => game.variants.is(value)',
]

/** `flag met_anna` style shortcuts and words (and/or/not) -> TS, inside conditions. */
function condition(expr: string): string {
  return expr
    .replace(/\bnot\s+/g, '!')
    .replace(/\band\b/g, '&&')
    .replace(/\bor\b/g, '||')
}

function splitLines(source: string): Line[] {
  const lines: Line[] = []
  source.split(/\r?\n/).forEach((raw, i) => {
    const withoutComment = raw.replace(/^\s*#.*$/, '')
    if (!withoutComment.trim()) return
    const indent = withoutComment.length - withoutComment.trimStart().length
    lines.push({ no: i + 1, indent, text: withoutComment.trim() })
  })
  return lines
}

/**
 * Dialogue text -> the say()/narrate() arguments. [expr] puts a value in (like Ren'Py):
 * "You have [count] apples" -> "You have {count} apples", { count: count }. [[ is a literal [.
 * The hole is named after the variable or function (translators see {count}, not code).
 */
function lineArgs(text: string, options: string[] = []): string {
  const values: string[] = [...options]
  const names = new Map<string, string>()
  const out = text.replace(/\[\[|\[([^\]]+)\]/g, (_match, expr: string | undefined) => {
    if (!expr) return '['
    const code = expr.trim()
    let name = names.get(code)
    if (!name) {
      const base = /^(?:[\w$.]+\.)?([A-Za-z_]\w*)(?:\(\))?$/.exec(code)?.[1] ?? 'value'
      name = base
      for (let n = 2; [...names.values()].includes(name); n++) name = `${base}${n}`
      names.set(code, name)
      values.push(name === code ? name : `${name}: ${code}`)
    }
    return `{${name}}`
  })
  return values.length ? `${str(out)}, { ${values.join(', ')} }` : str(out)
}

/** One simple command line -> one TS statement. Returns null if it isn't a known command. */
function command(text: string, no: number, errors: VnError[]): string | null {
  const fail = (message: string) => {
    errors.push({ line: no, message })
    return ''
  }
  if (text.startsWith('$ ')) return text.slice(2)
  const spoken = parseDialogue(text)
  if (spoken) {
    const options = optionCode(spoken)
    if ('error' in options) return fail(options.error)
    const args = lineArgs(spoken.text, options.parts)
    // jack & anna:happy: … = said together.
    if (spoken.group)
      return `await say([${spoken.group.map((m) => str(m.pose ? `${m.who}:${m.pose}` : m.who)).join(', ')}], ${args})`
    if (spoken.who === null) return `await narrate(${args})`
    const who = spoken.pose ? `${spoken.who}:${spoken.pose}` : spoken.who
    return `await say(${str(who)}, ${args})`
  }
  const meanwhile = /^meanwhile\s+(.+)$/.exec(text)
  if (meanwhile) {
    const rest = meanwhile[1] as string
    if (parseDialogue(rest))
      return fail(
        'dialogue always waits for the player; use "together:" to run it alongside effects',
      )
    if (/^(wait|event|end|return)\b/.test(rest)) return fail(`"meanwhile ${rest}" makes no sense`)
    const code = command(rest, no, errors)
    if (code === null) return null
    // Not awaited = it starts and the script goes on to the next line at once.
    return code.startsWith('await ') ? `void ${code.slice(6)}` : code
  }

  const [word, ...rest] = text.split(/\s+/)
  const args = rest.join(' ')
  const none = (value: string) => (value === 'none' ? 'null' : str(value))
  /** "… with wipeLeft 800" at the end of bg / cg: [the rest, the options object or ''] */
  const withTransition = (value: string): [string, string] => {
    const m = /^(.*?)\s+with\s+([A-Za-z][\w]*)(?:\s+(\d+))?$/.exec(value)
    if (!m) return [value, '']
    const options = [`transition: ${str(m[2] as string)}`]
    if (m[3]) options.push(`duration: ${Number(m[3])}`)
    return [m[1] as string, `{ ${options.join(', ')} }`]
  }
  switch (word) {
    case 'show': {
      const m = new RegExp(
        String.raw`^(${ID})((?:\s+(?:at|pose|distance|tint)\s+\S+|\s+frame\s+[\d.]+\s+[\d.]+|\s+flip)*)$`,
      ).exec(args)
      if (!m)
        return fail(
          'use: show <who> [at <place>] [pose <pose>] [distance <name>] [tint <name>] [frame <from> <to>] [flip]',
        )
      const opts: string[] = []
      const at = /\bat\s+(\S+)/.exec(m[2] ?? '')
      const pose = /\bpose\s+(\S+)/.exec(m[2] ?? '')
      if (at) opts.push(`at: ${str(at[1] as string)}`)
      if (pose) opts.push(`pose: ${str(pose[1] as string)}`)
      const distance = /\bdistance\s+(\S+)/.exec(m[2] ?? '')
      if (distance) opts.push(`distance: ${str(distance[1] as string)}`)
      const tint = /\btint\s+(\S+)/.exec(m[2] ?? '')
      if (tint) opts.push(`tint: ${none(tint[1] as string)}`)
      const frame = /\bframe\s+([\d.]+)\s+([\d.]+)/.exec(m[2] ?? '')
      if (frame) opts.push(`frame: [${Number(frame[1])}, ${Number(frame[2])}]`)
      if (/\bflip\b/.test(m[2] ?? '')) opts.push('flip: true')
      return `show(${str(m[1] as string)}${opts.length ? `, { ${opts.join(', ')} }` : ''})`
    }
    case 'hide':
      return args ? `hide(${str(args)})` : 'hide()'
    case 'bg': {
      const [value, options] = withTransition(args)
      if (!value)
        return fail(
          'use: bg <background id> [variant] | bg <colour or file> | bg none, then [with <transition> [ms]]',
        )
      // A colour, a file or "none" goes to background(); anything else is an id from
      // src/content/backgrounds (typed), with an optional variant.
      if (isPlainBackground(value))
        return `background(${none(value)}${options ? `, ${options}` : ''})`
      const [id, variant, extra] = value.split(/\s+/)
      if (!id || extra || !new RegExp(`^${PATH_ID}$`).test(id))
        return fail('use: bg <background id> [variant] [with <transition> [ms]]')
      if (options) return `bg(${str(id)}, ${variant ? str(variant) : 'null'}, ${options})`
      return `bg(${str(id)}${variant ? `, ${str(variant)}` : ''})`
    }
    case 'cg': {
      const [value, options] = withTransition(args)
      const [id, variant, extra] = value.split(/\s+/)
      if (!id || extra)
        return fail('use: cg <gallery id> [variant] [with <transition> [ms]] | cg none')
      if (options) return `cg(${str(id)}, ${variant ? str(variant) : 'undefined'}, ${options})`
      return variant ? `cg(${str(id)}, ${str(variant)})` : `cg(${none(id)})`
    }
    case 'inset': {
      // inset <inset id> [variant] [ms n] | inset none [ms n]
      const words = args.split(/\s+/).filter(Boolean)
      const ms = words.indexOf('ms')
      const duration = ms === -1 ? undefined : Number(words[ms + 1])
      if (ms !== -1 && (!Number.isFinite(duration) || words.length !== ms + 2))
        return fail('use: inset <inset id> [variant] [ms n] | inset none [ms n]')
      const [id, variant, extra] = ms === -1 ? words : words.slice(0, ms)
      if (!id || extra || (id !== 'none' && !new RegExp(`^${PATH_ID}$`).test(id)))
        return fail('use: inset <inset id> [variant] [ms n] | inset none [ms n]')
      const options = duration === undefined ? '' : `, { duration: ${duration} }`
      if (id === 'none') return `inset(null${options ? `, undefined${options}` : ''})`
      return `inset(${str(id)}${variant || options ? `, ${variant ? str(variant) : 'undefined'}` : ''}${options})`
    }
    case 'movie':
      return args ? `await movie(${str(args)})` : fail('use: movie <video file>')
    case 'image': {
      // image none | image <name> none | image <name> <file> [x 50] [y 40] [width 30] …
      const usage =
        'use: image <name> <file> [x %] [y %] [width %] [height %] [opacity 0-1] [scale n] [rotate deg] [layer back|front|top] [ms n] | image <name> none | image none'
      if (args === 'none') return 'await clearImages()'
      const [name, src, ...pairs] = rest
      if (!name || !src) return fail(usage)
      if (src === 'none') return `await image(${str(name)}, null)`
      if (pairs.length % 2 !== 0) return fail(usage)
      const options: string[] = []
      for (let i = 0; i < pairs.length; i += 2) {
        const key = pairs[i] as string
        const value = pairs[i + 1] as string
        if (key === 'layer') {
          if (!['back', 'front', 'top'].includes(value)) return fail(usage)
          options.push(`layer: ${str(value)}`)
        } else if (
          ['x', 'y', 'width', 'height', 'opacity', 'scale', 'rotate', 'ms'].includes(key)
        ) {
          if (!Number.isFinite(Number(value))) return fail(usage)
          options.push(`${key === 'ms' ? 'duration' : key}: ${Number(value)}`)
        } else return fail(usage)
      }
      return `await image(${str(name)}, ${str(src)}${options.length ? `, { ${options.join(', ')} }` : ''})`
    }
    case 'weather': {
      const [kind, intensity] = rest
      if (!kind || (intensity !== undefined && !Number.isFinite(Number(intensity))))
        return fail('use: weather <kind> [intensity] | weather none')
      if (kind === 'none') return 'weather(null)'
      return `weather(${str(kind)}${intensity ? `, { intensity: ${Number(intensity)} }` : ''})`
    }
    case '@start': {
      // Dev only: the dev server opens here (vite/devStart.ts, src/core/dev/start.ts).
      const options = parseVnStart(args)
      if ('error' in options) return fail(options.error)
      return Object.keys(options).length ? `devStart(${JSON.stringify(options)})` : 'devStart()'
    }
    case 'frame': {
      // frame <who> <from> <to> [ms <n>]: animate which part of the portrait fills the stage.
      const usage = 'use: frame <who> <from> <to> [ms <n>] (parts of the picture, 0..1)'
      const [who, from, to, msWord, ms, extra] = rest
      const number = (word: string | undefined) => word !== undefined && /^[\d.]+$/.test(word)
      if (!who || !number(from) || !number(to) || extra) return fail(usage)
      if (msWord !== undefined && (msWord !== 'ms' || !number(ms))) return fail(usage)
      const options = ms === undefined ? '' : `, { duration: ${Number(ms)} }`
      return `await animate(${str(who)}, { frame: [${Number(from)}, ${Number(to)}] }${options})`
    }
    case 'move': {
      const [who, name, extra] = rest
      if (!who || !name || extra) return fail('use: move <who> <move>')
      return `await move(${str(who)}, ${str(name)})`
    }
    case 'nvl':
      if (args === 'on' || args === '') return 'nvl(true)'
      if (args === 'off') return 'nvl(false)'
      if (args === 'clear') return 'clearPage()'
      return fail('use: nvl on | nvl off | nvl clear')
    case 'chapter':
      // Awaited: a 'screen' chapter card hides the stage changes after it (scene/chapterCard.ts).
      return args ? `await ctx.chapter(${str(args)})` : fail('use: chapter <id>')
    case 'ending':
      return args ? `ending(${str(args)})` : fail('use: ending <id>')
    case 'filter': {
      const m = /^(\S+)(?:\s+on\s+(\S+))?$/.exec(args)
      if (!m)
        return fail(
          'use: filter <preset or tint> [on all|background|characters|<who>] | filter none [on …]',
        )
      return `filter(${none(m[1] as string)}${m[2] ? `, { on: ${str(m[2])} }` : ''})`
    }
    case 'fade': {
      const [color, ms] = rest
      if (!color) return fail('use: fade <colour|none> [ms]')
      return `await fade(${none(color)}${ms ? `, ${Number(ms)}` : ''})`
    }
    case 'wait': {
      const seconds = Number(args)
      return Number.isFinite(seconds)
        ? `await wait(${Math.round(seconds * 1000)})`
        : fail('use: wait <seconds>')
    }
    case 'music':
      return args === 'none' ? 'game.audio.stopMusic()' : `game.audio.music(${str(args)})`
    case 'ambient':
      return `game.audio.ambient(${none(args)})`
    case 'sfx':
      return `game.audio.sfx(${str(args)})`
    case 'event':
      return new RegExp(`^${PATH_ID}$`).test(args)
        ? `await event(${str(args)})`
        : fail('use: event <id>')
    case 'set': {
      const m = new RegExp(String.raw`^(${ID})\s*(=|\+=|-=)\s*(.+)$`).exec(args)
      if (!m) return fail('use: set <flag> = <value> | set <flag> += <number>')
      const [, flag, op, value] = m
      if (op === '=') return `game.flags.set(${str(flag as string)}, ${value})`
      return `game.flags.add(${str(flag as string)}, ${op === '-=' ? '-' : ''}(${value}))`
    }
    case 'give':
    case 'take': {
      const [item, count] = rest
      if (!item) return fail(`use: ${word} <item> [count]`)
      return word === 'give'
        ? `game.items.add(${str(item)}, ${Number(count ?? 1)}, { notify: true })`
        : `game.items.remove(${str(item)}, ${Number(count ?? 1)})`
    }
    case 'money': {
      const n = Number(args)
      if (!Number.isFinite(n)) return fail('use: money +10 | money -5')
      return n >= 0 ? `game.money.add(${n}, { notify: true })` : `game.money.spend(${-n})`
    }
    case 'rename': {
      const [who, ...nameWords] = rest
      const name = nameWords.join(' ').replace(/^"(.*)"$/, '$1')
      if (!who || !name) return fail('use: rename <who> "New name"')
      return `game.characters.rename(${str(who)}, ${str(name)})`
    }
    case 'reveal':
      if (!args) return fail('use: reveal <who>')
      return `game.characters.reveal(${str(args)})`
    case 'love': {
      const [who, amount] = rest
      if (!who || !Number.isFinite(Number(amount))) return fail('use: love <who> +5')
      return `game.relationships.change(${str(who)}, ${Number(amount)}, { notify: true })`
    }
    case 'xp':
      return `game.party.giveXp('party', ${Number(args)}, { notify: true })`
    case 'join':
      return `game.party.add(${str(args)}, { notify: true })`
    case 'achievement':
      return `game.achievements.unlock(${str(args)})`
    case 'codex':
      return `game.codex.unlock(${str(args)})`
    case 'quest': {
      const [action, id, step] = rest
      if (action === 'start' && id) return `game.quests.start(${str(id)})`
      if (action === 'step' && id && step) return `game.quests.setStep(${str(id)}, ${str(step)})`
      if (action === 'done' && id) return `game.quests.complete(${str(id)})`
      return fail('use: quest start <id> | quest step <id> <step> | quest done <id>')
    }
    case 'window':
      return `game.windows.open(${str(args)})`
    case 'shop':
      return `game.shops.open(${str(args)})`
    case 'battle': {
      const enemies = args
        .split(',')
        .map((e) => e.trim())
        .filter(Boolean)
      if (enemies.length === 0) return fail('use: battle <troop> or battle <enemy>, <enemy>…')
      // Troop or enemy ids: game.battles.named() sorts them out (and the type check catches typos).
      return `await game.battles.start(game.battles.named([${enemies.map(str).join(', ')}]))`
    }
    case 'return':
    case 'end':
      return 'return'
    default:
      return null
  }
}

/** Commands that only change the game (no waiting, nothing on screen). */
export const STATE_COMMANDS: readonly string[] = [
  'set',
  'give',
  'take',
  'money',
  'love',
  'xp',
  'join',
  'achievement',
  'codex',
  'quest',
  'rename',
  'reveal',
]

/** A state command as one TS statement using `game` (null when the line is something else). */
export function stateCommand(text: string, no: number, errors: VnError[]): string | null {
  if (!STATE_COMMANDS.includes(text.split(/\s+/)[0] ?? '')) return null
  return command(text, no, errors)
}

function parseBlock(
  lines: Line[],
  start: number,
  indent: number,
  errors: VnError[],
): [Node[], number] {
  const nodes: Node[] = []
  let i = start
  while (i < lines.length) {
    const line = lines[i] as Line
    if (line.indent < indent) break
    if (line.indent > indent) {
      errors.push({ line: line.no, message: 'unexpected indent' })
      i++
      continue
    }
    const childIndent = () => lines[i + 1]?.indent ?? -1

    if (line.text === 'choice:') {
      const options: { no: number; label: string; when?: string; body: Node[] }[] = []
      const optIndent = childIndent()
      i++
      if (optIndent <= indent)
        errors.push({ line: line.no, message: 'choice: needs options below it (* text)' })
      while (i < lines.length && (lines[i] as Line).indent === optIndent && optIndent > indent) {
        const opt = lines[i] as Line
        const m = /^\*\s+(.+?)(?:\s+if\s+(.+))?$/.exec(opt.text)
        if (!m) {
          errors.push({ line: opt.no, message: 'options start with "* ", e.g. "* Yes, please"' })
          i++
          continue
        }
        const bodyIndent = lines[i + 1]?.indent ?? -1
        let body: Node[] = []
        i++
        if (bodyIndent > optIndent) [body, i] = parseBlock(lines, i, bodyIndent, errors)
        options.push({ no: opt.no, label: m[1] as string, when: m[2], body })
      }
      nodes.push({ kind: 'choice', no: line.no, options })
      continue
    }

    const ifMatch = /^if\s+(.+):$/.exec(line.text)
    if (ifMatch) {
      const branches: { no: number; cond: string | null; body: Node[] }[] = []
      let cond: string | null = ifMatch[1] as string
      let no = line.no
      for (;;) {
        const bodyIndent = childIndent()
        i++
        let body: Node[] = []
        if (bodyIndent > indent) [body, i] = parseBlock(lines, i, bodyIndent, errors)
        else errors.push({ line: no, message: 'needs an indented block below it' })
        branches.push({ no, cond, body })
        const next = lines[i]
        if (!next || next.indent !== indent) break
        const elif = /^elif\s+(.+):$/.exec(next.text)
        if (elif) {
          cond = elif[1] as string
          no = next.no
          continue
        }
        if (next.text === 'else:') {
          if (cond === null) break
          cond = null
          no = next.no
          continue
        }
        break
      }
      nodes.push({ kind: 'if', no: line.no, branches })
      continue
    }
    if (line.text === 'together:') {
      const bodyIndent = childIndent()
      i++
      let body: Node[] = []
      if (bodyIndent > indent) [body, i] = parseBlock(lines, i, bodyIndent, errors)
      else errors.push({ line: line.no, message: 'together: needs indented lines below it' })
      // One chat box: only one line in the block may talk (say, narration, choice, event).
      const talking = body.filter(talks)
      for (const extra of talking.slice(1))
        errors.push({
          line: extra.no,
          message: 'only one line in a together: block can show dialogue or a choice',
        })
      for (const no of endsInside(body))
        errors.push({ line: no, message: "end can't be used inside together:" })
      nodes.push({ kind: 'together', no: line.no, body })
      continue
    }
    if (/^(elif\s+.+|else):$/.test(line.text)) {
      errors.push({ line: line.no, message: `"${line.text}" without an "if" above it` })
      i++
      continue
    }

    const code = command(line.text, line.no, errors)
    if (code === null) {
      errors.push({
        line: line.no,
        message: `don't know "${line.text}" (lines are "who: text", "> narration", a command, or "$ code")`,
      })
    } else if (code) {
      const word = line.text.split(/\s+/)[0] ?? ''
      const what = STATE_COMMANDS.includes(word) ? 'state' : word === '$' ? 'raw' : undefined
      nodes.push({ kind: 'code', no: line.no, code, ...(what ? { what } : {}) })
    }
    i++
  }
  return [nodes, i]
}

/** Does this line (or block) show dialogue or a choice? */
function talks(node: Node): boolean {
  if (node.kind === 'code') return /^await (say|narrate|event)\(/.test(node.code)
  if (node.kind === 'choice') return true
  if (node.kind === 'if') return node.branches.some((b) => b.body.some(talks))
  return node.body.some(talks)
}

/** Line numbers of `end` anywhere inside these nodes. */
function endsInside(nodes: Node[]): number[] {
  return nodes.flatMap((node) => {
    if (node.kind === 'code') return node.code === 'return' ? [node.no] : []
    if (node.kind === 'choice') return node.options.flatMap((o) => endsInside(o.body))
    if (node.kind === 'if') return node.branches.flatMap((b) => endsInside(b.body))
    return endsInside(node.body)
  })
}

function emit(nodes: Node[], depth: number, file: string, out: string[]) {
  const pad = '  '.repeat(depth)
  for (const node of nodes) {
    if (node.kind === 'together') {
      // Every line (or block) below starts at once; the block ends when all of them are done.
      out.push(`${pad}await Promise.all([ // ${file}:${node.no}`)
      for (const child of node.body) {
        out.push(`${pad}  (async () => {`)
        emit([child], depth + 2, file, out)
        out.push(`${pad}  })(),`)
      }
      out.push(`${pad}])`)
    } else if (node.kind === 'code') {
      out.push(`${pad}${node.code} // ${file}:${node.no}`)
    } else if (node.kind === 'choice') {
      const entries = node.options.map((o, i) =>
        o.when
          ? `c${i}: { label: ${str(o.label)}, hidden: !(${condition(o.when)}) }`
          : `c${i}: ${str(o.label)}`,
      )
      out.push(`${pad}switch (await choice({ ${entries.join(', ')} })) { // ${file}:${node.no}`)
      node.options.forEach((o, i) => {
        out.push(`${pad}  case 'c${i}': {`)
        emit(o.body, depth + 2, file, out)
        out.push(`${pad}    break`, `${pad}  }`)
      })
      out.push(`${pad}}`)
    } else {
      node.branches.forEach((b, i) => {
        const head =
          b.cond === null ? '} else {' : `${i === 0 ? 'if' : '} else if'} (${condition(b.cond)}) {`
        out.push(`${pad}${head} // ${file}:${b.no}`)
        emit(b.body, depth + 1, file, out)
      })
      out.push(`${pad}}`)
    }
  }
}

/** Names a line may use and still be worked out without playing the scene (see setsOf). */
const KNOWN_NAMES = new Set([
  'game',
  'flag',
  'has',
  'love',
  'money',
  'inParty',
  'seen',
  'true',
  'false',
  'null',
  'undefined',
  'Math',
  'Number',
  'String',
])

/** The code only reads the game (no variable of the scene, no scene command). */
function readsOnlyGame(code: string): boolean {
  const bare = code.replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`/g, '""')
  for (const m of bare.matchAll(/(?<![\w$.])[A-Za-z_$][\w$]*/g)) {
    // An object key ({ notify: true }) is not a name that is read.
    if (/^\s*:(?!:)/.test(bare.slice((m.index ?? 0) + m[0].length))) continue
    if (!KNOWN_NAMES.has(m[0])) return false
  }
  return true
}

/**
 * What a scene leaves behind, without playing it: its state lines (set, love, money, give…) in
 * order, inside the `if`s they are written in. Flowchart jumps run this for scenes on the way
 * (a `sets` in flow.ts wins). `partial` = something could not be worked out: a choice or an `if`
 * on a scene variable with state lines inside, a nested event, a `$` line that uses `game`.
 */
function setsOf(nodes: Node[], depth: number): { lines: string[]; partial: boolean } {
  const pad = '  '.repeat(depth)
  const lines: string[] = []
  let partial = false
  for (const node of nodes) {
    if (node.kind === 'code') {
      if (node.code === 'return') lines.push(`${pad}return`)
      else if (node.what === 'state') {
        if (readsOnlyGame(node.code)) lines.push(`${pad}${node.code}`)
        else partial = true
      } else if (
        node.what === 'raw' ? /\bgame\b/.test(node.code) : /^await event\(/.test(node.code)
      )
        partial = true
    } else if (node.kind === 'together') {
      const inner = setsOf(node.body, depth)
      lines.push(...inner.lines)
      partial ||= inner.partial
    } else if (node.kind === 'choice') {
      // Which option was picked is not known here.
      if (node.options.some((o) => !isEmptySets(setsOf(o.body, depth)))) partial = true
    } else {
      const branches = node.branches.map((b) => ({
        cond: b.cond === null ? null : condition(b.cond),
        body: setsOf(b.body, depth + 1),
      }))
      if (branches.every((b) => isEmptySets(b.body))) continue
      if (branches.some((b) => b.body.partial || (b.cond !== null && !readsOnlyGame(b.cond)))) {
        partial = true
        continue
      }
      branches.forEach((b, i) => {
        lines.push(
          `${pad}${b.cond === null ? '} else {' : `${i === 0 ? 'if' : '} else if'} (${b.cond}) {`}`,
        )
        lines.push(...b.body.lines)
      })
      lines.push(`${pad}}`)
    }
  }
  return { lines, partial }
}

const isEmptySets = (sets: { lines: string[]; partial: boolean }) =>
  !sets.partial && sets.lines.every((line) => line.trim() === 'return')

/** .vn text -> the TS module (and errors with line numbers; the module still compiles around them). */
export function compileVn(source: string, file = 'index.vn'): { code: string; errors: VnError[] } {
  const errors: VnError[] = []
  // "title <text>" (not indented): the event's title, shown on saves made during it. Required.
  const all = splitLines(source)
  const titles = all.filter((l) => l.indent === 0 && /^title\s/.test(l.text))
  const title = titles[0]?.text.replace(/^title\s+/, '').trim() ?? ''
  if (!title)
    errors.push({
      line: 1,
      message: 'add "title <text>" (e.g. title The town sign): saves show it',
    })
  for (const extra of titles.slice(1))
    errors.push({ line: extra.no, message: 'only one "title" line per file' })
  const lines = all.filter((l) => !titles.includes(l))
  const [nodes] = parseBlock(lines, 0, lines[0]?.indent ?? 0, errors)
  const body: string[] = []
  emit(nodes, 2, file, body)
  const sets = setsOf(nodes, 1)
  const hasSets = !isEmptySets(sets)
  const code = [
    `// AUTO-GENERATED from ${file}. Edit that file, not this one.`,
    '/* eslint-disable */',
    "import { defineEvent } from '@/core/define'",
    ...(body.some((line) => /\bdevStart\(/.test(line))
      ? ["import { devStart } from '@/core/dev/start' // @start: remove before building"]
      : []),
    '',
    'export default defineEvent({',
    `  title: ${str(title)},`,
    ...(hasSets
      ? [
          '  // What this scene leaves behind (its set / love / money / give… lines), for flowchart',
          "  // jumps that pass it without playing it. A `sets` in the route's flow.ts wins.",
          '  leaves: {',
          ...(sets.partial ? ['    partial: true,'] : []),
          // `game` is typed inside the body: a Game type on the parameter would make the module's
          // type depend on itself (TS7022, see dev-notes/conventions.md TYPE CYCLE).
          '    run: (from: unknown): void => {',
          "      const game = from as import('@/core/game').Game",
          ...HELPERS.map((h) => `      ${h}`),
          '      void [flag, has, love, money, inParty, seen, variant]',
          ...sets.lines.map((l) => `    ${l}`),
          '    },',
          '  },',
        ]
      : []),
    '  run: async (ctx) => {',
    '    const { say, narrate, choice, show, hide, background, bg, cg, filter, fade, wait, event } = ctx',
    '    const { animate, camera, shake, startShake, stopShake, flash, random, game } = ctx',
    '    const { movie, input, image, inset, clearImages, weather, move, nvl, clearPage, ending } = ctx',
    ...HELPERS.map((h) => `    ${h}`),
    '    void [say, narrate, choice, show, hide, background, bg, cg, filter, fade, wait, event]',
    '    void [animate, camera, shake, startShake, stopShake, flash, random, movie, input]',
    '    void [image, inset, clearImages, weather, move, nvl, clearPage, ending]',
    '    void [flag, has, love, money, inParty, seen, variant]',
    ...body,
    '  },',
    '})',
    '',
  ].join('\n')
  return { code, errors }
}
