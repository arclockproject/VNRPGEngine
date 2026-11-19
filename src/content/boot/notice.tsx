// Boot screen 1: a notice the player must see. Not skippable: it always stays its full time.
// Every file in this folder plays once when the game starts, one after another (lowest `order`
// first), before "press any key". Delete a file to remove its screen; copy one to add another.
import { Box, Typography } from '@mui/material'
import { defineBoot } from '@/core/define'
import { tx, useLang } from '@/core/lang'

const TITLE = tx('Notice')
const TEXT = tx(
  'This is a work of fiction. Names, characters, places and events are made up. Any likeness to real people or events is a coincidence.',
)

function Notice() {
  const t = useLang()
  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        alignContent: 'center',
        gap: 2,
        px: '10cqw',
        textAlign: 'center',
        bgcolor: '#000',
      }}
    >
      <Typography variant="h5" sx={{ letterSpacing: 4, textTransform: 'uppercase' }}>
        {t(TITLE)}
      </Typography>
      <Typography sx={{ maxWidth: 640, opacity: 0.85 }}>{t(TEXT)}</Typography>
    </Box>
  )
}

export default defineBoot({
  order: 1,
  skippable: false, // true = confirm (Enter, Space, pad A), a click or a tap ends it early
  fadeIn: 600, // ms, from black
  steps: 5000, // ms on screen
  fadeOut: 600, // ms, to black
  screen: Notice,
})
