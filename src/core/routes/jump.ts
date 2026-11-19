// Flowchart jumps (VN style): which way leads to a picked box. Any way made only of boxes the
// player has seen can be loaded, even if that exact run was never played, but never through a
// dotted line: every choice on the way must use an option the player picked live. Where ways join, the
// box the player picked most recently in the chart wins, then the one played most recently.
import type { RouteId } from '../defs/routes'
import { type Answer, optionKey, type RouteGraph, type RoutePath, routeBox, START } from './graph'

/** When a box was seen / picked (0 = never). */
export interface Marks {
  seenAt: (route: RouteId, key: string) => number
  pickedAt: (route: RouteId, key: string) => number
}

/** A way to a box in one route: its boxes (START first, the box last) and the answers on the way. */
export interface Way {
  route: RouteId
  nodes: string[]
  /** The flag() / check() answers asked before the box (the route's own order). */
  answers: Answer[]
}

/** The newest of the two marks wins; picking in the chart beats playing. */
const rank = (marks: Marks, route: RouteId, key: string): [number, number] => [
  marks.pickedAt(route, key),
  marks.seenAt(route, key),
]
const better = (a: [number, number], b: [number, number]) => a[0] - b[0] || a[1] - b[1]

/**
 * The way to `target` the flowchart would load, or null when no way of seen boxes (and choice
 * options picked live: solid lines only) reaches it.
 * `target` itself must be seen (or be a route box / END reached from seen boxes).
 */
export function wayTo(graph: RouteGraph, target: string, marks: Marks): Way | null {
  const route = graph.route
  const seen = (key: string) => key === START || marks.seenAt(route, key) > 0
  /** Every choice before the box was answered with an option picked live (no dotted line). */
  const picked = (path: RoutePath, at: number) =>
    path.answers.every((answer, a) => {
      const after = path.answerAt[a] as number
      if (after > at || typeof answer !== 'string') return true
      const box = path.nodes[after - 1] as string
      return marks.seenAt(route, optionKey(box, answer)) > 0
    })
  let ways = graph.paths
    .map((path) => ({ path, at: path.nodes.indexOf(target) }))
    .filter(({ path, at }) => at > 0 && path.nodes.slice(1, at + 1).every(seen))
    .filter(({ path, at }) => picked(path, at))
  if (ways.length === 0) return null
  // Walk back from the box: at each step keep the ways through the best previous box.
  for (let back = 1; ; back++) {
    const before = new Set(ways.map(({ path, at }) => path.nodes[at - back]).filter(Boolean))
    if (before.size <= 1) {
      if ([...before][0] === undefined || [...before][0] === START) break
      continue
    }
    const best = [...before].sort((a, b) =>
      better(rank(marks, route, b as string), rank(marks, route, a as string)),
    )[0]
    ways = ways.filter(({ path, at }) => path.nodes[at - back] === best)
  }
  // Ways that only differ in length before the start (none) or in answers: take the first.
  const { path, at } = ways[0] as (typeof ways)[number]
  return {
    route,
    nodes: path.nodes.slice(0, at + 1),
    answers: path.answers.filter((_, a) => (path.answerAt[a] as number) <= at),
  }
}

/** Where a story starts: the common route and every after story. */
const MAIN_ROOTS: ReadonlySet<RouteId> = new Set(['common' as RouteId])

/**
 * The routes to go through to reach `target` (a root first, `target` last), each entered through a
 * route box the player has seen. `roots` = the routes a story starts from (common, after stories).
 * Null when there is no such chain.
 */
export function routeChain(
  target: RouteId,
  graphs: ReadonlyMap<RouteId, RouteGraph>,
  marks: Marks,
  roots: ReadonlySet<RouteId> = MAIN_ROOTS,
): RouteId[] | null {
  const chain: RouteId[] = [target]
  let at = target
  while (!roots.has(at)) {
    const parents = [...graphs.values()]
      .filter((g) => g.links.includes(at) && !chain.includes(g.route))
      .filter((g) => marks.seenAt(g.route, routeBox(at)) > 0)
      .sort((a, b) =>
        better(rank(marks, b.route, routeBox(at)), rank(marks, a.route, routeBox(at))),
      )
    const parent = parents[0]
    if (!parent) return null
    chain.unshift(parent.route)
    at = parent.route
  }
  return chain
}

/** Every way needed to load `key` of `route`: the ways to each route box first, then to the box. */
export function jumpPlan(
  route: RouteId,
  key: string,
  graphs: ReadonlyMap<RouteId, RouteGraph>,
  marks: Marks,
  roots: ReadonlySet<RouteId> = MAIN_ROOTS,
): Way[] | null {
  const chain = routeChain(route, graphs, marks, roots)
  if (!chain) return null
  const ways: Way[] = []
  for (let i = 0; i < chain.length; i++) {
    const id = chain[i] as RouteId
    const graph = graphs.get(id)
    const next = chain[i + 1]
    const way = graph && wayTo(graph, next ? routeBox(next) : key, marks)
    if (!way) return null
    ways.push(way)
  }
  return ways
}

/** An answer as the marker writes it: "option text", yes, no. */
const answerText = (answer: Answer) =>
  typeof answer === 'string' ? `"${answer}"` : answer ? 'yes' : 'no'

/**
 * Dev start (@start / devStart()): the way to `key` of `route` that the given `answers` name (the
 * route's choice options and flag / check answers on the way, in the order they are asked, from the
 * first route on). Every box counts as seen. Where several ways lead there the answers must say
 * which: a message listing them comes back instead (a string), never a guess.
 */
export function devWayPlan(
  route: RouteId,
  key: string,
  graphs: ReadonlyMap<RouteId, RouteGraph>,
  answers: readonly Answer[],
  roots: ReadonlySet<RouteId> = MAIN_ROOTS,
): Way[] | string {
  const everySeen: Marks = { seenAt: () => 1, pickedAt: () => 0 }
  const chain = routeChain(route, graphs, everySeen, roots)
  if (!chain) return `no route leads to "${route}" from ${[...roots].join(', ')}`
  const ways: Way[] = []
  let rest = [...answers]
  const given = (count: number) => answers.slice(0, answers.length - rest.length + count)
  for (let i = 0; i < chain.length; i++) {
    const id = chain[i] as RouteId
    const graph = graphs.get(id)
    if (!graph) return `route "${id}" could not be worked out (see its error)`
    const next = chain[i + 1]
    const target = next ? routeBox(next) : key
    // Each different list of answers on a way to the box (ways that only differ after it are one).
    const options = new Map<string, { path: RoutePath; at: number; answers: Answer[] }>()
    for (const path of graph.paths) {
      const at = path.nodes.indexOf(target)
      if (at <= 0) continue
      const list = path.answers.filter((_, a) => (path.answerAt[a] as number) <= at)
      const sig = JSON.stringify(list)
      if (!options.has(sig)) options.set(sig, { path, at, answers: list })
    }
    const all = [...options.values()]
    if (all.length === 0) return `no way reaches "${id}/${target}"`
    const covered = (list: Answer[]) =>
      list.length <= rest.length && list.every((answer, j) => answer === rest[j])
    let pick: (typeof all)[number] | undefined
    if (all.length === 1) pick = all[0]
    else
      pick = all
        .filter((o) => covered(o.answers))
        .sort((a, b) => b.answers.length - a.answers.length)[0]
    if (!pick) {
      const list = all
        .map((o) => [...given(0), ...o.answers].map(answerText).join(' ') || '(no answers)')
        .map((line) => `  @start ${line}`)
        .join('\n')
      return `"${id}/${target}" can be reached ${all.length} ways: name one with the route's answers on the way:\n${list}`
    }
    if (covered(pick.answers)) rest = rest.slice(pick.answers.length)
    ways.push({ route: id, nodes: pick.path.nodes.slice(0, pick.at + 1), answers: pick.answers })
  }
  if (rest.length > 0)
    return `more answers than the way to "${route}/${key}" asks: ${rest.map(answerText).join(' ')}`
  return ways
}
