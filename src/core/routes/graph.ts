// A route's flowchart, worked out from its `run` (dry runs): events don't play, and every answer
// combination of its flag() / check() calls is tried. Boxes are the event keys, so branches that
// call the same key join there. Also used to replay a route's way up to a box (saves, jumps).
import type { HiddenOption, RouteContext, RouteEnd, RouteId } from '../defs/routes'
import type { EventId, MovieId } from '../registry'

/** Keys are lowercase names, like ids. */
export const KEY_PATTERN = /^[a-z][a-z0-9_]*$/

/** A box's name: the one given, else the last part of its event id ('common/day1' -> 'day1'). */
export function boxKeyOf(event: string, key?: string): string {
  return key ?? event.split('/').at(-1) ?? event
}
/** Dry runs per route before the chart stops looking (a warning says so). */
export const MAX_DRY_RUNS = 4096
/** Branches in one way through a route (a `while (flag(...))` loop would never end otherwise). */
export const MAX_BRANCHES_PER_RUN = 256

/** Boxes that are not events: the start, a link into another route, the end of the game. */
export const START = '@start'
export const END = '@end'
export const routeBox = (id: RouteId) => `@route:${id}`

export class RouteError extends Error {
  constructor(route: string, message: string) {
    super(`Route "${route}": ${message}`)
    this.name = 'RouteError'
  }
}

/** A flag() / check() answer (true / false), or the key of the option picked in a choice(). */
export type Answer = boolean | string

/** One flag() / check() / choice() answer on the way. */
export interface Branch {
  kind: 'flag' | 'check' | 'choice'
  /** The flag id, the check's label, or the picked option's text. */
  name: string
  value: Answer
  /** Left to right on the chart: yes before no, choice options in their order. */
  order: number
}

export type RouteNode =
  | { kind: 'start'; key: typeof START }
  | { kind: 'event'; key: string; event: EventId }
  | { kind: 'route'; key: string; route: RouteId }
  | { kind: 'end'; key: typeof END }
  | {
      kind: 'choice'
      key: string
      question?: string
      /** Option texts, and their keys (same order). */
      options: string[]
      keys: string[]
      /** Option key -> when it shows (choice ask.hidden). */
      hidden?: Record<string, HiddenOption>
    }

/**
 * The box key of a choice(): its own name (`{ key: 'trust_jack' }`), else made from its option keys.
 * Starts with "?" so it never clashes with an event box.
 */
export function choiceKey(options: Record<string, string>, key?: string): string {
  const base = key ?? Object.keys(options).join('_')
  return `?${base.toLowerCase().replace(/[^a-z0-9_]+/g, '_')}`
}

/** Key of a choice option the player picked live: "?stay_go=stay" (kept like a seen box). */
export const optionKey = (choiceBox: string, option: string) => `${choiceBox}=${option}`

export interface RouteEdge {
  from: string
  to: string
  /** The branches taken between the two boxes, one list per way the code reaches this line. */
  when: Branch[][]
  /** Movies played between the two boxes. */
  movies: MovieId[]
}

/** One way through the route, as a dry run went. */
export interface RoutePath {
  /** Box keys in order, from START to a route box or END. */
  nodes: string[]
  /** Every flag() / check() / choice() answer, in order. */
  answers: Answer[]
  /** For each answer: how many boxes were passed before it (START counts, so the first is 1). */
  answerAt: number[]
}

export interface RouteGraph {
  route: RouteId
  nodes: Record<string, RouteNode>
  edges: RouteEdge[]
  paths: RoutePath[]
  /** Routes this one can start. */
  links: RouteId[]
  /** True when MAX_DRY_RUNS was reached: the chart may be missing ways. */
  truncated: boolean
  /**
   * Box key -> the chapters (chapter() in the route) the story is in when it enters that box, one
   * per way that reaches it with a different one. Boxes before any chapter() aren't listed.
   */
  chapters: Record<string, string[]>
}

type Run = (ctx: RouteContext) => unknown

interface Trace extends RoutePath {
  /** The event box keys and their events. */
  events: { key: string; event: EventId }[]
  /** The choice boxes. */
  choices: {
    key: string
    question?: string
    options: string[]
    keys: string[]
    hidden?: Record<string, HiddenOption>
  }[]
  branches: Branch[]
  /** For each answer: every answer it could have had (the first is the one tried first). */
  options: Answer[][]
  /** Movies before each box (index = position in `nodes`). */
  movies: MovieId[][]
  /** The chapter when entering each box (index = position in `nodes`), or null. */
  chapterAt: (string | null)[]
}

/** Makes the marker startRoute() / ending() returns (checked when `run` returns it). */
export function routeEndMarker(route: RouteId): RouteEnd {
  return { route, __routeEnd: true } as unknown as RouteEnd
}

/** One dry run with the first answers forced (the rest take their first option). */
async function trace(route: RouteId, run: Run, forced: readonly Answer[]): Promise<Trace> {
  const t: Trace = {
    nodes: [START],
    answers: [],
    answerAt: [],
    events: [],
    choices: [],
    branches: [],
    options: [],
    movies: [[]],
    chapterAt: [null],
  }
  let chapter: string | null = null
  let next: RouteId | null = null
  let ending: string | null = null
  const seen = new Set<string>()
  const ended = (what: string) => {
    if (next)
      throw new RouteError(
        route,
        `${what} after startRoute('${next}'): use \`return startRoute(...)\``,
      )
    if (ending)
      throw new RouteError(route, `${what} after ending('${ending}'): use \`return ending(...)\``)
  }
  /** `options`: every answer possible here; `names`: the label of each, for the chart. */
  const answer = (kind: Branch['kind'], options: Answer[], names: string[]): Answer => {
    ended(`${kind}('${names[0]}')`)
    if (t.answers.length >= MAX_BRANCHES_PER_RUN) {
      throw new RouteError(
        route,
        `more than ${MAX_BRANCHES_PER_RUN} branches in one way through the route (a loop?)`,
      )
    }
    const given = forced[t.answers.length]
    const value = given !== undefined && options.includes(given) ? given : (options[0] as Answer)
    const order = options.indexOf(value)
    t.answers.push(value)
    t.answerAt.push(t.nodes.length)
    t.options.push(options)
    t.branches.push({ kind, name: names[order] ?? names[0] ?? '', value, order })
    return value
  }
  // Yes is drawn left of no; false is tried first (the order of the dry runs doesn't matter).
  const yesNo = (kind: 'flag' | 'check', name: string) =>
    answer(kind, [false, true], [name, name]) as boolean
  const ctx: RouteContext = {
    event: async (event, named) => {
      const key = boxKeyOf(event, named)
      ended(`event('${event}', '${key}')`)
      if (!KEY_PATTERN.test(key)) {
        throw new RouteError(
          route,
          `key "${key}" of event('${event}'): use lowercase letters, digits and _`,
        )
      }
      if (seen.has(key)) {
        throw new RouteError(
          route,
          `key "${key}" comes twice on one way through the route (a loop?)`,
        )
      }
      seen.add(key)
      t.nodes.push(key)
      t.chapterAt.push(chapter)
      t.events.push({ key, event })
      t.movies.push([])
    },
    flag: (id) => yesNo('flag', id),
    check: (label) => yesNo('check', label),
    choice: async (options, ask) => {
      const keys = Object.keys(options)
      if (keys.length === 0) throw new RouteError(route, 'choice() needs at least one option')
      const labels = keys.map((k) => (options as Record<string, string>)[k] as string)
      // The choice is a box of its own: the player can pick it and load the game right there.
      const key = choiceKey(options as Record<string, string>, ask?.key)
      ended(`choice('${key}')`)
      if (seen.has(key)) {
        throw new RouteError(
          route,
          `two choices with the same options (${keys.join(', ')}) on one way: give one a key, ` +
            `choice(options, { key: 'name' })`,
        )
      }
      seen.add(key)
      t.nodes.push(key)
      t.chapterAt.push(chapter)
      const hidden = Object.entries(ask?.hidden ?? {}).filter(([k, v]) => keys.includes(k) && v)
      t.choices.push({
        key,
        ...(ask?.text ? { question: ask.text } : {}),
        options: labels,
        keys,
        ...(hidden.length
          ? { hidden: Object.fromEntries(hidden) as Record<string, HiddenOption> }
          : {}),
      })
      t.movies.push([])
      return answer('choice', keys, labels) as never
    },
    startRoute: (id) => {
      ended(`startRoute('${id}')`)
      next = id
      return routeEndMarker(id)
    },
    ending: (id) => {
      ended(`ending('${id}')`)
      ending = id
      return routeEndMarker(route)
    },
    chapter: (id) => {
      ended(`chapter('${id}')`)
      chapter = id
    },
    movie: async (id) => {
      ended(`movie('${id}')`)
      // Played before the next box.
      t.movies.at(-1)?.push(id)
    },
  }
  await run(ctx)
  // Movies after the last event are on the line into the route box / the end.
  t.nodes.push(next ? routeBox(next) : END)
  t.chapterAt.push(chapter)
  return t
}

/** The flowchart of one route. Throws RouteError for mistakes in the route file. */
export async function buildGraph(route: RouteId, run: Run): Promise<RouteGraph> {
  const traces: Trace[] = []
  const todo: Answer[][] = [[]]
  let truncated = false
  while (todo.length > 0) {
    if (traces.length >= MAX_DRY_RUNS) {
      truncated = true
      break
    }
    const forced = todo.pop() as Answer[]
    const t = await trace(route, run, forced)
    traces.push(t)
    // Every answer after the forced ones took its first option: try the others too.
    for (let i = t.answers.length - 1; i >= forced.length; i--) {
      for (const other of (t.options[i] ?? []).slice(1).reverse()) {
        todo.push([...t.answers.slice(0, i), other])
      }
    }
  }
  if (truncated && import.meta.env.DEV) {
    console.warn(
      `[routes] "${route}" has more than ${MAX_DRY_RUNS} ways through it: the flowchart shows ` +
        'only some. Split it into routes, or use fewer if-blocks one after another.',
    )
  }

  const nodes: Record<string, RouteNode> = { [START]: { kind: 'start', key: START } }
  const edges = new Map<string, RouteEdge>()
  const links = new Set<RouteId>()
  const chapters: Record<string, string[]> = {}
  for (const t of traces) {
    t.nodes.forEach((key, i) => {
      const c = t.chapterAt[i]
      if (!c) return
      const list = chapters[key] ?? []
      if (!list.includes(c)) list.push(c)
      chapters[key] = list
    })
    for (const { key, event } of t.events) {
      const existing = nodes[key]
      if (existing?.kind === 'event' && existing.event !== event) {
        throw new RouteError(
          route,
          `key "${key}" is used for both '${existing.event}' and '${event}': give each its own key`,
        )
      }
      nodes[key] = { kind: 'event', key, event }
    }
    for (const c of t.choices) nodes[c.key] = { kind: 'choice', ...c }
    const last = t.nodes.at(-1) as string
    if (last === END) nodes[END] = { kind: 'end', key: END }
    else {
      const to = last.slice('@route:'.length) as RouteId
      nodes[last] = { kind: 'route', key: last, route: to }
      links.add(to)
    }
    for (let i = 0; i + 1 < t.nodes.length; i++) {
      const from = t.nodes[i] as string
      const to = t.nodes[i + 1] as string
      const when = t.branches.filter((_, a) => t.answerAt[a] === i + 1)
      const movies = t.movies[i] ?? []
      const id = `${from}>${to}`
      const edge = edges.get(id) ?? { from, to, when: [], movies: [] }
      const sig = JSON.stringify(when)
      if (!edge.when.some((w) => JSON.stringify(w) === sig)) edge.when.push(when)
      for (const m of movies) if (!edge.movies.includes(m)) edge.movies.push(m)
      edges.set(id, edge)
    }
  }
  if (links.has(route)) throw new RouteError(route, 'it starts itself')
  return {
    route,
    nodes,
    edges: [...edges.values()],
    paths: traces.map(({ nodes, answers, answerAt }) => ({ nodes, answers, answerAt })),
    links: [...links].sort(),
    truncated,
    chapters,
  }
}

/**
 * Routes that lead back into themselves (common > anna > common): each such chain, or none.
 * `links` = route -> the routes it starts.
 */
export function routeCycles(links: Record<string, readonly string[]>): string[][] {
  const cycles: string[][] = []
  const done = new Set<string>()
  const visit = (id: string, chain: string[]) => {
    const at = chain.indexOf(id)
    if (at >= 0) {
      cycles.push([...chain.slice(at), id])
      return
    }
    if (done.has(id)) return
    for (const next of links[id] ?? []) visit(next, [...chain, id])
    done.add(id)
  }
  for (const id of Object.keys(links)) visit(id, [])
  return cycles
}
