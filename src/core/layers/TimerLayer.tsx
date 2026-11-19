// game.timers on screen, drawn by src/content/ui/Timers.tsx (core/ui/Timers.tsx writes the digits).
import { Box } from '@mui/material'
import { Timers } from '@/content/ui/Timers'
import { useLang } from '../lang'
import type { TimerInfo } from '../slots'
import { useGameStore } from '../stores/game'
import { useSystemStore } from '../stores/system'
import { Z } from './zIndex'

export { timerText } from '../ui/Timers'

export function TimerLayer() {
  const t = useLang()
  // A string (compared by value): the shown timers' ids, labels and paused, without a redraw per tick.
  const key = useGameStore((s) =>
    JSON.stringify(
      Object.entries(s.timers ?? {})
        .filter(([, timer]) => timer.show)
        .map(([id, timer]) => [id, timer.label ?? null, timer.paused]),
    ),
  )
  const hidden = useSystemStore((s) => s.title !== null || s.mapTransition !== null)
  const list = JSON.parse(key) as [string, string | null, boolean][]
  if (hidden || list.length === 0) return null
  const timers: TimerInfo[] = list.map(([id, label, paused]) => ({
    id,
    label: label ? t(label) : null,
    paused,
  }))
  return (
    <Box
      data-capture
      sx={{ position: 'absolute', inset: 0, zIndex: Z.timers, pointerEvents: 'none' }}
    >
      <Timers timers={timers} />
    </Box>
  )
}
