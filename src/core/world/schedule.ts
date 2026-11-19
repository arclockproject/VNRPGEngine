// NPC schedules: which entry applies at a time of day. Pure (no PixiJS), see World for the rest.
import type { ScheduleEntry } from '../define'

const DAY = 24 * 60

/** '8', '08:30' or 8.5 -> minutes after midnight. */
export function parseTime(from: ScheduleEntry['from']): number {
  if (typeof from === 'number') return Math.round(from * 60) % DAY
  const match = /^(\d{1,2})(?::(\d{2}))?$/.exec(from.trim())
  if (!match) throw new Error(`[schedule] bad time "${from}" (use "8", "08:30" or 8.5)`)
  const hours = Number(match[1])
  const minutes = Number(match[2] ?? 0)
  if (hours > 23 || minutes > 59) throw new Error(`[schedule] bad time "${from}"`)
  return hours * 60 + minutes
}

/**
 * Index of the entry in effect at `minutes` (any day): the latest one that has started today.
 * Before the first entry of the day, yesterday's last entry still applies.
 */
export function activeEntry(schedule: readonly ScheduleEntry[], minutes: number): number {
  if (schedule.length === 0) return -1
  const now = ((minutes % DAY) + DAY) % DAY
  let best = -1
  let bestTime = -1
  let latest = 0
  let latestTime = -1
  schedule.forEach((entry, index) => {
    const time = parseTime(entry.from)
    if (time <= now && time >= bestTime) {
      best = index
      bestTime = time
    }
    if (time >= latestTime) {
      latest = index
      latestTime = time
    }
  })
  return best === -1 ? latest : best
}
