// src/content/routes/<name>/index.vn -> index.gen.ts (a defineRoute module). A route script is the
// story's order only: events (flowchart boxes), branches, movies, and the next route.
//
//   title Common
//   description Arriving in town.
//   color #7fb3ff
//   image ./art/common.png
//   after story [ending anna]   (an after story: on the title screen's "After Stories" once
//                               every listed ending was reached; VN mode only)
//   event vn_demo/arrival as arrival
//   if flag('vn_trust_jack'):
//     event vn_demo/jack_story as jack_story
//   elif check('rich', game.money.get() > 100):
//     event vn_demo/rich as rich
//   else:
//     event vn_demo/jack_lies as jack_lies
//   movie credits
//   chapter vn_evening    (a chapter begins: src/content/chapters.ts; a line on the flowchart)
//   route anna            (moves on to that route: always the last line of its block)
//   end                   (the route ends here: back to the title)
//   ending normal         (the story ends here with that ending: src/content/endings/normal,
//                         reached for good and listed in Extras; a route may have several)
//   choice:
//     * I know who you are [ending anna]  (a hidden option: only once ending anna was reached;
//                                         [flag id] = only while that flag is on; one left = no question)
//
// Conditions may only use flag('id') and check('label', condition), with and / or / not:
// that is how the flowchart sees both ways (docs/story/routes.html).
// Runs through Node type stripping: no enums, namespaces or parameter properties here.
import { checkVn, type VnProblem } from './check.ts'
import { STATE_COMMANDS, stateCommand, type VnError } from './compile.ts'
import { type Completion, completeVn, type Suggestion } from './complete.ts'
import type { VnIds } from './ids.ts'

const ID = '[a-z][a-z0-9_]*'
const PATH_ID = '[a-z][a-z0-9_/]*'
const str = (text: string) => JSON.stringify(text)

interface Line {
  no: number
  indent: number
  text: string
}

/** Header lines: shown on the flowchart (title is required). */
const HEADER = ['title', 'description', 'color', 'image'] as const

/** One condition -> TS, or an error message. Atoms: [not] flag('x') | check('label', expr). */
export function routeCondition(expr: string): { code: string } | { error: string } {
  const atoms: string[] = []
  // check(...) first: its condition may contain and / or / not of its own.
  let rest = expr.trim()
  const out: string[] = []
  while (rest) {
    const not = /^(not\s+|!\s*)/.exec(rest)
    if (not) {
      out.push('!')
      rest = rest.slice(not[0].length)
      continue
    }
    const open = /^\(\s*/.exec(rest)
    if (open) {
      out.push('(')
      rest = rest.slice(open[0].length)
      continue
    }
    const flag = new RegExp(String.raw`^flag\(\s*(['"])(${ID})\1\s*\)\s*`).exec(rest)
    if (flag) {
      atoms.push(flag[2] as string)
      out.push(`flag(${str(flag[2] as string)})`)
      rest = rest.slice(flag[0].length)
    } else {
      const check = /^check\(\s*(['"])([^'"]+)\1\s*,/.exec(rest)
      if (!check) {
        return {
          error: `a route can only branch on flag('id') or check('label', condition), not "${rest}"`,
        }
      }
      // The check's own condition runs up to its closing bracket.
      let depth = 1
      let i = check[0].length
      for (; i < rest.length && depth > 0; i++) {
        if (rest[i] === '(') depth++
        if (rest[i] === ')') depth--
      }
      if (depth !== 0) return { error: `check(...) is missing its closing ")"` }
      const inner = rest.slice(check[0].length, i - 1).trim()
      if (!inner) return { error: `check('${check[2]}', …) needs a condition` }
      const ts = inner
        .replace(/\bnot\s+/g, '!')
        .replace(/\band\b/g, '&&')
        .replace(/\bor\b/g, '||')
      atoms.push(check[2] as string)
      out.push(`check(${str(check[2] as string)}, (game) => ${ts})`)
      rest = rest.slice(i).trimStart()
    }
    for (;;) {
      const close = /^\)\s*/.exec(rest)
      if (!close) break
      out.push(')')
      rest = rest.slice(close[0].length)
    }
    const join = /^(and|or|&&|\|\|)\s+/.exec(rest)
    if (join) {
      out.push(join[1] === 'and' || join[1] === '&&' ? ' && ' : ' || ')
      rest = rest.slice(join[0].length)
    } else if (rest) {
      return { error: `expected "and" or "or" before "${rest}"` }
    }
  }
  if (atoms.length === 0) return { error: 'the condition is empty' }
  return { code: out.join('') }
}

function splitLines(source: string): Line[] {
  const lines: Line[] = []
  source.split(/\r?\n/).forEach((raw, i) => {
    const text = raw.replace(/^\s*#.*$/, '')
    if (!text.trim()) return
    lines.push({ no: i + 1, indent: text.length - text.trimStart().length, text: text.trim() })
  })
  return lines
}

export function compileRouteVn(
  source: string,
  file = 'index.vn',
): { code: string; errors: VnError[] } {
  const errors: VnError[] = []
  const fail = (no: number, message: string) => errors.push({ line: no, message })
  const header: Partial<Record<(typeof HEADER)[number], string>> = {}
  /** `after story [ending x] …`: the endings it needs (null = not an after story). */
  let afterStory: string[] | null = null
  const body: string[] = []
  /** Open blocks: the indent of the line that opened it, and of the lines inside it. */
  const stack: {
    opener: number
    inside: number | null
    kind: 'block' | 'choice' | 'option'
    /** choice: its option texts, and the body line that gets them once the block closes. */
    options?: string[]
    at?: number
    /** choice: its question / who (code), and hidden options (option text -> condition code). */
    ask?: string[]
    hidden?: Record<string, string>
    /** choice: what picking an option does (option text -> statements using `game`). */
    effects?: Record<string, string[]>
    /** option: its text, and whether a line other than an effect has come in it. */
    text?: string
    started?: boolean
  }[] = []
  let depth = 0
  /** The last statement at each depth ended the block (route / end): nothing may follow it. */
  let closedAt: number | null = null
  /** Ends the innermost block: a choice gets its options, an option its `break`. */
  const close = () => {
    const b = stack.pop()
    depth--
    const pad = '  '.repeat(depth + 2)
    if (b?.kind === 'option' && closedAt !== depth + 1) body.push(`${pad}  break`)
    if (b?.kind === 'choice' && b.at !== undefined) {
      const list = (b.options ?? []).map((o) => `${str(o)}: ${str(o)}`).join(', ')
      const hidden = Object.entries(b.hidden ?? {}).map(([o, c]) => `${str(o)}: ${c}`)
      const effects = Object.entries(b.effects ?? {}).map(
        ([o, lines]) => `${str(o)}: (game) => { ${lines.join('; ')} }`,
      )
      const parts = [
        ...(b.ask ?? []),
        ...(hidden.length ? [`hidden: { ${hidden.join(', ')} }`] : []),
        ...(effects.length ? [`effects: { ${effects.join(', ')} }`] : []),
      ]
      const ask = parts.length ? `, { ${parts.join(', ')} }` : ''
      body[b.at] = (body[b.at] as string)
        .replace('__OPTIONS__', `{ ${list} }`)
        .replace('__ASK__', ask)
    }
    body.push(`${pad}}`)
    if (closedAt !== null && closedAt > depth) closedAt = null
  }

  for (const line of splitLines(source)) {
    const [word = ''] = line.text.split(/\s+/)
    const args = line.text.slice(word.length).trim()
    if (word === 'after' && line.indent === 0 && body.length === 0) {
      const m = new RegExp(String.raw`^story((?:\s*\[ending\s+${ID}\])*)\s*$`).exec(args)
      if (!m) fail(line.no, 'use: after story [ending <id>] [ending <id>]…')
      else if (afterStory) fail(line.no, 'a second "after story" line')
      else
        afterStory = [...(m[1] ?? '').matchAll(new RegExp(`\\[ending\\s+(${ID})\\]`, 'g'))].map(
          (e) => e[1] as string,
        )
      continue
    }
    if ((HEADER as readonly string[]).includes(word) && line.indent === 0 && body.length === 0) {
      const key = word as (typeof HEADER)[number]
      if (header[key] !== undefined) fail(line.no, `a second "${key}" line`)
      else if (!args) fail(line.no, `"${key}" needs a value`)
      else header[key] = args
      continue
    }
    // Leaving blocks: close every block this line is not inside of.
    while (stack.length && line.indent <= (stack.at(-1)?.opener as number)) close()
    const top = stack.at(-1)
    if (top) {
      top.inside ??= line.indent
      if (line.indent !== top.inside)
        fail(line.no, 'this line is indented differently from the lines above it')
    } else if (line.indent > 0) {
      fail(
        line.no,
        'this line is indented, but no block (if / elif / else / choice) starts above it',
      )
    }
    if (closedAt !== null && closedAt === depth && !/^(elif\b|else\s*:)/.test(line.text)) {
      fail(line.no, 'nothing can come after `route` or `end` in the same block')
      closedAt = null
    }
    const pad = '  '.repeat(depth + 2)
    const where = ` // ${file}:${line.no}`
    const block = (code: string) => {
      body.push(`${pad}${code} {${where}`)
      stack.push({ opener: line.indent, inside: null, kind: 'block' })
      depth++
      closedAt = null
    }
    const branch = (code: string) => {
      const last = body.at(-1)
      if (last?.trim() !== '}') {
        fail(line.no, `"${word}" must follow an if / elif block at the same indent`)
        return
      }
      body[body.length - 1] = `${pad}} ${code} {${where}`
      stack.push({ opener: line.indent, inside: null, kind: 'block' })
      depth++
      closedAt = null
    }
    const cond = (text: string) => {
      const m = /^(.*):$/.exec(text)
      if (!m) {
        fail(line.no, `end the line with ":"`)
        return null
      }
      const c = routeCondition(m[1] as string)
      if ('error' in c) {
        fail(line.no, c.error)
        return null
      }
      return c.code
    }

    // "* Option text" inside a choice block.
    if (line.text.startsWith('*')) {
      let text = line.text.slice(1).trim()
      // Hidden option conditions at the end: [ending anna] [ending normal] [flag met_anna].
      const endings: string[] = []
      let needsFlag: string | null = null
      for (;;) {
        const m = new RegExp(String.raw`\s*\[(ending|flag)\s+(${ID})\]$`).exec(text)
        if (!m) break
        if (m[1] === 'ending') endings.unshift(str(m[2] as string))
        else needsFlag = m[2] as string
        text = text.slice(0, m.index).trim()
      }
      const conds = [
        ...(endings.length ? [`requiresEnding: [${endings.join(', ')}]`] : []),
        ...(needsFlag ? [`requiredFlag: ${str(needsFlag)}`] : []),
      ]
      if (conds.length && top?.kind === 'choice' && text) {
        top.hidden = { ...top.hidden, [text]: `{ ${conds.join(', ')} }` }
      }
      if (top?.kind !== 'choice') fail(line.no, '"* option" lines go inside a choice block')
      else if (!text) fail(line.no, 'an option needs its text: * Wave back')
      else if (top.options?.includes(text)) fail(line.no, `"${text}" is already an option`)
      else {
        top.options?.push(text)
        body.push(`${pad}case ${str(text)}: {${where}`)
        stack.push({ opener: line.indent, inside: null, kind: 'option', text })
        depth++
        closedAt = null
      }
      continue
    }
    // Right under an option: what picking it does (love anna +1, set waved = true, money -5…).
    // These run when it is picked, and again on a flowchart jump that passes this pick.
    if (STATE_COMMANDS.includes(word)) {
      const choice = stack.at(-2)
      if (top?.kind !== 'option' || choice?.kind !== 'choice' || top.text === undefined) {
        fail(
          line.no,
          `"${word}" changes the game: in a route it goes right under a choice option (* …), or into an event`,
        )
      } else if (top.started) {
        fail(line.no, `put "${word}" before the other lines of this option`)
      } else {
        const code = stateCommand(line.text, line.no, errors)
        if (code) {
          choice.effects ??= {}
          const list = choice.effects[top.text] ?? []
          list.push(code)
          choice.effects[top.text] = list
        }
      }
      continue
    }
    if (top?.kind === 'option') top.started = true
    if (top?.kind === 'choice') {
      fail(line.no, 'a choice block holds only "* option" lines')
      continue
    }

    switch (word) {
      case 'choice':
      case 'choice:': {
        const m = new RegExp(String.raw`^choice(?:\s+(${ID}))?\s*:\s*(.*)$`).exec(line.text)
        if (!m) {
          fail(line.no, 'use: choice: | choice: <question> | choice <who>: <question>')
          break
        }
        const [, who, text] = m
        const ask = text ? [`text: ${str(text)}`, ...(who ? [`who: ${str(who)}`] : [])] : []
        if (who && !text) fail(line.no, `choice ${who}: needs the question ${who} asks`)
        body.push(`${pad}switch (await choice(__OPTIONS____ASK__)) {${where}`)
        stack.push({
          opener: line.indent,
          inside: null,
          kind: 'choice',
          options: [],
          at: body.length - 1,
          ask,
        })
        depth++
        closedAt = null
        break
      }
      case 'event': {
        // Without `as`, the box is named after the last part of the event id.
        const m = new RegExp(String.raw`^(${PATH_ID})(?:\s+as\s+(${ID}))?$`).exec(args)
        if (!m) fail(line.no, 'use: event <event id> [as <box name>]')
        else
          body.push(
            `${pad}await event(${str(m[1] as string)}${m[2] ? `, ${str(m[2])}` : ''})${where}`,
          )
        break
      }
      case 'if': {
        const c = cond(args)
        if (c) block(`if (${c})`)
        break
      }
      case 'elif': {
        const c = cond(args)
        if (c) branch(`else if (${c})`)
        break
      }
      case 'else:':
      case 'else': {
        if (line.text !== 'else:') fail(line.no, 'use: else:')
        else branch('else')
        break
      }
      case 'movie': {
        if (!new RegExp(`^${PATH_ID}$`).test(args)) fail(line.no, 'use: movie <movie id>')
        else body.push(`${pad}await movie(${str(args)})${where}`)
        break
      }
      case 'chapter': {
        if (!new RegExp(`^${ID}$`).test(args)) fail(line.no, 'use: chapter <chapter id>')
        else body.push(`${pad}chapter(${str(args)})${where}`)
        break
      }
      case 'route': {
        if (!new RegExp(`^${ID}$`).test(args)) fail(line.no, 'use: route <route id>')
        else {
          body.push(`${pad}return startRoute(${str(args)})${where}`)
          closedAt = depth
        }
        break
      }
      case 'end': {
        if (args) fail(line.no, 'use: end (or: ending <ending id>)')
        else {
          body.push(`${pad}return${where}`)
          closedAt = depth
        }
        break
      }
      case 'ending': {
        if (!new RegExp(`^${ID}$`).test(args)) fail(line.no, 'use: ending <ending id>')
        else {
          body.push(`${pad}return ending(${str(args)})${where}`)
          closedAt = depth
        }
        break
      }
      default:
        fail(
          line.no,
          `unknown line "${line.text}": a route has event, choice, if / elif / else, movie, chapter, route, ending and end`,
        )
    }
  }
  while (stack.length) close()
  if (!header.title) fail(1, 'a route needs a `title <text>` line at the top')

  const imports = ["import { defineRoute } from '@/core/define'"]
  if (header.image) imports.push(`import image from ${str(header.image)}`)
  const fields = [
    `  title: ${str(header.title ?? '')},`,
    ...(header.description ? [`  description: ${str(header.description)},`] : []),
    ...(header.color ? [`  color: ${str(header.color)},`] : []),
    ...(header.image ? ['  image,'] : []),
    ...(afterStory
      ? [`  afterStory: { requiresEnding: [${afterStory.map(str).join(', ')}] },`]
      : []),
  ]
  const code = [
    `// AUTO-GENERATED from ${file}. Edit that file, not this one.`,
    '/* eslint-disable */',
    ...imports,
    '',
    'export default defineRoute({',
    ...fields,
    '  run: async ({ event, choice, flag, check, startRoute, ending, movie, chapter }) => {',
    '    void [event, choice, flag, check, startRoute, ending, movie, chapter]',
    ...body,
    '  },',
    '})',
    '',
  ].join('\n')
  return { code, errors }
}

/** Unknown event, route and flag ids in a route script (for warnings and the editor). */
export function checkRouteVn(source: string, ids: VnIds): VnProblem[] {
  const problems: VnProblem[] = []
  const known = (list: readonly string[] | undefined, id: string) => !list || list.includes(id)
  source.split(/\r?\n/).forEach((raw, i) => {
    const text = raw.replace(/^\s*#.*$/, '')
    const at = (word: string, from: number) => text.indexOf(word, from)
    // Effect lines under an option (love anna +1…) are checked like the same line in an event.
    if (STATE_COMMANDS.includes(text.trim().split(/\s+/)[0] ?? '')) {
      for (const p of checkVn(text, ids)) problems.push({ ...p, line: i + 1 })
      return
    }
    const event = new RegExp(String.raw`^\s*event\s+(${PATH_ID})`).exec(text)
    if (event && !known(ids.events, event[1] as string)) {
      const id = event[1] as string
      problems.push({
        line: i + 1,
        column: at(id, 0),
        length: id.length,
        message: `no event "${id}"`,
      })
    }
    const chapter = new RegExp(String.raw`^\s*chapter\s+(${ID})\s*$`).exec(text)
    if (chapter && !known(ids.chapters, chapter[1] as string)) {
      const id = chapter[1] as string
      problems.push({
        line: i + 1,
        column: at(id, text.indexOf('chapter') + 7),
        length: id.length,
        message: `no chapter "${id}" (src/content/chapters.ts)`,
      })
    }
    const route = new RegExp(String.raw`^\s*route\s+(${ID})\s*$`).exec(text)
    if (route && !known(ids.routes, route[1] as string)) {
      const id = route[1] as string
      problems.push({
        line: i + 1,
        column: at(id, 0),
        length: id.length,
        message: `no route "${id}"`,
      })
    }
    const ending = new RegExp(String.raw`^\s*ending\s+(${ID})\s*$`).exec(text)
    if (ending && !known(ids.endings, ending[1] as string)) {
      const id = ending[1] as string
      problems.push({
        line: i + 1,
        column: at(id, text.indexOf('ending') + 6),
        length: id.length,
        message: `no ending "${id}" (src/content/endings)`,
      })
    }
    for (const m of text.matchAll(new RegExp(String.raw`\[(ending|flag)\s+(${ID})\]`, 'g'))) {
      const id = m[2] as string
      const list = m[1] === 'ending' ? ids.endings : ids.flags
      if (!known(list, id)) {
        problems.push({
          line: i + 1,
          column: at(id, m.index ?? 0),
          length: id.length,
          message:
            m[1] === 'ending'
              ? `no ending "${id}" (src/content/endings)`
              : `no flag "${id}" (src/content/flags.ts)`,
        })
      }
    }
    for (const m of text.matchAll(new RegExp(String.raw`\bflag\(\s*['"](${ID})['"]`, 'g'))) {
      const id = m[1] as string
      if (!known(ids.flags, id)) {
        problems.push({
          line: i + 1,
          column: at(id, m.index ?? 0),
          length: id.length,
          message: `no flag "${id}" (src/content/flags.ts)`,
        })
      }
    }
  })
  return problems
}

/** The lines a route script can have, for the editor. */
export const ROUTE_COMMANDS: { name: string; detail: string; insert: string }[] = [
  {
    name: 'event',
    detail: 'event <event id> [as <box name>] (one flowchart box)',
    insert: 'event $1',
  },
  {
    name: 'love',
    detail: 'love <who> +1 (right under a choice option: what picking it does)',
    insert: 'love $1 +1',
  },
  {
    name: 'set',
    detail: 'set <flag> = true (right under a choice option: what picking it does)',
    insert: 'set $1 = true',
  },
  {
    name: 'if',
    detail: "if flag('id'): / if check('label', condition):",
    insert: "if flag('$1'):",
  },
  { name: 'elif', detail: "elif flag('id'):", insert: "elif flag('$1'):" },
  { name: 'else:', detail: 'else:', insert: 'else:' },
  {
    name: 'choice',
    detail: 'choice: | choice: <question> | choice <who>: <question>, then "* option" lines',
    insert: 'choice:\n  * $1',
  },
  { name: 'movie', detail: 'movie <movie id> (between two boxes)', insert: 'movie $1' },
  {
    name: 'chapter',
    detail: 'chapter <chapter id> (a chapter begins; a line on the flowchart)',
    insert: 'chapter $1',
  },
  {
    name: 'route',
    detail: 'route <route id> (go on in that route; last line of its block)',
    insert: 'route $1',
  },
  { name: 'end', detail: 'end (the story ends here: back to the title)', insert: 'end' },
  {
    name: 'ending',
    detail: 'ending <ending id> (the story ends here with that ending; listed in Extras)',
    insert: 'ending $1',
  },
  { name: 'title', detail: 'title <text> (required, at the top)', insert: 'title $1' },
  { name: 'description', detail: 'description <text>', insert: 'description $1' },
  { name: 'color', detail: 'color <css colour> (tab and route boxes)', insert: 'color $1' },
  { name: 'image', detail: 'image <./picture.png> (route box and tab)', insert: 'image ./$1' },
  {
    name: 'after',
    detail: 'after story [ending <id>] (an after story, VN mode: title screen "After Stories")',
    insert: 'after story [ending $1]',
  },
]

/** What to suggest at the cursor in a route script (the editor extension shows it). */
export function completeRouteVn(lineText: string, column: number, ids: VnIds): Completion {
  const before = lineText.slice(0, column)
  const partial = /[a-z0-9_/]*$/i.exec(before)?.[0] ?? ''
  const start = column - partial.length
  const done = (items: Suggestion[]): Completion => ({ start, items })
  const values = (list: readonly string[] | undefined, detail: string) =>
    done((list ?? []).map((label) => ({ label, kind: 'value' as const, detail })))
  const trimmed = before.trimStart()
  // Effect lines under an option complete like the same line in an event.
  if (STATE_COMMANDS.includes(trimmed.split(/\s+/)[0] ?? '') && /\s/.test(trimmed))
    return completeVn(lineText, column, ids)
  if (/^[a-z:]*$/i.test(trimmed)) {
    return done(
      ROUTE_COMMANDS.map((c) => ({
        label: c.name,
        kind: 'command' as const,
        detail: c.detail,
        insert: c.insert,
        snippet: true,
      })),
    )
  }
  if (/^event\s+[a-z0-9_/]*$/i.test(trimmed)) return values(ids.events, 'event')
  if (/^event\s+\S+\s+[a-z]*$/i.test(trimmed)) {
    return done([{ label: 'as', kind: 'keyword', detail: 'as <box name>', insert: 'as ' }])
  }
  if (/^route\s+[a-z0-9_]*$/i.test(trimmed)) return values(ids.routes, 'route')
  if (/^chapter\s+[a-z0-9_]*$/i.test(trimmed)) return values(ids.chapters, 'chapter')
  if (/^ending\s+[a-z0-9_]*$/i.test(trimmed)) return values(ids.endings, 'ending')
  if (/\[ending\s+[a-z0-9_]*$/i.test(trimmed)) return values(ids.endings, 'ending')
  if (/\[flag\s+[a-z0-9_]*$/i.test(trimmed)) return values(ids.flags, 'flag')
  if (/\bflag\(\s*['"][a-z0-9_]*$/i.test(trimmed)) return values(ids.flags, 'flag')
  return done([])
}
