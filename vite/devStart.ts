// Dev start markers: `@start` in a .vn event or `devStart()` in a .ts event. The dev server then
// skips the boot screens and the title and loads the route box that plays that event, running it
// instantly up to the marker (src/core/dev/start.ts). Routes (visual novel mode) only. A build with
// a marker left in fails (vite/registry.ts).
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

/** One way answer: a choice() option (its text / key), or yes / no for flag() / check(). */
export type WayAnswer = string | boolean

export interface DevStartOptions {
  /** 'route/key': the box to load, when the event plays in more than one. */
  box?: string
  /** The route's answers on the way to the box, in the order it asks them (from the first route). */
  way?: WayAnswer[]
}

export interface DevStartMarker extends DevStartOptions {
  /** The event id. */
  event: string
  /** Where the marker is (file:line), for messages. */
  at: string
}

/**
 * `@start [box <route>/<key>] [answers…]` in a .vn file: answers are "quoted option text" (or a
 * one-word option), yes / no for flag() / check().
 */
export function parseVnStart(args: string): DevStartOptions | { error: string } {
  const tokens = [...args.matchAll(/"([^"]*)"|(\S+)/g)].map((m) =>
    m[1] !== undefined ? { quoted: true, word: m[1] } : { quoted: false, word: m[2] as string },
  )
  const options: DevStartOptions = {}
  if (tokens[0]?.word === 'box' && !tokens[0].quoted) {
    const box = tokens[1]?.word
    if (!box || !/^[a-z][a-z0-9_/]*\/[^/\s]+$/.test(box))
      return { error: 'use: @start box <route>/<key> [answers…]' }
    options.box = box
    tokens.splice(0, 2)
  }
  const way = tokens.map(({ quoted, word }): WayAnswer => {
    if (!quoted && (word === 'yes' || word === 'true')) return true
    if (!quoted && (word === 'no' || word === 'false')) return false
    return word
  })
  if (way.length > 0) options.way = way
  return options
}

/** The text between the brackets of the call that starts at `open` (the "("), or null. */
function callArgs(code: string, open: number): string | null {
  let depth = 0
  for (let i = open; i < code.length; i++) {
    const c = code[i]
    if (c === '(') depth++
    else if (c === ')') {
      depth--
      if (depth === 0) return code.slice(open + 1, i)
    }
  }
  return null
}

/** `devStart(…)` in a .ts event: its options (an object literal written in the file). */
export function parseTsStart(code: string): { options: DevStartOptions; line: number } | null {
  for (const match of code.matchAll(/\bdevStart\s*\(/g)) {
    const index = match.index ?? 0
    const lineStart = code.lastIndexOf('\n', index) + 1
    // Commented out (// devStart()) does not count.
    if (/^\s*(\/\/|\*)/.test(code.slice(lineStart, index))) continue
    const args = callArgs(code, index + match[0].length - 1)
    if (args === null) continue
    const line = code.slice(0, index).split('\n').length
    if (!args.trim()) return { options: {}, line }
    try {
      // The developer's own literal in their own file (dev tooling only).
      const value = new Function(`return (${args})`)() as DevStartOptions | undefined
      return { options: value ?? {}, line }
    } catch {
      return { options: {}, line }
    }
  }
  return null
}

/** Every marker in src/content/events (the first one wins; the others get a warning). */
export function scanDevStarts(
  root: string,
  events: readonly string[],
  warn: (message: string) => void = console.warn,
): DevStartMarker | null {
  const found: DevStartMarker[] = []
  const eventsDir = path.join(root, 'src/content/events')
  for (const id of events) {
    const candidates = [
      path.join(eventsDir, id, 'index.vn'),
      path.join(eventsDir, `${id}.vn`),
      path.join(eventsDir, id, 'index.ts'),
      path.join(eventsDir, id, 'index.tsx'),
    ]
    for (const file of candidates) {
      if (!existsSync(file)) continue
      const code = readFileSync(file, 'utf8')
      const rel = path.relative(root, file).split(path.sep).join('/')
      if (file.endsWith('.vn')) {
        const lines = code.split('\n')
        const at = lines.findIndex((l) => /^\s*@start\b/.test(l))
        if (at === -1) continue
        const parsed = parseVnStart((lines[at] as string).replace(/^\s*@start\b/, '').trim())
        if ('error' in parsed) continue // the .vn check reports it
        found.push({ event: id, ...parsed, at: `${rel}:${at + 1}` })
      } else {
        const start = parseTsStart(code)
        if (start) found.push({ event: id, ...start.options, at: `${rel}:${start.line}` })
      }
    }
  }
  for (const extra of found.slice(1))
    warn(`[dev start] ${extra.at}: only the first marker counts (${found[0]?.at})`)
  return found[0] ?? null
}
