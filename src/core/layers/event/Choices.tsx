// A choice on screen: the engine works out the answers, the time-left bar and (with no line
// showing) the toolbar, and src/content/ui/Choice.tsx lays them out.
import { Box } from '@mui/material'
import { type ReactNode, useEffect } from 'react'
import { Choice } from '@/content/ui/Choice'
import type { ChoiceView, SceneState } from '../../scene/state'
import type { ChoiceAnswerInfo } from '../../slots'
import { timerShrink } from './shared'

export function Choices({
  options,
  timer,
  toolbar,
  withLine,
}: {
  options: ChoiceView[]
  timer: SceneState['choiceTimer']
  toolbar: ReactNode | null
  withLine: boolean
}) {
  const answers: ChoiceAnswerInfo[] = options.map(({ label, disabled, chosen }, index) => ({
    index,
    label,
    disabled: disabled ?? null,
    chosen: chosen === true,
  }))
  const timerBar = timer ? (
    // Time left: shrinks by CSS (no re-renders while it runs).
    <Box sx={{ height: 4, borderRadius: 2, bgcolor: 'action.selected', overflow: 'hidden' }}>
      <Box
        sx={{
          height: '100%',
          bgcolor: 'warning.main',
          transformOrigin: 'left',
          animation: `${timerShrink} ${timer.ms}ms linear forwards`,
          animationDelay: `${-(Date.now() - timer.startedAt)}ms`,
        }}
      />
    </Box>
  ) : null

  // Dev only: without <ChoiceList> the keys / pad can't reach the answers.
  useEffect(() => {
    if (import.meta.env.DEV && !document.querySelector('[data-choice-list]'))
      console.warn('[Choice.tsx] put the answers inside <ChoiceList> (@/core/ui/Choice)')
  }, [])

  return <Choice answers={answers} timer={timerBar} toolbar={toolbar} withLine={withLine} />
}
