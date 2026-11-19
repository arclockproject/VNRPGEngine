// Time of day: how fast it runs and how outdoor maps (outdoor: true) are tinted by hour.
import { tx } from '@/core/lang'
import { defineClock } from '@/core/managers/clock'

export default defineClock({
  minutesPerSecond: 1, // a full day takes 24 real minutes
  startHour: 8,
  tints: [
    { hour: 0, tint: '#0b1640', strength: 0.55 },
    { hour: 5, tint: '#2a2f6b', strength: 0.4 },
    { hour: 7, tint: '#ffb27a', strength: 0.12 },
    { hour: 9, tint: '#ffffff', strength: 0 },
    { hour: 17, tint: '#ffffff', strength: 0 },
    { hour: 19, tint: '#ff8a4c', strength: 0.22 },
    { hour: 21, tint: '#1a2357', strength: 0.45 },
  ],

  // The calendar: game.clock.date() / dateLabel() / is('market_day'). Remove it and the game only
  // counts days (game.clock.day()).
  calendar: {
    weekdays: [
      tx('Monday'),
      tx('Tuesday'),
      tx('Wednesday'),
      tx('Thursday'),
      tx('Friday'),
      tx('Saturday'),
      tx('Sunday'),
    ],
    // A year is all the months, in order.
    months: [
      { name: tx('Spring'), days: 30 },
      { name: tx('Summer'), days: 30 },
      { name: tx('Autumn'), days: 30 },
      { name: tx('Winter'), days: 30 },
    ],
    // The date of a new game's first day.
    start: { year: 1, month: 1, day: 1, weekday: 'Monday' },
    // {weekday} {day} {month} {monthNumber} {year}
    format: tx('{weekday}, {day} {month}'),

    // Named days. Every field given must match: month + day = once a year, weekday = every week,
    // day alone = every month. Add `event` to start an event by itself on that day (once, when
    // the player is free on a map; `hour` = not before that hour).
    dates: {
      market_day: { name: tx('Market day'), weekday: 'Saturday' },
      new_year: { name: tx("New Year's Day"), month: 1, day: 1 },
      // harvest: { name: tx('Harvest festival'), month: 3, day: 15, event: 'town/festival', hour: 18 },
    },
  },
})
