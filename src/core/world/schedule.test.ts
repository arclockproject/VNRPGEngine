import { describe, expect, it } from 'vitest'
import { activeEntry, parseTime } from './schedule'

const at = { x: 0, y: 0 }
const day = [
  { from: '8', at },
  { from: '13:30', at },
  { from: 22, hidden: true },
]

describe('schedules', () => {
  it('parse times', () => {
    expect(parseTime('8')).toBe(480)
    expect(parseTime('08:30')).toBe(510)
    expect(parseTime(13.5)).toBe(810)
    expect(() => parseTime('25:00')).toThrow()
    expect(() => parseTime('noon')).toThrow()
  })

  it('pick the latest entry that has started, wrapping over midnight', () => {
    expect(activeEntry(day, 8 * 60)).toBe(0)
    expect(activeEntry(day, 13 * 60 + 29)).toBe(0)
    expect(activeEntry(day, 13 * 60 + 30)).toBe(1)
    expect(activeEntry(day, 23 * 60)).toBe(2)
    expect(activeEntry(day, 3 * 60)).toBe(2) // still last night's entry
    expect(activeEntry(day, 3 * 24 * 60 + 9 * 60)).toBe(0) // any day
    expect(activeEntry([], 0)).toBe(-1)
  })
})
