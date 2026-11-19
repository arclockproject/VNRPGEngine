// The question window behind game.dialog.ask(). Edit freely: it is game content.
import { Button, Stack, Typography } from '@mui/material'
import { defineWindow, type WindowProps } from '@/core/define'
import { useLang } from '@/core/lang'

export interface ConfirmParams {
  id: number
  title?: string
  /** Already translated. */
  message: string
  /** key -> button label (translated here). The first button is the default. */
  options: Record<string, string>
  answer: (key: string) => void
}

function Confirm({ params }: WindowProps<ConfirmParams>) {
  const t = useLang()
  return (
    <Stack spacing={1.5}>
      <Typography sx={{ whiteSpace: 'pre-line' }}>{params.message}</Typography>
      {Object.entries(params.options).map(([key, label], index) => (
        <Button
          key={key}
          variant={index === 0 ? 'contained' : 'outlined'}
          onClick={() => params.answer(key)}
        >
          {t(label)}
        </Button>
      ))}
    </Stack>
  )
}

export default defineWindow<ConfirmParams>({
  title: 'Confirm',
  component: Confirm,
  width: 380,
  modal: true,
})
