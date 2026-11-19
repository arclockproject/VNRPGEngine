// game.clock: in-game time of day (saved). Outdoor maps (outdoor: true) get a colour by hour,
// set in src/content/config/clock.ts. Time runs only while the player is free on a map.
import clockConfig from '@/content/config/clock'
import {
  type CalendarConfig,
  dateMatches,
  dateOf,
  daysUntil,
  formatDate,
  type GameDate,
  type NamedDate,
} from '../calendar'
import { reportError } from '../errors'
import { getGame } from '../gameRef'
import { t } from '../lang'
import { mixColor } from '../scene/color'
import { useGameStore } from '../stores/game'
import { topLayer, useSystemStore } from '../stores/system'
import { peekWorld } from '../world/getWorld'

export interface ClockTint {
  hour: number
  /** CSS colour. */
  tint: string
  /** 0 = no colour, 1 = only the colour. */
  strength: number
}

export interface ClockConfig<W extends string = string, D extends string = string> {
  /** In-game minutes per real second. Default 1 (a day lasts 24 real minutes). 0 = time stands still. */
  minutesPerSecond?: number
  /** Hour of a new game. Default 8. */
  startHour?: number
  /** Outdoor colour at these hours; blended in between (wraps around midnight). */
  tints: ClockTint[]
  /** Weekdays, months and named dates. Leave out = the game only counts days. */
  calendar?: CalendarConfig<W, D>
}

export function defineClock<const W extends string, const D extends string>(
  config: ClockConfig<W, D>,
): ClockConfig<W, D> {
  return config
}

/** Ids of the named dates in src/content/config/clock.ts. */
export type DateId = typeof clockConfig extends ClockConfig<string, infer D> ? D : never

const calendar = (clockConfig as ClockConfig).calendar
const namedDates = (calendar?.dates ?? {}) as Record<string, NamedDate>
/** Used when the game has no calendar: plain day numbers. */
const NO_CALENDAR: CalendarConfig = {
  weekdays: [],
  months: [],
  start: { year: 1, month: 1, day: 1, weekday: '' },
  format: '{day}',
  dates: {},
}

const DAY = 24 * 60

/** The tint at a time of day (minutes 0..1439), blending between the configured hours. */
export function tintAt(
  minutes: number,
  tints: readonly ClockTint[],
): { tint: string; strength: number } {
  if (tints.length === 0) return { tint: '#000000', strength: 0 }
  const sorted = [...tints].sort((a, b) => a.hour - b.hour)
  const now = (((minutes % DAY) + DAY) % DAY) / 60
  let before = sorted[sorted.length - 1] as ClockTint
  let after = sorted[0] as ClockTint
  for (const entry of sorted) {
    if (entry.hour <= now) before = entry
  }
  after = sorted.find((e) => e.hour > now) ?? (sorted[0] as ClockTint)
  const span = (after.hour - before.hour + 24) % 24 || 24
  const t = ((now - before.hour + 24) % 24) / span
  return {
    tint: mixColor(before.tint, after.tint, t),
    strength: before.strength + (after.strength - before.strength) * t,
  }
}

let paused = false
let started = false

export const clock = {
  /** Minutes since the start of day 0. */
  minutes(): number {
    return useGameStore.getState().clockMinutes
  },
  /** 0..23 */
  hour(): number {
    return Math.floor((clock.minutes() % DAY) / 60)
  },
  /** 0..59 */
  minute(): number {
    return Math.floor(clock.minutes() % 60)
  },
  /** Days since the game started (0 = first day). */
  day(): number {
    return Math.floor(clock.minutes() / DAY)
  },
  /** "08:30" */
  label(): string {
    return `${String(clock.hour()).padStart(2, '0')}:${String(clock.minute()).padStart(2, '0')}`
  },
  /** Sets the time of day (today, or the next day if `nextDay`). */
  set(hour: number, minute = 0, options: { nextDay?: boolean } = {}): void {
    const day = clock.day() + (options.nextDay ? 1 : 0)
    useGameStore.setState((s) => {
      s.clockMinutes = day * DAY + hour * 60 + minute
    })
  },
  advance(minutes: number): void {
    useGameStore.setState((s) => {
      s.clockMinutes += minutes
    })
  },
  /**
   * Today's date (or the date `inDays` from now): { year, month, monthName, day, weekday, … }.
   * Without a calendar in src/content/config/clock.ts: one endless month of numbered days.
   */
  date(inDays = 0): GameDate {
    return dateOf(clock.day() + inDays, calendar ?? NO_CALENDAR)
  },
  /** "Saturday, 29 Spring": the calendar's `format`, translated. */
  dateLabel(inDays = 0): string {
    return formatDate(clock.date(inDays), (calendar ?? NO_CALENDAR).format, t)
  },
  /** Is today (or the day `inDays` from now) this named date? clock.is('market_day') */
  is(id: DateId, inDays = 0): boolean {
    const named = namedDates[id]
    return !!named && dateMatches(named, clock.date(inDays))
  },
  /** The named dates that fall on today, in the order of the file. */
  today(): { id: DateId; name: string }[] {
    const date = clock.date()
    return Object.entries(namedDates)
      .filter(([, named]) => dateMatches(named, date))
      .map(([id, named]) => ({ id: id as DateId, name: named.name ? t(named.name) : id }))
  },
  /** Days until a named date next comes (0 = today, -1 = never). */
  daysUntil(id: DateId): number {
    const named = namedDates[id]
    return named && calendar ? daysUntil(named, clock.day(), calendar) : -1
  },
  /** Stops time (cutscenes, shops). */
  pause(): void {
    paused = true
  },
  resume(): void {
    paused = false
  },
  /** Outdoor colour right now. */
  tint(): { tint: string; strength: number } {
    return tintAt(clock.minutes(), clockConfig.tints)
  },
  /** Runs the clock. Called once from boot.tsx. */
  start(): void {
    if (started) return
    started = true
    setInterval(() => {
      const s = useSystemStore.getState()
      // Only while the player walks around freely: not during events, minigames, open windows,
      // map interactions or map changes (else an NPC's schedule moves them mid-conversation).
      const playing =
        s.map !== null &&
        topLayer(s) === 'map' &&
        s.mapTransition === null &&
        !peekWorld()?.interacting &&
        !document.hidden
      const rate = clockConfig.minutesPerSecond ?? 1
      if (playing && !paused && rate > 0) clock.advance(rate)
      if (playing) startDatedEvents()
    }, 1000)
  },
}

/**
 * Named dates with an `event`: started once on each such day, when the player is free on a map
 * (the caller checks that). Which day each last ran on is saved.
 */
export function startDatedEvents(): void {
  if (!calendar) return
  const date = clock.date()
  const hour = clock.hour()
  for (const [id, named] of Object.entries(namedDates)) {
    if (!named.event || hour < (named.hour ?? 0) || !dateMatches(named, date)) continue
    if (useGameStore.getState().datesRan?.[id] === date.index) continue
    useGameStore.setState((s) => {
      s.datesRan = { ...s.datesRan, [id]: date.index }
    })
    void getGame()
      .events.start(named.event as never)
      .catch((error: unknown) => reportError(`date "${id}"`, error))
    return // one at a time: the next waits for the following tick
  }
}

/** React: today's date, re-drawn when the day changes. */
export function useDate(): GameDate {
  useGameStore((s) => Math.floor(s.clockMinutes / DAY))
  return clock.date()
}

/** Where a new game's clock starts. */
export const startMinutes = () => (clockConfig.startHour ?? 8) * 60
