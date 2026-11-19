// How long the line's voice still plays: the word "Voice" over a bar that empties until the longest
// clip ends. Edit freely (text, size, colours, a picture). Where it sits: src/content/ui/TextDialog.tsx
// (`voiceBar`). It shows only while a voice plays.
//
// The bar runs on its own as a CSS animation (no redraw per frame): `durationMs` long, started
// `elapsedMs` in (a negative delay), so it is right even when it appears late.
import { keyframes } from '@emotion/react'
import { Box, Typography } from '@mui/material'
import { useLang } from '@/core/lang'
import { SHORT_SCREEN } from '@/core/layers/screen'
import type { VoiceBarSlotProps } from '@/core/slots'

const shrink = keyframes`from { transform: scaleX(1) } to { transform: scaleX(0) }`

export function VoiceBar({ durationMs, elapsedMs }: VoiceBarSlotProps) {
  const t = useLang()
  return (
    <Box aria-hidden sx={{ width: 88, pointerEvents: 'none', [SHORT_SCREEN]: { width: 64 } }}>
      <Typography
        component="div"
        sx={{ fontSize: 11, lineHeight: 1.3, color: 'text.secondary', textAlign: 'right' }}
      >
        {t('Voice')}
      </Typography>
      <Box sx={{ height: 3, borderRadius: 2, bgcolor: 'action.selected', overflow: 'hidden' }}>
        <Box
          sx={{
            height: '100%',
            bgcolor: 'warning.main',
            transformOrigin: 'left',
            animation: `${shrink} ${durationMs}ms linear forwards`,
            animationDelay: `${-elapsedMs}ms`,
          }}
        />
      </Box>
    </Box>
  )
}
