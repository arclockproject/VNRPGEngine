// The calendar on top of the clock: weekdays, months, years and named dates. Pure (no stores),
// types for the `calendar` part of src/content/config/clock.ts. Must not import content.
import type { ContentIds } from '@/generated/registry.gen'

export interface CalendarMonth {
  name: string
  days: number
}

/** A day (or days) with a name: a holiday, market day, a birthday. Every field given must match. */
export interface NamedDate {
  /** Shown to the player (game.clock.today()). */
  name?: string
  /** Month by number, 1 = the first month. */
  month?: number
  /** Day of the month, 1 = the first. */
  day?: number
  /** A name from `weekdays`. */
  weekday?: string
  /** Only in this year. */
  year?: number
  /**
   * An event started by itself on such a day, once, as soon as the player is free on a map
   * (after `hour` if given).
   */
  event?: ContentIds['events']
  /** With `event`: not before this hour (0..23). */
  hour?: number
}

export interface CalendarConfig<W extends string = string, D extends string = string> {
  /** In order; the game's first day is `start.weekday`. */
  weekdays: readonly W[]
  /** In order. A year is all of them. */
  months: readonly CalendarMonth[]
  /** The date of a new game's first day. */
  start: { year: number; month: number; day: number; weekday: NoInfer<W> }
  /** How game.clock.dateLabel() writes a date: {weekday} {day} {month} {monthNumber} {year}. */
  format: string
  /** Named dates by id: game.clock.is('festival'). */
  dates: Record<D, NamedDate & { weekday?: NoInfer<W> }>
}

/** A calendar date. */
export interface GameDate {
  /** Days since the game began (0 = the first day). */
  index: number
  year: number
  /** 1 = the first month. */
  month: number
  monthName: string
  /** 1 = the first day of the month. */
  day: number
  weekday: string
  /** 0 = the first entry of `weekdays`. */
  weekdayIndex: number
}

const yearLength = (calendar: CalendarConfig) =>
  Math.max(
    1,
    calendar.months.reduce((sum, month) => sum + Math.max(1, month.days), 0),
  )

/** The date of day `index` (days since the game began; negative = before it). */
export function dateOf(index: number, calendar: CalendarConfig): GameDate {
  const months = calendar.months.length > 0 ? calendar.months : [{ name: '', days: 30 }]
  const perYear = yearLength({ ...calendar, months })
  // Where the first day sits inside its year.
  let offset = Math.max(0, calendar.start.day - 1)
  for (let m = 0; m < Math.min(months.length, calendar.start.month - 1); m++)
    offset += Math.max(1, (months[m] as CalendarMonth).days)
  const absolute = offset + Math.floor(index)
  const year = calendar.start.year + Math.floor(absolute / perYear)
  let left = ((absolute % perYear) + perYear) % perYear
  let month = 0
  while (month < months.length - 1 && left >= Math.max(1, (months[month] as CalendarMonth).days)) {
    left -= Math.max(1, (months[month] as CalendarMonth).days)
    month++
  }
  const week = Math.max(1, calendar.weekdays.length)
  const first = Math.max(0, calendar.weekdays.indexOf(calendar.start.weekday))
  const weekdayIndex = (((first + Math.floor(index)) % week) + week) % week
  return {
    index: Math.floor(index),
    year,
    month: month + 1,
    monthName: (months[month] as CalendarMonth).name,
    day: left + 1,
    weekday: calendar.weekdays[weekdayIndex] ?? '',
    weekdayIndex,
  }
}

/** Does a named date fall on this day? A date with no fields never matches. */
export function dateMatches(named: NamedDate, date: GameDate): boolean {
  if (
    named.month === undefined &&
    named.day === undefined &&
    named.weekday === undefined &&
    named.year === undefined
  )
    return false
  return (
    (named.month === undefined || named.month === date.month) &&
    (named.day === undefined || named.day === date.day) &&
    (named.weekday === undefined || named.weekday === date.weekday) &&
    (named.year === undefined || named.year === date.year)
  )
}

/** Days from `from` until the named date next falls (0 = today). -1 = not within `limit` days. */
export function daysUntil(
  named: NamedDate,
  from: number,
  calendar: CalendarConfig,
  limit = yearLength(calendar) * 8,
): number {
  for (let n = 0; n <= limit; n++) if (dateMatches(named, dateOf(from + n, calendar))) return n
  return -1
}

/** Writes a date with a format: {weekday} {day} {month} {monthNumber} {year}. Names come translated. */
export function formatDate(
  date: GameDate,
  format: string,
  translate: (text: string) => string = (text) => text,
): string {
  const values: Record<string, string> = {
    weekday: date.weekday ? translate(date.weekday) : '',
    day: String(date.day),
    month: date.monthName ? translate(date.monthName) : '',
    monthNumber: String(date.month),
    year: String(date.year),
  }
  return translate(format)
    .replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole)
    .trim()
}
