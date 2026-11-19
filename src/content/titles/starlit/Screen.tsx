// Example variant: the sky fades up from black, the stars twinkle, the logo drifts down.
import { keyframes } from '@emotion/react'
import { Box } from '@mui/material'
import type { TitleScreenProps } from '@/core/define'
import { lang, useLang } from '@/core/lang'
import logo from '../../assets/logo.svg'
import sky from './sky.png'

const dawn = keyframes`
  from { opacity: 0; transform: scale(1.08); filter: brightness(0.3); }
  to   { opacity: 1; transform: scale(1); filter: brightness(1); }
`
const drift = keyframes`
  from { opacity: 0; transform: translateY(-40px); }
  to   { opacity: 1; transform: none; }
`
const twinkle = keyframes`
  0%, 100% { opacity: 0.85; }
  50%      { opacity: 1; }
`
const glow = keyframes`
  0%, 100% { filter: drop-shadow(0 0 12px rgba(242, 212, 138, 0.35)); }
  50%      { filter: drop-shadow(0 0 28px rgba(242, 212, 138, 0.7)); }
`

export default function StarlitTitle({ step }: TitleScreenProps) {
  useLang() // shows the logo of a newly picked language
  return (
    <Box sx={{ position: 'absolute', inset: 0, overflow: 'hidden', bgcolor: '#050816' }}>
      <Box
        component="img"
        src={sky}
        alt=""
        draggable={false}
        sx={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          animation: `${dawn} 2.4s ease-out both, ${twinkle} 4s ease-in-out 2.4s infinite`,
        }}
      />
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
        {/* The second still: the logo arrives once the sky has had its moment (`intro` in index.ts). */}
        {step >= 1 && (
          <Box
            component="img"
            src={lang.image(logo)}
            alt="INSERTGAMENAMEHERE"
            draggable={false}
            sx={{
              width: 'min(520px, 100%)',
              maxHeight: '80cqh',
              animation: `${drift} 1.6s ease-out both, ${glow} 5s ease-in-out 1.6s infinite`,
            }}
          />
        )}
      </Box>
    </Box>
  )
}
