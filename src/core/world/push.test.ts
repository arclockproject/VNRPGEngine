import { describe, expect, it } from 'vitest'
import { hopArc, jumpLanding, pushBlocked, shifted } from './push'

const size = { width: 4, height: 3 }
// . . # .
// . . . .
// . . . .
const blocked = [false, false, true, false, false, false, false, false, false, false, false, false]
const tile = (x: number, y: number) => ({ x0: x, y0: y, x1: x + 1, y1: y + 1 })

describe('pushing', () => {
  it('moves one tile in a direction', () => {
    expect(shifted(tile(1, 1), 'left')).toEqual(tile(0, 1))
    expect(shifted(tile(1, 1), 'down')).toEqual(tile(1, 2))
  })

  it('is stopped by walls, the map edge and other objects', () => {
    expect(pushBlocked(tile(2, 1), tile(1, 1), size, blocked, [])).toBe(false)
    expect(pushBlocked(tile(2, 0), tile(1, 0), size, blocked, [])).toBe(true) // wall
    expect(pushBlocked(tile(-1, 1), tile(0, 1), size, blocked, [])).toBe(true) // edge
    expect(pushBlocked(tile(1, 3), tile(1, 2), size, blocked, [])).toBe(true) // edge
    // Another object's collision box (just its bottom half) in the way.
    expect(
      pushBlocked(tile(2, 1), tile(1, 1), size, blocked, [{ x0: 2.1, y0: 1.5, x1: 2.9, y1: 2 }]),
    ).toBe(true)
    // A box that only touches the edge is not in the way.
    expect(pushBlocked(tile(2, 1), tile(1, 1), size, blocked, [tile(3, 1)])).toBe(false)
  })

  it('its own solid cells do not block it (a two-tile crate sliding along)', () => {
    const own = { x0: 0, y0: 1, x1: 2, y1: 2 }
    const solidWithOwn = blocked.slice()
    solidWithOwn[4] = solidWithOwn[5] = true
    expect(pushBlocked(shifted(own, 'right'), own, size, solidWithOwn, [])).toBe(false)
  })
})

describe('jumping', () => {
  const gapAt = (gx: number, gy: number, jump: true | 'down') => (x: number, y: number) =>
    x === gx && y === gy ? { jump } : undefined

  it('lands two tiles on when the tile between is jumpable and the landing is free', () => {
    expect(jumpLanding({ x: 0, y: 1 }, 'right', size, blocked, gapAt(1, 1, true))).toEqual({
      x: 2,
      y: 1,
    })
    expect(jumpLanding({ x: 0, y: 1 }, 'right', size, blocked, () => undefined)).toBeNull()
    // Landing in a wall or outside the map: no jump.
    expect(jumpLanding({ x: 0, y: 0 }, 'right', size, blocked, gapAt(1, 0, true))).toBeNull()
    expect(jumpLanding({ x: 2, y: 1 }, 'right', size, blocked, gapAt(3, 1, true))).toBeNull()
  })

  it('a ledge is one-way', () => {
    expect(jumpLanding({ x: 1, y: 0 }, 'down', size, blocked, gapAt(1, 1, 'down'))).toEqual({
      x: 1,
      y: 2,
    })
    expect(jumpLanding({ x: 1, y: 2 }, 'up', size, blocked, gapAt(1, 1, 'down'))).toBeNull()
  })

  it('the hop is an arc', () => {
    expect([hopArc(0), hopArc(0.5), hopArc(1)]).toEqual([0, 1, 0])
  })
})
