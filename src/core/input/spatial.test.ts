import { describe, expect, it } from 'vitest'
import { pickInDirection, type Rect } from './spatial'

const r = (left: number, top: number): Rect => ({ left, top, width: 10, height: 10 })

describe('pickInDirection', () => {
  // A grid:  a b
  //          c d
  const a = r(0, 0)
  const b = r(100, 0)
  const c = r(0, 100)
  const d = r(100, 100)

  it('moves along rows and columns', () => {
    expect(pickInDirection(a, [b, c, d], 'right')).toBe(0)
    expect(pickInDirection(a, [b, c, d], 'down')).toBe(1)
    expect(pickInDirection(d, [a, b, c], 'up')).toBe(1)
    expect(pickInDirection(d, [a, b, c], 'left')).toBe(2)
  })

  it('returns -1 at the edge', () => {
    expect(pickInDirection(a, [b, c, d], 'up')).toBe(-1)
    expect(pickInDirection(a, [b, c, d], 'left')).toBe(-1)
  })

  it('prefers aligned items over slightly closer diagonal ones', () => {
    const aligned = r(0, 120)
    const diagonal = r(80, 90)
    expect(pickInDirection(a, [diagonal, aligned], 'down')).toBe(1)
  })

  it('reaches a short last row from a column that has nothing below it', () => {
    // x y z
    // w
    const z = r(200, 0)
    const w = r(0, 100)
    expect(pickInDirection(z, [r(0, 0), r(100, 0), w], 'down')).toBe(2)
  })
})
