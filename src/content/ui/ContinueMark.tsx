// The mark that says "press to continue": shown once a line has typed out. Edit freely: a picture,
// another animation, where it sits (TextDialog.tsx puts it in the text area: its corner is the
// area's). <ActionHint> shows the key / button for the device in use ("Enter", "A", "✕"…).
import { keyframes } from '@emotion/react'
import { Box } from '@mui/material'
import { ActionHint } from '@/core/input/ActionHint'
import { SHORT_SCREEN } from '@/core/layers/screen'
import type { ContinueMarkSlotProps } from '@/core/slots'

const blink = keyframes`0%, 100% { opacity: 0.2 } 50% { opacity: 1 }`

export function ContinueMark(_: ContinueMarkSlotProps) {
  return (
    <Box
      aria-hidden
      sx={{
        position: 'absolute',
        right: 16,
        bottom: 10,
        [SHORT_SCREEN]: { right: 10, bottom: 4 },
        display: 'flex',
        alignItems: 'center',
        animation: `${blink} 1s infinite`,
        pointerEvents: 'none',
      }}
    >
      ▼<ActionHint action="confirm" />
    </Box>
  )
}
