// What the flowchart draws, worked out from a route graph: the boxes, plus a DIAMOND for every
// flag() / check() the story passes between two boxes (a diamond = "not a choice:
// depends on a flag / an earlier choice"). Only for drawing: the runner, saves and jumps
// keep using the route graph. Pure: no React, no DOM.
import { type Answer, type Branch, type RouteGraph, START } from './graph'

export interface ChartBranch {
  /**
   * "!<box>" for the first diamond after a box, "!<box>:<answers>" for one further on (e.g.
   * "!a:false" = after a "no"). Never clashes with a box key; flow.ts can use it.
   */
  key: string
  /** The first diamond after its box (passed whenever the box is). */
  root: boolean
  /** The box the story was in before this diamond. */
  owner: string
  kind: 'flag' | 'check'
  /** The flag id or the check's label. */
  name: string
  /** Every box a line from this diamond can lead to (through further diamonds too). */
  leaves: string[]
}

export interface ChartEdge {
  from: string
  to: string
  /** Left to right among the lines leaving `from`. */
  order: number
  /** Kept in one straight column (into a diamond, and the "no" way through it). */
  straight: boolean
  /** The "yes" way out of a diamond: leaves from its side, then turns down. */
  side: boolean
  /** Answers taken on this line (choice options leaving a choice box; yes / no leaving a diamond). */
  values: Answer[]
  /** The choice option texts (lines leaving a choice box). */
  labels: string[]
  /** The route-graph lines ("from>to") drawn through this line (to light up the way). */
  pairs: string[]
}

export interface ChartGraph {
  /** Boxes (route-graph keys, START included) and diamond keys. */
  keys: string[]
  edges: ChartEdge[]
  branches: Record<string, ChartBranch>
}

export interface ChartOptions {
  /** Boxes left out (flow.ts `hidden`). */
  hidden?: ReadonlySet<string>
  /** Diamonds for flag() / check(), with the "yes" way going to this side; null = no diamonds. */
  branchSide?: 'left' | 'right' | null
}

interface Leaf {
  to: string
  pairs: Set<string>
}
interface Split {
  kind: Branch['kind']
  name: string
  children: Map<string, { branch: Branch; node: Tree }>
}
type Tree = Leaf | Split

const isLeaf = (t: Tree): t is Leaf => 'to' in t
const CONFLICT = new Error('conflict')

/** Adds one way (its answers between the two boxes) to the tree of a box's lines. */
function add(node: Tree | undefined, seq: readonly Branch[], to: string, pair: string): Tree {
  const [b, ...rest] = seq
  if (!b) {
    if (!node) return { to, pairs: new Set([pair]) }
    if (isLeaf(node) && node.to === to) {
      node.pairs.add(pair)
      return node
    }
    // Earlier answers (before the box) decide: no diamond can show that.
    throw CONFLICT
  }
  const name = b.kind === 'choice' ? '' : b.name
  const split: Tree = node ?? { kind: b.kind, name, children: new Map() }
  if (isLeaf(split) || split.kind !== b.kind || split.name !== name) throw CONFLICT
  const id = JSON.stringify(b.value)
  const child = split.children.get(id)
  split.children.set(id, { branch: child?.branch ?? b, node: add(child?.node, rest, to, pair) })
  return split
}

/** Diamonds that don't split anything (one way out, or every way to the same box) go away. */
function collapse(node: Tree): Tree {
  if (isLeaf(node)) return node
  for (const [id, c] of node.children) node.children.set(id, { ...c, node: collapse(c.node) })
  if (node.kind === 'choice') return node
  const kids = [...node.children.values()].map((c) => c.node)
  if (kids.length === 1) return kids[0] as Tree
  const first = kids[0] as Tree
  if (kids.every((k) => isLeaf(k) && isLeaf(first) && k.to === first.to)) {
    const pairs = new Set<string>()
    for (const k of kids) for (const p of (k as Leaf).pairs) pairs.add(p)
    return { to: (first as Leaf).to, pairs }
  }
  return node
}

const leavesOf = (t: Tree): Leaf[] =>
  isLeaf(t) ? [t] : [...t.children.values()].flatMap((c) => leavesOf(c.node))

/** Left to right: yes before no, choice options in the order they are written. */
const plainOrder = (b: Branch | undefined) =>
  !b ? 0 : b.kind === 'choice' ? b.order : b.value === true ? 0 : 1

export function chartGraph(graph: RouteGraph, options: ChartOptions = {}): ChartGraph {
  const hidden = options.hidden ?? new Set<string>()
  const side = options.branchSide ?? null
  const keys = Object.keys(graph.nodes).filter((k) => !hidden.has(k))
  const branches: Record<string, ChartBranch> = {}
  const edges = new Map<string, ChartEdge>()
  const push = (e: ChartEdge) => {
    const id = `${e.from}>${e.to}`
    const old = edges.get(id)
    if (!old) {
      edges.set(id, e)
      return
    }
    for (const v of e.values) if (!old.values.includes(v)) old.values.push(v)
    for (const l of e.labels) if (!old.labels.includes(l)) old.labels.push(l)
    for (const p of e.pairs) if (!old.pairs.includes(p)) old.pairs.push(p)
    old.order = Math.min(old.order, e.order)
  }

  const shown = graph.edges.filter((e) => !hidden.has(e.from) && !hidden.has(e.to))
  const byFrom = new Map<string, typeof shown>()
  for (const e of shown) byFrom.set(e.from, [...(byFrom.get(e.from) ?? []), e])

  const plain = (list: typeof shown) => {
    for (const e of list) {
      const choices = e.when.flatMap((w) => w.filter((b) => b.kind === 'choice'))
      push({
        from: e.from,
        to: e.to,
        order: Math.min(...e.when.map((w) => plainOrder(w[0]))),
        straight: false,
        side: false,
        values: choices.map((b) => b.value),
        labels: choices.map((b) => b.name),
        pairs: [`${e.from}>${e.to}`],
      })
    }
  }

  for (const [from, list] of byFrom) {
    if (!side || from === START) {
      plain(list)
      continue
    }
    let tree: Tree | undefined
    try {
      for (const e of list) {
        for (const w of e.when) tree = add(tree, w, e.to, `${e.from}>${e.to}`)
      }
    } catch (err) {
      if (err !== CONFLICT) throw err
      plain(list)
      continue
    }
    if (!tree) continue
    tree = collapse(tree)
    // `at` = where the line starts (the box or a diamond); `path` = answers since the box.
    const emit = (at: string, node: Tree, path: string[]) => {
      if (isLeaf(node)) return
      const diamond = node.kind !== 'choice'
      for (const { branch, node: child } of node.children.values()) {
        const yes = branch.value === true
        const order = !diamond ? branch.order : yes ? (side === 'left' ? 0 : 2) : 1
        const base = {
          from: at,
          order,
          straight: diamond && !yes,
          side: diamond && yes,
          values: [branch.value],
          labels: diamond ? [] : [branch.name],
        }
        if (isLeaf(child)) {
          push({ ...base, to: child.to, pairs: [...child.pairs] })
          continue
        }
        const key = into(child, [...path, String(branch.value)])
        push({ ...base, to: key, pairs: leavesOf(child).flatMap((l) => [...l.pairs]) })
      }
    }
    const into = (node: Split, path: string[]): string => {
      const key = path.length ? `!${from}:${path.join(',')}` : `!${from}`
      branches[key] = {
        key,
        owner: from,
        root: path.length === 0,
        kind: node.kind as 'flag' | 'check',
        name: node.name,
        leaves: [...new Set(leavesOf(node).map((l) => l.to))],
      }
      keys.push(key)
      emit(key, node, path)
      return key
    }
    if (isLeaf(tree)) {
      push({
        from,
        to: tree.to,
        order: 0,
        straight: false,
        side: false,
        values: [],
        labels: [],
        pairs: [...tree.pairs],
      })
    } else if (tree.kind === 'choice') emit(from, tree, [])
    else {
      const key = into(tree, [])
      push({
        from,
        to: key,
        order: 0,
        straight: true,
        side: false,
        values: [],
        labels: [],
        pairs: leavesOf(tree).flatMap((l) => [...l.pairs]),
      })
    }
  }
  return { keys, edges: [...edges.values()], branches }
}
