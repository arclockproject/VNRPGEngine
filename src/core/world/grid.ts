// Pure map logic (no PixiJS): collision, camera. Positions are in tiles.
import type { Facing, MapObject, TilePos } from '../define'

export interface Grid {
  width: number
  height: number
  /** Row-major: index = y * width + x. */
  solid: boolean[]
}

/** Sprite objects (characters, animated sprites) can walk, so the World handles their collision. */
export const isActor = (object: MapObject) =>
  object.character !== undefined || object.sprite !== undefined

/** Placed between tiles (see MapObject.offset). */
export const hasOffset = (object: MapObject) => !!(object.offset?.x || object.offset?.y)

/** Where an object really is (top-left, in tiles): `at` plus its offset. */
export function objectPos(object: MapObject) {
  return { x: object.at.x + (object.offset?.x ?? 0), y: object.at.y + (object.offset?.y ?? 0) }
}

/**
 * Marks solid objects as blocked tiles (not actors: see isActor). Objects placed between tiles
 * block with a box instead (see offsetBoxes).
 */
export function addSolidObjects(grid: Grid, objects: MapObject[]) {
  for (const object of objects) {
    if (!object.solid || isActor(object) || hasOffset(object)) continue
    const { w, h } = object.size ?? { w: 1, h: 1 }
    for (let y = object.at.y; y < object.at.y + h; y++) {
      for (let x = object.at.x; x < object.at.x + w; x++) {
        if (x >= 0 && y >= 0 && x < grid.width && y < grid.height)
          grid.solid[y * grid.width + x] = true
      }
    }
  }
}

/** Collision boxes of solid, non-actor objects placed between tiles (their exact area). */
export function offsetBoxes(objects: readonly MapObject[]): Box[] {
  return objects.filter((o) => o.solid && !isActor(o) && hasOffset(o)).map(objectArea)
}

/** The exact area an object covers (in tiles), offset included. */
export function objectArea(object: MapObject): Box {
  const { x, y } = objectPos(object)
  const { w, h } = object.size ?? { w: 1, h: 1 }
  return { x0: x, y0: y, x1: x + w, y1: y + h }
}

/** Outside the map counts as solid. */
export function isSolid(grid: Grid, x: number, y: number) {
  if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) return true
  return grid.solid[y * grid.width + x] === true
}

const EPS = 1e-6

/** A solid rectangle in tiles (left/top inclusive, right/bottom exclusive), e.g. an NPC's feet. */
export interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** Half width / half height of a moving box, in tiles. A number = square. */
export type HalfSize = number | { x: number; y: number }

const halves = (half: HalfSize) =>
  typeof half === 'number' ? { hx: half, hy: half } : { hx: half.x, hy: half.y }

function boxHitsSolid(grid: Grid, x: number, y: number, hx: number, hy: number) {
  const x0 = Math.floor(x - hx)
  const x1 = Math.floor(x + hx - EPS)
  const y0 = Math.floor(y - hy)
  const y1 = Math.floor(y + hy - EPS)
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) if (isSolid(grid, tx, ty)) return true
  }
  return false
}

function overlaps(box: Box, x: number, y: number, hx: number, hy: number) {
  return x + hx > box.x0 && x - hx < box.x1 && y + hy > box.y0 && y - hy < box.y1
}

/**
 * Moves a box (centre x/y, half size) by dx/dy, sliding along solid tiles and `boxes`.
 * Each axis is resolved separately, so diagonal movement slides along walls.
 * Boxes it already overlaps are ignored, so it can always walk out of them.
 */
export function moveBox(
  grid: Grid,
  x: number,
  y: number,
  half: HalfSize,
  dx: number,
  dy: number,
  boxes: readonly Box[] = [],
) {
  const { hx, hy } = halves(half)
  const solidBoxes = boxes.filter((b) => !overlaps(b, x, y, hx, hy))
  const hits = (px: number, py: number) =>
    boxHitsSolid(grid, px, py, hx, hy) || solidBoxes.some((b) => overlaps(b, px, py, hx, hy))

  let nx = x + dx
  if (dx !== 0 && hits(nx, y)) {
    if (boxHitsSolid(grid, nx, y, hx, hy))
      nx = dx > 0 ? Math.floor(nx + hx) - hx - EPS : Math.floor(nx - hx) + 1 + hx + EPS
    for (const b of solidBoxes) {
      if (!overlaps(b, nx, y, hx, hy)) continue
      nx = dx > 0 ? Math.min(nx, b.x0 - hx - EPS) : Math.max(nx, b.x1 + hx + EPS)
    }
    if (hits(nx, y) || (dx > 0 ? nx < x : nx > x)) nx = x
  }
  let ny = y + dy
  if (dy !== 0 && hits(nx, ny)) {
    if (boxHitsSolid(grid, nx, ny, hx, hy))
      ny = dy > 0 ? Math.floor(ny + hy) - hy - EPS : Math.floor(ny - hy) + 1 + hy + EPS
    for (const b of solidBoxes) {
      if (!overlaps(b, nx, ny, hx, hy)) continue
      ny = dy > 0 ? Math.min(ny, b.y0 - hy - EPS) : Math.max(ny, b.y1 + hy + EPS)
    }
    if (hits(nx, ny) || (dy > 0 ? ny < y : ny > y)) ny = y
  }
  return { x: nx, y: ny }
}

/** Camera offset on one axis: centres small maps, otherwise follows and clamps to the edges. */
export function cameraOffset(target: number, view: number, mapSize: number) {
  if (mapSize <= view) return (view - mapSize) / 2
  return Math.min(0, Math.max(view - mapSize, view / 2 - target))
}

export function facingFrom(dx: number, dy: number, current: Facing): Facing {
  if (dx === 0 && dy === 0) return current
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left'
  return dy > 0 ? 'down' : 'up'
}

const STEP: Record<Facing, TilePos> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

/** The tile the player is standing on, and the one in front of them. */
export function tilesAround(x: number, y: number, facing: Facing) {
  const here = { x: Math.floor(x), y: Math.floor(y) }
  const step = STEP[facing]
  return { here, ahead: { x: here.x + step.x, y: here.y + step.y } }
}

export function objectContains(object: MapObject, tile: TilePos) {
  const { w, h } = object.size ?? { w: 1, h: 1 }
  return (
    tile.x >= object.at.x &&
    tile.x < object.at.x + w &&
    tile.y >= object.at.y &&
    tile.y < object.at.y + h
  )
}

/**
 * Shortest 4-way path between two tiles over walkable tiles (BFS), as walk steps that each go
 * straight ({ left: 3 }, { up: 2 }). `from` may be solid (an NPC standing on its own tile).
 * Null when `to` can't be reached.
 */
export function findPath(
  solid: readonly boolean[],
  width: number,
  height: number,
  from: TilePos,
  to: TilePos,
): { facing: Facing; tiles: number }[] | null {
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height
  if (!inside(to.x, to.y) || solid[to.y * width + to.x]) return null
  if (from.x === to.x && from.y === to.y) return []
  const start = from.y * width + from.x
  const goal = to.y * width + to.x
  const previous = new Map<number, number>([[start, -1]])
  const queue = [start]
  const dirs: [Facing, number, number][] = [
    ['up', 0, -1],
    ['down', 0, 1],
    ['left', -1, 0],
    ['right', 1, 0],
  ]
  while (queue.length > 0) {
    const cell = queue.shift() as number
    if (cell === goal) break
    const cx = cell % width
    const cy = Math.floor(cell / width)
    for (const [, dx, dy] of dirs) {
      const nx = cx + dx
      const ny = cy + dy
      const next = ny * width + nx
      if (!inside(nx, ny) || solid[next] || previous.has(next)) continue
      previous.set(next, cell)
      queue.push(next)
    }
  }
  if (!previous.has(goal)) return null
  // Walk back from the goal, then merge straight runs into one step each.
  const cells: number[] = []
  for (let c = goal; c !== -1; c = previous.get(c) ?? -1) cells.unshift(c)
  const steps: { facing: Facing; tiles: number }[] = []
  for (let i = 1; i < cells.length; i++) {
    const a = cells[i - 1] as number
    const b = cells[i] as number
    const facing: Facing =
      b === a - width ? 'up' : b === a + width ? 'down' : b === a - 1 ? 'left' : 'right'
    const last = steps[steps.length - 1]
    if (last?.facing === facing) last.tiles++
    else steps.push({ facing, tiles: 1 })
  }
  return steps
}

/** Whether a point (tiles) is inside any of the boxes. */
export function inBoxes(boxes: readonly Box[] | undefined, x: number, y: number) {
  return !!boxes?.some((b) => x >= b.x0 && x < b.x1 && y >= b.y0 && y < b.y1)
}
