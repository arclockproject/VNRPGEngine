import { describe, expect, it } from 'vitest'
import type { RouteContext, RouteId } from '../defs/routes'
import { buildGraph } from './graph'
import { layoutGraph } from './layout'

type Loose = {
  event: (id: string, key: string) => Promise<void>
  flag: (id: string) => boolean
  startRoute: (id: string) => ReturnType<RouteContext['startRoute']>
}
const build = (run: (r: Loose) => unknown) =>
  buildGraph('common' as RouteId, run as (ctx: RouteContext) => unknown)
const sizes = { width: 100, height: 40, gapX: 20, gapY: 30 }

const example = () =>
  build(async ({ event, flag, startRoute }) => {
    await event('x/a', 'a')
    await event('x/d', 'd')
    if (flag('agreed')) await event('x/e', 'e')
    else await event('x/f', 'f')
    if (flag('anna')) await event('x/g', 'g')
    await event('x/h', 'h')
    return startRoute('anna')
  })

describe('layoutGraph', () => {
  it('puts each box one row below the furthest box leading to it', async () => {
    const layout = layoutGraph(await example(), sizes)
    const y = Object.fromEntries(layout.boxes.map((b) => [b.key, b.y / 70]))
    expect(y).toMatchObject({ a: 0, d: 1, e: 2, f: 2, g: 3, h: 4, '@route:anna': 5 })
  })

  it('reads yes before no, never overlaps boxes, and keeps a straight line straight', async () => {
    const layout = layoutGraph(await example(), sizes)
    const box = (k: string) => layout.boxes.find((b) => b.key === k) as { x: number; y: number }
    expect(box('e').x).toBeLessThan(box('f').x)
    expect(box('a').x).toBe(box('d').x)
    for (const a of layout.boxes) {
      for (const b of layout.boxes) {
        if (a !== b && a.y === b.y) expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(120)
      }
    }
  })

  it('a line that skips a row goes through a place holder, not through the box on that row', async () => {
    const layout = layoutGraph(await example(), sizes)
    const g = layout.boxes.find((b) => b.key === 'g') as { x: number; y: number }
    for (const line of layout.lines.filter((l) => l.to === 'h' && l.from !== 'g')) {
      expect(line.points).toHaveLength(3)
      const [hx] = line.points[1] as [number, number]
      expect(hx < g.x || hx > g.x + sizes.width).toBe(true)
    }
  })

  it('centres a box over its two branches, and two lines from one box start apart', async () => {
    const layout = layoutGraph(await example(), sizes)
    const box = (k: string) => layout.boxes.find((b) => b.key === k) as { x: number; y: number }
    expect(box('d').x).toBeCloseTo((box('e').x + box('f').x) / 2)
    const starts = layout.lines.filter((l) => l.from === 'd').map((l) => l.points[0]?.[0])
    expect(starts).toHaveLength(2)
    expect(starts[0]).not.toBe(starts[1])
    // Lines into h end at different points too.
    const ends = layout.lines.filter((l) => l.to === 'h').map((l) => l.points.at(-1)?.[0])
    expect(new Set(ends).size).toBe(ends.length)
  })

  it('leaves hidden boxes and their lines out', async () => {
    const layout = layoutGraph(await example(), sizes, new Set(['g']))
    expect(layout.boxes.map((b) => b.key)).not.toContain('g')
    expect(layout.lines.some((l) => l.from === 'g' || l.to === 'g')).toBe(false)
  })
})
