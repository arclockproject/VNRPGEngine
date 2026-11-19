// Draws a stacked picture (a layered CG with toggles on): a box with the picture's shape, centred,
// that fills the game screen ('cover', like a background) or fits inside it ('contain', like the
// image viewer). Each layer sits at its place as % of that box, so it lines up at any size.
import { Box } from '@mui/material'
import type { Ref } from 'react'
import type { StackedPicture } from '../gallery'

export function StackedPictureView(props: {
  picture: StackedPicture
  fit: 'cover' | 'contain'
  ref?: Ref<HTMLDivElement>
}) {
  const { aspect, layers } = props.picture
  // Sizes in game-screen units (cqw/cqh), never vw/vh (the screen is letterboxed).
  const width = `${props.fit === 'cover' ? 'max' : 'min'}(100cqw, ${100 * aspect}cqh)`
  return (
    <Box
      ref={props.ref}
      sx={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width,
        aspectRatio: String(aspect),
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
      }}
    >
      {layers.map((layer) => (
        <Box
          key={layer.src}
          component="img"
          src={layer.src}
          alt=""
          draggable={false}
          sx={{
            position: 'absolute',
            left: `${layer.x * 100}%`,
            top: `${layer.y * 100}%`,
            width: `${layer.w * 100}%`,
            height: `${layer.h * 100}%`,
          }}
        />
      ))}
    </Box>
  )
}
