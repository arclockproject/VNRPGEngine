// The skip button over a movie. It shows for a few seconds after a tap or a key, on movies that can
// be skipped. Edit freely: where it sits and how it looks.
import { Button } from '@mui/material'
import { ActionHint } from '@/core/input/ActionHint'
import { useLang } from '@/core/lang'
import type { MovieSkipSlotProps } from '@/core/slots'
import { part } from '@/core/ui/part'

export function MovieSkip({ skip }: MovieSkipSlotProps) {
  const t = useLang()
  return (
    <Button
      size="small"
      onClick={skip}
      sx={{ position: 'absolute', right: 16, bottom: 16, ...part('sceneToolbar') }}
    >
      {t('Skip')} ▶▶ <ActionHint action="confirm" />
    </Button>
  )
}
