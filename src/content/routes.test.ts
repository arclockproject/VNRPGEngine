// Checks every route in src/content/routes/ (VN mode). New routes are covered automatically.
import { describe, expect, it } from 'vitest'
import type { FlowDefinition, RouteConfig, RouteId } from '@/core/define'
import { buildGraph, type RouteGraph, routeCycles } from '@/core/routes/graph'
import { eventLoaders, routeFlowLoaders, routeLoaders } from '@/generated/registry.gen'

type Loader<T> = () => Promise<{ default: T }>
const ids = Object.keys(routeLoaders) as RouteId[]
const graphs = new Map<RouteId, RouteGraph>()
const graphOf = async (id: RouteId) => {
  let graph = graphs.get(id)
  if (!graph) {
    const def = (await (routeLoaders as Record<string, Loader<RouteConfig>>)[id]?.())?.default
    if (!def) throw new Error(`no route ${id}`)
    graph = await buildGraph(id, def.run)
    graphs.set(id, graph)
  }
  return graph
}

it('has a common route (where a new game starts in VN mode)', () => {
  expect(ids).toContain('common')
})

describe.each(ids)('route "%s"', (id) => {
  it('builds its flowchart: known events, known routes, every way ends', async () => {
    const graph = await graphOf(id)
    expect(graph.truncated).toBe(false)
    for (const node of Object.values(graph.nodes)) {
      if (node.kind === 'event')
        expect(eventLoaders, `event ${node.event}`).toHaveProperty(node.event)
      if (node.kind === 'route') expect(ids, `route ${node.route}`).toContain(node.route)
    }
  })

  it('its flow.ts names only boxes of this route', async () => {
    const load = (routeFlowLoaders as Record<string, Loader<FlowDefinition>>)[id]
    if (!load) return
    const flow = (await load()).default
    expect(flow.route, 'defineFlow(<route id>) matches the folder').toBe(id)
    const keys = Object.keys((await graphOf(id)).nodes)
    for (const key of Object.keys(flow.nodes)) expect(keys, `box "${key}"`).toContain(key)
  })
})

it('no route leads back into itself (common > anna > common)', async () => {
  const links: Record<string, RouteId[]> = {}
  for (const id of ids) links[id] = (await graphOf(id)).links
  expect(routeCycles(links)).toEqual([])
})
