// Dev start (see ./start.ts): finds the route box of the marked event, works out the way to it
// with the marker's answers (every box counted as seen), and plays it like a flowchart jump with the
// event running instantly up to the marker.
import modeConfig from '@/content/config/mode'
import { devStart as marker } from '@/generated/registry.gen'
import type { RouteId } from '../defs/routes'
import type { Game } from '../game'
import { armRush } from '../scene/replay'

/** Says why the dev start can't run, in the console and on screen; the game then starts normally. */
function fail(game: Game, message: string): false {
  console.error(`[dev start] ${marker?.at ?? ''}: ${message}`)
  game.toast(`Dev start: ${message.split('\n')[0]}`)
  return false
}

/** The route boxes that play `event`. */
async function boxesOf(game: Game, event: string): Promise<{ route: RouteId; key: string }[]> {
  const found: { route: RouteId; key: string }[] = []
  for (const id of game.routes.ids()) {
    try {
      const graph = await game.routes.graph(id)
      for (const node of Object.values(graph.nodes))
        if (node.kind === 'event' && node.event === event) found.push({ route: id, key: node.key })
    } catch {
      // a route with a mistake: its error is reported where its chart is worked out
    }
  }
  return found
}

/**
 * Called once when the game starts (src/boot.tsx). True when it took over (the box is loading);
 * false = start normally (no marker, not the dev server, or the marker can't be reached: says why).
 */
export async function runDevStart(game: Game): Promise<boolean> {
  const found = marker
  if (!import.meta.env.DEV || !found) return false
  if (!modeConfig.vnOnly)
    return fail(
      game,
      'it works for routes only: set vnOnly: true in src/content/config/mode.ts, or remove the marker',
    )
  let boxes = await boxesOf(game, found.event)
  if (found.box) boxes = boxes.filter(({ route, key }) => `${route}/${key}` === found.box)
  if (boxes.length === 0)
    return fail(
      game,
      found.box
        ? `"${found.event}" is not the scene of the box "${found.box}"`
        : `"${found.event}" is not the scene of any route box`,
    )
  if (boxes.length > 1)
    return fail(
      game,
      `"${found.event}" plays in ${boxes.length} boxes; name one: ${boxes.map((b) => `box ${b.route}/${b.key}`).join(', ')}`,
    )
  const { route, key } = boxes[0] as { route: RouteId; key: string }
  const way = await game.routes.devWay(route, key, found.way ?? [])
  if (typeof way === 'string') return fail(game, way)
  console.info(`[dev start] ${found.at}: ${route}/${key}`)
  armRush(found.event)
  await game.routes.playWay(way, key)
  return true
}
