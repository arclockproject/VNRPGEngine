// The chapter card (src/content/chapters.ts announce: 'card'). Edit freely: the layout of the
// number, title and description, a picture, animations. The engine times it (chapters.ts card:
// style, fadeIn / fadeOut, steps, maskIn / maskOut) and skips it on a click / tap / confirm when
// allowed. Fade with `shown` and `fadeMs`; animate with `phase` ('in' | 'on' | 'out') and `step`
// (which of the card's steps is running, like a boot screen); `skipped` = show the final look at once.
// A chapter can bring its own component instead (chapters.ts: screen).
// Looks: chapterCard / chapterCardLabel / chapterCardTitle / chapterCardDescription /
// chapterCardOverlay in src/content/look/parts.ts.
import { keyframes } from '@emotion/react'
import { Box, Typography } from '@mui/material'
import type { ChapterCardSlotProps } from '@/core/slots'
import { part } from '@/core/ui/part'

/** The line under the title rises in. */
const rise = keyframes`from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none }`
/** The picture slowly drifts while the card is up (a "Ken Burns" move). */
const drift = keyframes`from { transform: scale(1.06) } to { transform: scale(1) }`

export function ChapterCard({
  label,
  title,
  description,
  image,
  style,
  shown,
  fadeMs,
  phase,
  skipped,
}: ChapterCardSlotProps) {
  const overlay = style === 'overlay'
  // Animations start once the card is up; a skip shows the end at once.
  const moving = !skipped && phase !== 'in'
  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        textAlign: 'center',
        overflow: 'hidden',
        opacity: shown ? 1 : 0,
        transition: `opacity ${fadeMs}ms ease`,
      }}
    >
      {image && !overlay && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url("${image}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            animation: skipped ? 'none' : `${drift} 6000ms ease-out both`,
          }}
        />
      )}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          ...part(overlay ? 'chapterCardOverlay' : 'chapterCard'),
        }}
      />
      <Box sx={{ position: 'relative', px: 3, display: 'grid', justifyItems: 'center' }}>
        <Typography component="div" sx={part('chapterCardLabel')}>
          {label}
        </Typography>
        <Typography component="div" sx={{ mt: 1.5, ...part('chapterCardTitle') }}>
          {title}
        </Typography>
        {description && (
          <Typography
            component="div"
            sx={{
              mt: 2,
              ...part('chapterCardDescription'),
              opacity: phase === 'in' && !skipped ? 0 : 1,
              animation: moving ? `${rise} 700ms ease 250ms both` : 'none',
            }}
          >
            {description}
          </Typography>
        )}
      </Box>
    </Box>
  )
}
