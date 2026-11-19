// The parts of src/content/ui/Choice.tsx that the engine needs. Each sx is the content's.
//   <ChoiceList>   holds the answers: arrows / d-pad move between them, nothing is focused at first
//                  (a player hammering confirm through the dialogue must not pick the first answer
//                  by accident: the first up / down focuses one), and a click on it doesn't also
//                  reach the scene behind
//   <ChoiceButton> one answer: picks it, disabled while its condition isn't met
import { Box, Button, type SxProps, type Theme } from '@mui/material'
import { type ReactNode, useRef } from 'react'
import type { ActionEvent } from '../input/manager'
import { navigate } from '../input/navigation'
import { useAction } from '../input/useAction'
import { pick } from '../scene/director'
import { playback } from '../scene/playback'
import type { ChoiceAnswerInfo } from '../slots'

export function ChoiceList({ sx, children }: { sx?: SxProps<Theme>; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const nav = (event: ActionEvent) => {
    const list = ref.current
    if (!list) return false
    if (list.contains(document.activeElement)) return navigate(list, event)
    const buttons = list.querySelectorAll<HTMLElement>('button:not([disabled])')
    const target = event.action === 'down' ? buttons[0] : buttons[buttons.length - 1]
    if (event.action === 'down' || event.action === 'up')
      target?.focus({ focusVisible: true } as FocusOptions)
    return true
  }
  useAction('up', nav)
  useAction('down', nav)
  useAction('left', nav)
  useAction('right', nav)
  useAction('confirm', nav)
  return (
    <Box
      ref={ref}
      data-choice-list
      sx={[{ pointerEvents: 'auto' }, ...(Array.isArray(sx) ? sx : [sx])]}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </Box>
  )
}

export function ChoiceButton({
  answer,
  sx,
  children,
}: {
  answer: ChoiceAnswerInfo
  sx?: SxProps<Theme>
  /** What it shows (default: its label). */
  children?: ReactNode
}) {
  return (
    <Button
      variant="choice"
      size="large"
      disabled={answer.disabled !== null}
      onClick={() => {
        // "Skip back" was running: picking an answer stops it here.
        playback.stopSkipBack()
        pick(answer.index)
      }}
      data-chosen={answer.chosen || undefined}
      sx={sx}
    >
      {children ?? answer.label}
    </Button>
  )
}
