// The question window behind game.dialog.ask(). Edit freely: it is game content.
import { Button, Stack, Typography } from '@mui/material'
import { credits } from '@/content/credits'
import { defineWindow, type WindowProps } from '@/core/define'
import { useLang } from '@/core/lang'

export interface ConfirmParams {
  id: number
  title?: string
}

function Credits(_: WindowProps<ConfirmParams>) {
  const t = useLang()
  return (
    <Stack spacing={1.5}>
      <Typography>{t('Game Credits')}</Typography>
      <Typography variant="body2">
        {t('Game was possible thanks to the work of all the below')}
      </Typography>

      {credits.map((credit, index) => (
        <Button
          // biome-ignore lint/suspicious/noArrayIndexKey: Order Never changes, credits are static consts.
          key={index}
        >
          {credit}
        </Button>
      ))}
    </Stack>
  )
}

export default defineWindow<ConfirmParams>({
  title: 'Credits',
  component: Credits,
  width: 380,
  modal: true,
})
