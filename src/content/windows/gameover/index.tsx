// The game-over screen (game.gameOver(), a lost battle). Edit freely: it is game content.
// Texts, buttons and sounds: src/content/config/gameover.ts.
import { Button, Stack, Typography } from '@mui/material'
import { defineWindow, type WindowProps } from '@/core/define'
import type { GameOverButton } from '@/core/gameover'
import { tx, useLang } from '@/core/lang'
import type { GameOverParams } from '@/core/managers/gameover'

const LABELS: Record<GameOverButton, string> = {
  load: tx('Load last save'),
  wakeUp: tx('Get back up'),
  title: tx('Return to title'),
}

function GameOver({ params }: WindowProps<GameOverParams>) {
  const t = useLang()
  return (
    <Stack spacing={1.5} sx={{ textAlign: 'center' }}>
      <Typography variant="h4" component="p">
        {t(params.title)}
      </Typography>
      {params.text && <Typography color="text.secondary">{t(params.text)}</Typography>}
      {params.buttons.map((button, index) => (
        <Button
          key={button}
          variant={index === 0 ? 'contained' : 'outlined'}
          autoFocus={index === 0}
          onClick={() => params.answer(button)}
        >
          {t(LABELS[button])}
        </Button>
      ))}
    </Stack>
  )
}

export default defineWindow<GameOverParams>({
  title: '',
  component: GameOver,
  width: 380,
  modal: true,
  // The player has to pick one of the buttons.
  closable: false,
})
