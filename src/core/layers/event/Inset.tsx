// inset(): a framed picture in the middle of the screen, over the background and the characters.
// Size and place: src/content/scenes.ts `inset`; frame: the look part `inset` (optional).
import { Box } from '@mui/material'
import { useEffect, useRef, useState } from 'react'
import look from '@/content/look'
import scenes from '@/content/scenes'
import { partLook } from '../../look'
import type { SceneInset } from '../../scene/state'
import { Backgrounds } from './Backgrounds'

const WIDTH = scenes.inset?.width ?? 62
const RATIO = scenes.inset?.aspectRatio ?? '16 / 9'
const Y = scenes.inset?.y ?? 43
/** The frame, or (a game whose parts.ts has no `inset`) the theme's shadow. */
const FRAME = look.parts.inset ? partLook(look.parts.inset) : { boxShadow: 8 }

export function Inset({ inset, fadeMs }: { inset: SceneInset | null; fadeMs: number }) {
  // While it fades away it keeps showing the last picture.
  const [last, setLast] = useState(inset)
  useEffect(() => {
    if (inset) setLast(inset)
  }, [inset])
  // The first picture comes in with the frame; only later ones crossfade inside it.
  const shownBefore = useRef(false)
  const innerFade = shownBefore.current ? fadeMs : 0
  useEffect(() => {
    shownBefore.current = inset !== null
  }, [inset])
  const shown = inset ?? last
  if (!shown) return null
  return (
    <Box
      aria-hidden
      data-inset={shown.id}
      sx={{
        position: 'absolute',
        left: '50%',
        top: `${Y}%`,
        transform: 'translate(-50%, -50%)',
        width: `${WIDTH}%`,
        maxHeight: '90%',
        aspectRatio: RATIO,
        overflow: 'hidden',
        pointerEvents: 'none',
        // Fades in when it first appears (@starting-style), out on inset(null).
        opacity: inset ? 1 : 0,
        transition: `opacity ${fadeMs}ms ease`,
        '@starting-style': { opacity: 0 },
        ...FRAME,
      }}
    >
      <Backgrounds value={shown.picture} fadeMs={innerFade} transition={null} />
    </Box>
  )
}
