// Boot screen 2: the logo, then a line under it (two stills). Skippable.
import { keyframes } from '@emotion/react'
import { Box, Typography } from '@mui/material'
import { useEffect } from 'react'
import { systemVoice } from '@/core/audio/systemVoice'
import { type BootScreenProps, defineBoot } from '@/core/define'
import { lang, tx, useLang } from '@/core/lang'
import logo from '../assets/logo.svg'

const rise = keyframes`from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none }`
const LINE = tx('presents')

function Logo({ step }: BootScreenProps) {
  const t = useLang()
  useEffect(() => {
    if (step === 2) {
      void systemVoice.play('title_call')
    }
  }, [step])
  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        alignContent: 'center',
        gap: 3,
        bgcolor: '#000',
      }}
    >
      <Box
        component="img"
        src={lang.image(logo)}
        alt=""
        draggable={false}
        sx={{ width: 'min(420px, 60cqw)', maxHeight: '50cqh' }}
      />
      {/* Second still: appears when the first step (1.2 s) is over. It keeps its space so the
          logo does not jump. */}
      <Typography
        variant="h6"
        sx={{
          letterSpacing: 6,
          textTransform: 'uppercase',
          ...(step >= 1 ? { animation: `${rise} 500ms ease both` } : { visibility: 'hidden' }),
        }}
      >
        {t(LINE)}
      </Typography>
    </Box>
  )
}

export default defineBoot({
  order: 2,
  skippable: true,
  fadeIn: 500,
  steps: [1200, 1000, 1000], // two stills: the logo alone for 1.2 s, then with the line for 2 s
  fadeOut: 500,
  preload: [logo], // loaded before the boot screens start
  screen: Logo,
})
