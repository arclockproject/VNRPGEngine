import { describe, expect, it } from 'vitest'
import { minimapView } from './minimapView'

describe('minimapView', () => {
  it('shows the whole map when radius is 0 or the map is small', () => {
    expect(minimapView(32, 18, { x: 5, y: 5 }, 128, 0)).toMatchObject({
      x: 0,
      y: 0,
      w: 32,
      h: 18,
      scale: 4,
      width: 128,
      height: 72,
    })
    expect(minimapView(10, 8, { x: 9, y: 7 }, 100, 12)).toMatchObject({ x: 0, y: 0, w: 10, h: 8 })
  })

  it('follows the player on a big map and stops at the edges', () => {
    const middle = minimapView(100, 100, { x: 50.5, y: 40 }, 120, 12)
    expect(middle).toMatchObject({ x: 38.5, y: 28, w: 24, h: 24, scale: 5 })
    expect(minimapView(100, 100, { x: 2, y: 99 }, 120, 12)).toMatchObject({ x: 0, y: 76 })
  })
})
