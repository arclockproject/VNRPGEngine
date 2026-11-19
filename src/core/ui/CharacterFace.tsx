// A character's face, cut from their portrait with their face box (faceAreaOf). Fills its
// (square) parent: give that a size and `position: relative; overflow: hidden`.
import { Box } from '@mui/material'
import { useEffect, useState } from 'react'
import { lang, useLang } from '../lang'
import type { FaceArea, LayeredPortrait } from '../portrait/define'
import { imageSize, loadImage } from '../portrait/images'
import { LayeredPortraitView } from '../portrait/LayeredPortraitView'
import { SpinePortraitView } from '../portrait/SpinePortraitView'
import type { SpinePortrait } from '../portrait/spine'
import { type CharacterId, characters } from '../registry'

interface FaceInfo {
  name: string
  color?: string
  portraits?: Record<string, string>
  layered?: LayeredPortrait
  spine?: SpinePortrait
  faceArea?: FaceArea
}

const infoOf = (id: CharacterId) => (characters as Record<string, FaceInfo>)[id]

/** Natural width of an image (undefined until it has loaded). */
function useImageWidth(url: string | undefined): number | undefined {
  const [, setLoaded] = useState(0)
  useEffect(() => {
    if (url && !imageSize(url)) void loadImage(url).then(() => setLoaded((n) => n + 1))
  }, [url])
  return url ? imageSize(url)?.w : undefined
}

/** Whether a character has any picture a face could be cut from. */
export function hasFace(id: CharacterId): boolean {
  const info = infoOf(id)
  return !!info && (!!info.layered || !!info.spine || Object.keys(info.portraits ?? {}).length > 0)
}

/**
 * Where the face is on a character's portrait, most specific first: the expression's faceArea,
 * the portrait's (fromAseprite `defaults.faceArea`, else the Aseprite "#face" layer), then the
 * character's own `faceArea`. Undefined = none (the top of the portrait is shown).
 */
export function faceAreaOf(id: CharacterId, pose?: string | null): FaceArea | undefined {
  const info = infoOf(id)
  const portrait = info?.spine ?? info?.layered
  const expression = pose ?? (portrait ? Object.keys(portrait.expressions)[0] : undefined)
  const own = portrait?.faceAreas as Partial<Record<string, FaceArea>> | undefined
  return (expression ? own?.[expression] : undefined) ?? portrait?.faceArea ?? info?.faceArea
}

export function CharacterFace({
  id,
  pose,
  parts,
}: {
  id: CharacterId
  /** Pose / expression to show. Default: their first one. */
  pose?: string | null
  parts?: Record<string, string | null>
}) {
  useLang() // a language may bring its own pictures
  const info = infoOf(id)
  const picked = pose ? info?.portraits?.[pose] : undefined
  const first = picked ?? (info?.portraits ? Object.values(info.portraits)[0] : undefined)
  const src = first ? lang.image(first) : undefined
  const imageWidth = useImageWidth(info?.layered ? undefined : src)
  const width = info?.layered?.width ?? imageWidth
  const face = faceAreaOf(id, pose)
  // A box that is not square is fitted into the square: its longer side fills it, centred.
  const side = face ? Math.max(face.w, face.h) : 0
  const left = face ? face.x - (side - face.w) / 2 : 0
  const top = face ? face.y - (side - face.h) / 2 : 0
  // The whole portrait, scaled and shifted so the face box fills the (square) parent.
  const crop =
    face && width && side > 0
      ? ({
          position: 'absolute',
          width: `${(width / side) * 100}%`,
          left: `${(-left / side) * 100}%`,
          top: `${(-top / side) * 100}%`,
        } as const)
      : ({ width: '100%' } as const)
  // Spine: the runtime draws only the face box (square) into its canvas.
  if (info?.spine) {
    const box = face ?? { x: 0, y: 0, w: info.spine.width, h: info.spine.width }
    const square = { x: left, y: top, w: side, h: side }
    return (
      <SpinePortraitView
        id={id}
        portrait={info.spine}
        expression={pose ?? null}
        parts={parts}
        alt={info.name}
        crop={face ? square : box}
      />
    )
  }
  if (info?.layered)
    return (
      <Box sx={crop}>
        <LayeredPortraitView
          id={id}
          portrait={info.layered}
          expression={pose ?? null}
          parts={parts}
          alt={info.name}
          height="10000px"
          maxWidth="100%"
        />
      </Box>
    )
  if (src)
    return (
      <Box sx={crop}>
        <Box
          component="img"
          src={src}
          alt={info?.name}
          draggable={false}
          sx={{ display: 'block', width: '100%' }}
        />
      </Box>
    )
  return null
}
