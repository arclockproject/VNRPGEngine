// Free pictures on the stage (image()): item close-ups, letters, overlays.
import { Box } from '@mui/material'
import { lang, useLang } from '../../lang'
import type { SceneImage } from '../../scene/state'
import { fade } from './shared'

export function Pictures({ images, layer }: { images: SceneImage[]; layer: SceneImage['layer'] }) {
  useLang() // a language may bring its own pictures
  const shown = images.filter((image) => image.layer === layer)
  if (shown.length === 0) return null
  return (
    <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {shown.map((image) => (
        // Outer box: fades in when added. Inner picture: moves / fades by CSS transition, so a
        // second image() call with the same name glides to its new place.
        <Box
          key={image.name}
          sx={{
            position: 'absolute',
            inset: 0,
            animation: image.duration > 0 ? `${fade} ${image.duration}ms ease both` : 'none',
          }}
        >
          <Box
            component="img"
            src={lang.image(image.src)}
            alt=""
            draggable={false}
            style={{
              left: `${image.x}%`,
              top: `${image.y}%`,
              width: image.width !== undefined ? `${image.width}cqw` : 'auto',
              height: image.height !== undefined ? `${image.height}cqh` : 'auto',
              opacity: image.leaving ? 0 : image.opacity,
              transform: `translate(-50%, -50%) rotate(${image.rotate}deg) scale(${image.scale})`,
              transitionDuration: `${image.duration}ms`,
            }}
            sx={{
              position: 'absolute',
              display: 'block',
              transitionProperty: 'left, top, width, height, opacity, transform',
              transitionTimingFunction: 'ease-in-out',
              imageRendering: image.pixelated ? 'pixelated' : 'auto',
            }}
          />
        </Box>
      ))}
    </Box>
  )
}
