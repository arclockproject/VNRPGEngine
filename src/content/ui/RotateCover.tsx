// Covers the screen when a phone is held upright (content/config/screen.ts `landscapeOnly`), asking
// the player to turn it. The engine decides when it shows and keeps it on top. Edit freely.
import { Box, Typography } from '@mui/material'
import screen from '@/content/config/screen'
import { useLang } from '@/core/lang'
import type { RotateCoverSlotProps } from '@/core/slots'

export function RotateCover(_: RotateCoverSlotProps) {
  const t = useLang()
  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        p: 3,
        textAlign: 'center',
        color: 'common.white',
        bgcolor: screen.barColor,
      }}
    >
      <Typography sx={{ fontSize: 56, lineHeight: 1 }} aria-hidden>
        ⟳
      </Typography>
      <Typography variant="h6">{t('Turn your device sideways to play.')}</Typography>
    </Box>
  )
}
