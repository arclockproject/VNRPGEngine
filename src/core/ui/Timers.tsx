// The parts of src/content/ui/Timers.tsx that the engine needs. The digits change ten times a
// second in the last seconds, so the engine writes them straight into the page, not through React.
//   <TimerFrame>   one timer: role="timer", and data-warning while it is in its warning time (style
//                  it with '&[data-warning]')
//   <TimerDigits>  where its digits go (inside its <TimerFrame>)

import { Box, type SxProps, type Theme } from '@mui/material'
import { type ReactNode, useEffect, useRef } from 'react'
import config from '@/content/config/timers'
import type { TimerInfo } from '../slots'
import { type TimerState, useGameStore } from '../stores/game'
import { formatTime } from '../timers'

/** The text of a timer and whether it is in its warning time. */
export function timerText(timer: TimerState): { text: string; warning: boolean } {
  if (timer.total === undefined) return { text: formatTime(timer.ms), warning: false }
  const left = Math.max(0, timer.total - timer.ms)
  // A countdown shows the second it is in: 0:10 until 9.99 s are left, 0:00 only at the end.
  const shown = Math.ceil(left / 1000) * 1000
  const tenths = config.tenthsUnder > 0 && left < config.tenthsUnder * 1000
  return {
    text: tenths ? formatTime(left, true) : formatTime(shown),
    warning: config.warnSeconds > 0 && left <= config.warnSeconds * 1000,
  }
}

export function TimerFrame({
  timer,
  sx,
  children,
}: {
  timer: TimerInfo
  sx?: SxProps<Theme>
  /** Its label and <TimerDigits />, in your order. */
  children: ReactNode
}) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const draw = () => {
      const state = useGameStore.getState().timers?.[timer.id]
      const el = box.current
      const digits = el?.querySelector<HTMLElement>('[data-timer-digits]')
      if (!state || !el || !digits) return
      const { text, warning } = timerText(state)
      if (digits.textContent !== text) digits.textContent = text
      el.toggleAttribute('data-warning', warning)
    }
    draw()
    return useGameStore.subscribe(draw)
  }, [timer.id])
  return (
    <Box ref={box} role="timer" data-timer={timer.id} sx={sx}>
      {children}
    </Box>
  )
}

export function TimerDigits({ sx }: { sx?: SxProps<Theme> }) {
  return <Box component="span" data-timer-digits sx={sx} />
}
