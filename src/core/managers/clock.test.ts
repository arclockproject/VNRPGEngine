import { describe, expect, it } from 'vitest'
import { tintAt } from './clock'

describe('clock tints', () => {
  const tints = [
    { hour: 0, tint: '#000000', strength: 0.6 },
    { hour: 12, tint: '#ffffff', strength: 0 },
  ]
  it('blends between hours and wraps around midnight', () => {
    expect(tintAt(0, tints)).toEqual({ tint: '#000000', strength: 0.6 })
    expect(tintAt(6 * 60, tints)).toEqual({ tint: '#808080', strength: 0.3 })
    expect(tintAt(18 * 60, tints).strength).toBeCloseTo(0.3)
    expect(tintAt(24 * 60 + 12 * 60, tints)).toEqual({ tint: '#ffffff', strength: 0 })
    expect(tintAt(100, [])).toEqual({ tint: '#000000', strength: 0 })
  })
})

describe('calendar on the clock (src/content/config/clock.ts)', () => {
  it('knows the date, named dates and how far they are', async () => {
    const { clock } = await import('./clock')
    const { useGameStore } = await import('../stores/game')
    useGameStore.setState((s) => {
      s.clockMinutes = 8 * 60 // day 0
    })
    const first = clock.date()
    expect(first.index).toBe(0)
    expect(clock.date(7).weekday).toBe(first.weekday)
    expect(clock.dateLabel()).toContain(String(first.day))
    const until = clock.daysUntil('market_day')
    expect(until).toBeGreaterThanOrEqual(0)
    expect(clock.is('market_day', until)).toBe(true)
    useGameStore.setState((s) => {
      s.clockMinutes += until * 24 * 60
    })
    expect(clock.today().map((d) => d.id)).toContain('market_day')
  })
})
