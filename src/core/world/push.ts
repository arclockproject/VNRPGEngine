// Pure rules for pushing objects and jumping over gaps on the map (the World does the moving).
import type { Facing, TilePos } from '../define'
import type { TerrainKind } from '../terrain'
import type { Box } from './grid'

const STEP: Record<Facing, TilePos> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

/** `area` moved one tile in a direction. */
export function shifted(area: Box, facing: Facing): Box {
  const step = STEP[facing]
  return {
    x0: area.x0 + step.x,
    y0: area.y0 + step.y,
    x1: area.x1 + step.x,
    y1: area.y1 + step.y,
  }
}

/**
 * Can an object standing on `own` (whole tiles) not be pushed onto `dest`? Blocked by the map
 * edge, by solid cells (`blocked`, row-major; the object's own cells don't count) and by any
 * other collision box that reaches into `dest`.
 */
export function pushBlocked(
  dest: Box,
  own: Box,
  size: { width: number; height: number },
  blocked: readonly boolean[],
  others: readonly Box[],
): boolean {
  for (let y = Math.floor(dest.y0); y < Math.ceil(dest.y1); y++)
    for (let x = Math.floor(dest.x0); x < Math.ceil(dest.x1); x++) {
      if (x < 0 || y < 0 || x >= size.width || y >= size.height) return true
      const mine = x >= own.x0 && x < own.x1 && y >= own.y0 && y < own.y1
      if (!mine && blocked[y * size.width + x]) return true
    }
  const e = 0.01
  return others.some(
    (b) => b.x1 > dest.x0 + e && b.x0 < dest.x1 - e && b.y1 > dest.y0 + e && b.y0 < dest.y1 - e,
  )
}

/**
 * Where a jump from tile `from` lands: the tile after the one in front, when the one in front is
 * jumpable ground (terrain `jump`: true = from any side, a direction = only moving that way) and
 * the landing tile is free. Null = no jump.
 */
export function jumpLanding(
  from: TilePos,
  facing: Facing,
  size: { width: number; height: number },
  blocked: readonly boolean[],
  terrainAt: (x: number, y: number) => TerrainKind | undefined,
): TilePos | null {
  const step = STEP[facing]
  const gap = { x: from.x + step.x, y: from.y + step.y }
  const jump = terrainAt(gap.x, gap.y)?.jump
  if (!jump || (jump !== true && jump !== facing)) return null
  const land = { x: gap.x + step.x, y: gap.y + step.y }
  if (land.x < 0 || land.y < 0 || land.x >= size.width || land.y >= size.height) return null
  return blocked[land.y * size.width + land.x] ? null : land
}

/** Height of a hop at `t` (0..1): 0 at both ends, 1 in the middle. */
export const hopArc = (t: number) => 4 * t * (1 - t)
