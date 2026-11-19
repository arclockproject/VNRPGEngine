import { describe, expect, it } from 'vitest'
import { hotEntry } from './hot.ts'

describe('hotEntry', () => {
  it('maps content entry files to kind + id', () => {
    expect(hotEntry('/p/src/content/maps/countryside/town/index.ts')).toEqual({
      kind: 'maps',
      id: 'countryside/town',
    })
    expect(hotEntry('/p/src/content/windows/shop/index.tsx?t=1')).toEqual({
      kind: 'windows',
      id: 'shop',
    })
    // Not hot-swappable: eager kinds and helper files.
    expect(hotEntry('/p/src/content/characters/anna/index.ts')).toBeNull()
    expect(hotEntry('/p/src/content/maps/countryside/town/town.gen.ts')).toBeNull()
    // An event written as one file (day1.vn -> day1.gen.ts).
    expect(hotEntry('/p/src/content/events/common/day1.gen.ts')).toEqual({
      kind: 'events',
      id: 'common/day1',
    })
    expect(hotEntry('/p/src/content/events/common/day1/index.gen.ts')).toEqual({
      kind: 'events',
      id: 'common/day1',
    })
  })
})
