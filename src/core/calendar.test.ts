import { describe, expect, it } from 'vitest'
import { type CalendarConfig, dateMatches, dateOf, daysUntil, formatDate } from './calendar'

const calendar: CalendarConfig = {
  weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  months: [
    { name: 'Spring', days: 30 },
    { name: 'Summer', days: 30 },
    { name: 'Autumn', days: 30 },
    { name: 'Winter', days: 28 },
  ],
  start: { year: 1, month: 1, day: 29, weekday: 'Sat' },
  format: '{weekday}, {day} {month}, year {year}',
  dates: {},
}

describe('calendar', () => {
  it('counts days into months, years and weekdays from the start date', () => {
    expect(dateOf(0, calendar)).toMatchObject({ year: 1, month: 1, day: 29, weekday: 'Sat' })
    expect(dateOf(1, calendar)).toMatchObject({ month: 1, day: 30, weekday: 'Sun' })
    expect(dateOf(2, calendar)).toMatchObject({
      month: 2,
      monthName: 'Summer',
      day: 1,
      weekday: 'Mon',
    })
    // 118 days a year: day 29 of Spring again one year on.
    expect(dateOf(118, calendar)).toMatchObject({ year: 2, month: 1, day: 29 })
    expect(dateOf(89, calendar)).toMatchObject({ year: 1, month: 4, day: 28 })
    expect(dateOf(90, calendar)).toMatchObject({ year: 2, month: 1, day: 1 })
    expect(dateOf(-29, calendar)).toMatchObject({ year: 0, month: 4, day: 28, weekday: 'Fri' })
  })

  it('named dates: every field given must match', () => {
    const day = dateOf(2, calendar) // Mon 1 Summer, year 1
    expect(dateMatches({ month: 2, day: 1 }, day)).toBe(true)
    expect(dateMatches({ weekday: 'Mon' }, day)).toBe(true)
    expect(dateMatches({ weekday: 'Mon', month: 3 }, day)).toBe(false)
    expect(dateMatches({ day: 1, year: 2 }, day)).toBe(false)
    expect(dateMatches({ name: 'Nothing' }, day)).toBe(false)
  })

  it('daysUntil finds the next time, today included', () => {
    expect(daysUntil({ weekday: 'Sat' }, 0, calendar)).toBe(0)
    expect(daysUntil({ weekday: 'Mon' }, 0, calendar)).toBe(2)
    expect(daysUntil({ month: 1, day: 1 }, 0, calendar)).toBe(90)
    expect(daysUntil({ month: 9 }, 0, calendar)).toBe(-1)
  })

  it('formats with translated names', () => {
    expect(formatDate(dateOf(2, calendar), calendar.format)).toBe('Mon, 1 Summer, year 1')
    const pl = (text: string) => ({ Mon: 'pon.', Summer: 'lata' })[text] ?? text
    expect(formatDate(dateOf(2, calendar), '{weekday} {day} {month}', pl)).toBe('pon. 1 lata')
  })
})
