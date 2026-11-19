import { describe, expect, it } from 'vitest'
import {
  addSolidObjects,
  cameraOffset,
  facingFrom,
  findPath,
  isSolid,
  moveBox,
  objectContains,
  tilesAround,
} from './grid'

//  #####
//  #...#
//  #.#.#
//  #...#
//  #####
const rows = ['#####', '#...#', '#.#.#', '#...#', '#####']
const gridFrom = (lines: string[]) => ({
  width: lines[0]?.length ?? 0,
  height: lines.length,
  solid: lines.flatMap((line) => [...line].map((c) => c === '#')),
})

describe('grid', () => {
  it('knows solid tiles; outside counts as solid', () => {
    const grid = gridFrom(rows)
    expect(isSolid(grid, 0, 0)).toBe(true)
    expect(isSolid(grid, 1, 1)).toBe(false)
    expect(isSolid(grid, 2, 2)).toBe(true)
    expect(isSolid(grid, -1, 2)).toBe(true) // outside
  })

  it('adds solid objects', () => {
    const grid = gridFrom(rows)
    addSolidObjects(grid, [{ at: { x: 1, y: 1 }, solid: true }, { at: { x: 3, y: 1 } }])
    expect(isSolid(grid, 1, 1)).toBe(true)
    expect(isSolid(grid, 3, 1)).toBe(false)
  })
})

describe('moveBox', () => {
  const grid = gridFrom(rows)
  const half = 0.35

  it('moves freely in open space', () => {
    expect(moveBox(grid, 1.5, 1.5, half, 1, 0)).toEqual({ x: 2.5, y: 1.5 })
  })

  it('stops flush against a wall', () => {
    const p = moveBox(grid, 1.5, 1.5, half, -1, 0) // wall at x 0
    expect(p.x).toBeCloseTo(1 + half)
    expect(p.y).toBe(1.5)
  })

  it('slides along a wall when moving diagonally', () => {
    const p = moveBox(grid, 1.5, 1.5, half, -0.5, 0.5)
    expect(p.x).toBeCloseTo(1 + half)
    expect(p.y).toBeCloseTo(2)
  })

  it('never ends inside a solid tile', () => {
    for (const [dx, dy] of [
      [0.9, 0.9],
      [3, 0],
      [0, 3],
      [-3, -3],
    ] as const) {
      const p = moveBox(grid, 1.5, 1.5, half, dx, dy)
      expect(isSolid(grid, Math.floor(p.x), Math.floor(p.y))).toBe(false)
    }
  })
})

describe('camera and facing', () => {
  it('centres maps smaller than the view', () => {
    expect(cameraOffset(50, 800, 400)).toBe(200)
  })

  it('follows and clamps on big maps', () => {
    expect(cameraOffset(100, 800, 2000)).toBe(0) // near the left edge
    expect(cameraOffset(1000, 800, 2000)).toBe(-600) // middle
    expect(cameraOffset(1950, 800, 2000)).toBe(-1200) // near the right edge
  })

  it('faces the dominant direction and keeps facing when still', () => {
    expect(facingFrom(1, 0.2, 'down')).toBe('right')
    expect(facingFrom(-0.1, -1, 'down')).toBe('up')
    expect(facingFrom(0, 0, 'left')).toBe('left')
  })

  it('finds the tile ahead and object hits', () => {
    expect(tilesAround(2.5, 3.5, 'up')).toEqual({ here: { x: 2, y: 3 }, ahead: { x: 2, y: 2 } })
    expect(objectContains({ at: { x: 4, y: 4 }, size: { w: 2, h: 1 } }, { x: 5, y: 4 })).toBe(true)
    expect(objectContains({ at: { x: 4, y: 4 } }, { x: 5, y: 4 })).toBe(false)
  })
})

describe('moveBox with rectangles and boxes', () => {
  const open = { width: 10, height: 10, solid: new Array(100).fill(false) }
  const npc = { x0: 5, y0: 4.75, x1: 5.5, y1: 5 }

  it('uses separate half width and height', () => {
    const wall = { ...open, solid: open.solid.map((_, i) => i % 10 === 6) } // column 6
    const next = moveBox(wall, 5.3, 5, { x: 0.25, y: 0.1 }, 0.6, 0)
    expect(next.x).toBeCloseTo(5.75)
  })

  it('stops at a box and slides along it', () => {
    const right = moveBox(open, 4, 4.9, { x: 0.25, y: 0.125 }, 0.8, 0, [npc])
    expect(right.x).toBeCloseTo(4.75)
    // Above the box: free to pass.
    expect(moveBox(open, 4, 4, { x: 0.25, y: 0.125 }, 2, 0, [npc]).x).toBeCloseTo(6)
    const down = moveBox(open, 5.25, 4.3, { x: 0.25, y: 0.125 }, 0, 0.5, [npc])
    expect(down.y).toBeCloseTo(4.625)
  })

  it('lets a box that already overlaps walk out', () => {
    expect(moveBox(open, 5.25, 4.9, { x: 0.25, y: 0.125 }, -1, 0, [npc]).x).toBeCloseTo(4.25)
  })
})

describe('findPath', () => {
  // 5×3, a wall in the middle column except the bottom row.
  //   . . # . .
  //   . . # . .
  //   . . . . .
  const solid = [false, false, true, false, false, false, false, true, false, false].concat([
    false,
    false,
    false,
    false,
    false,
  ])

  it('finds a shortest way around walls, merging straight runs', () => {
    const path = findPath(solid, 5, 3, { x: 0, y: 0 }, { x: 4, y: 0 }) ?? []
    const delta = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] } as const
    let x = 0
    let y = 0
    for (const step of path) {
      for (let i = 0; i < step.tiles; i++) {
        x += delta[step.facing][0]
        y += delta[step.facing][1]
        expect(solid[y * 5 + x], `walkable ${x},${y}`).toBe(false)
      }
    }
    expect({ x, y }).toEqual({ x: 4, y: 0 })
    expect(path.reduce((n, p) => n + p.tiles, 0)).toBe(8) // around the wall: shortest
    // Straight runs are merged: no two steps in a row go the same way.
    expect(path.every((p, i) => p.facing !== path[i - 1]?.facing)).toBe(true)
  })

  it('returns [] when already there, null when the target is solid or unreachable', () => {
    expect(findPath(solid, 5, 3, { x: 1, y: 1 }, { x: 1, y: 1 })).toEqual([])
    expect(findPath(solid, 5, 3, { x: 0, y: 0 }, { x: 2, y: 0 })).toBeNull()
    const walled = solid.map((s, i) => s || i % 5 === 2)
    expect(findPath(walled, 5, 3, { x: 0, y: 0 }, { x: 4, y: 0 })).toBeNull()
  })
})
