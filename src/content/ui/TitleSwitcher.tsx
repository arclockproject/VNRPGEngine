// Switching between unlocked title screens on the title (◀ name ▶). Only drawn while more than one
// is unlocked; the tab keys / shoulder buttons switch too. Where it sits: TitleFrame.tsx. Edit freely.
import { Box, Button, Typography } from '@mui/material'
import { useLang } from '@/core/lang'
import type { TitleSwitcherSlotProps } from '@/core/slots'

export function TitleSwitcher({ name, index, count, previous, next }: TitleSwitcherSlotProps) {
  const t = useLang()
  return (
    <>
      <Button size="small" aria-label={t('Previous title screen')} onClick={previous}>
        ◀
      </Button>
      <Typography variant="body2" sx={{ minWidth: 0 }} noWrap>
        {name}{' '}
        <Box component="span" sx={{ opacity: 0.7 }}>
          {index + 1}/{count}
        </Box>
      </Typography>
      <Button size="small" aria-label={t('Next title screen')} onClick={next}>
        ▶
      </Button>
    </>
  )
}
