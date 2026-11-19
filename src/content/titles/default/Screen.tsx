// The art behind the title menu, and its entrance (plays each time it appears). Edit freely.
import { keyframes } from '@emotion/react'
import { Box } from '@mui/material'
import type { TitleScreenProps } from '@/core/define'
import { lang, useLang } from '@/core/lang'
import logo from '../../assets/logo.svg'

const appear = keyframes`
  from { opacity: 0; transform: scale(0.92); }
  to   { opacity: 1; transform: scale(1); }
`
const fadeIn = keyframes`from { opacity: 0 } to { opacity: 1 }`

export default function DefaultTitle(_: TitleScreenProps) {
  useLang() // shows the logo of a newly picked language
  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at center, #1b2433 0%, #0d1117 70%)',
        animation: `${fadeIn} 600ms ease-out both`,
      }}
    >
      {/* The logo fills the space left of the menu (TitleFrame.tsx keeps the right side). */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          right: 'min(400px, 45cqw)',
          display: 'grid',
          placeItems: 'center',
          p: 2,
        }}
      >
        <Box
          component="img"
          src={lang.image(logo)}
          alt="INSERTGAMENAMEHERE"
          draggable={false}
          sx={{
            width: 'min(560px, 100%)',
            maxHeight: '80cqh',
            animation: `${appear} 1.2s ease-out both`,
          }}
        />
      </Box>
    </Box>
  )
}
