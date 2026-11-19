// game.timers on screen (those with `show`). Edit freely: where they sit, label before / after the
// digits, sizes. Each timer is a <TimerFrame> with <TimerDigits /> in it (@/core/ui/Timers): the
// engine writes the digits and sets data-warning in the warning time (style '&[data-warning]').
// Looks: `timer` / `timerWarning` in src/content/look/parts.ts. Warning time and tenths:
// src/content/config/timers.ts. They never catch clicks.
import { Stack } from '@mui/material'
import config from '@/content/config/timers'
import type { TimersSlotProps } from '@/core/slots'
import { part } from '@/core/ui/part'
import { TimerDigits, TimerFrame } from '@/core/ui/Timers'

export function Timers({ timers }: TimersSlotProps) {
  return (
    <Stack spacing={0.5} sx={{ position: 'absolute', alignItems: 'flex-start', ...config.place }}>
      {timers.map((timer) => (
        <TimerFrame
          key={timer.id}
          timer={timer}
          sx={{
            display: 'flex',
            gap: 1,
            alignItems: 'baseline',
            fontVariantNumeric: 'tabular-nums',
            opacity: timer.paused ? 0.6 : 1,
            ...part('timer'),
            '&[data-warning]': part('timerWarning'),
          }}
        >
          {timer.label && <span>{timer.label}</span>}
          <TimerDigits />
        </TimerFrame>
      ))}
    </Stack>
  )
}
