import { Box } from '@mui/material'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { voiceLangFile } from '../../audio/voiceClips'
import { type Picture, pictureUrls, type StackedPicture } from '../../gallery'
import { lang, useLang } from '../../lang'
import { backgroundKind, backgroundStyle } from '../../scene/background'
import { canMask, playMask } from '../../scene/mask'
import type { TransitionName } from '../../scene/types'
import { StackedPictureView } from '../../ui/StackedPictureView'
import { fade, fadeOut } from './shared'

type BackgroundValue = string | StackedPicture

interface BackgroundLayer {
  id: number
  value: BackgroundValue
  /** On its way out (fading, or waiting under a mask). */
  leaving: boolean
  /** The old picture stays as it is under the new one until that has covered it (mask or crossfade). */
  held: boolean
  /** The mask this layer comes in with, or null = crossfade. */
  mask: TransitionName | null
  fadeMs: number
}

/**
 * Crossfades between backgrounds (and fades out to the map when set to null). With a mask
 * transition the new picture is painted in through the mask instead (see scene/mask.ts).
 */
export function Backgrounds(props: {
  value: BackgroundValue | null
  fadeMs: number
  transition: TransitionName | null
}) {
  const { value, fadeMs, transition } = props
  const [layers, setLayers] = useState<BackgroundLayer[]>([])
  const nextId = useRef(0)

  useEffect(() => {
    const mask = transition && value !== null && fadeMs > 0 && canMask(value) ? transition : null
    setLayers((current) => {
      // A new picture comes in on top while the old one stays solid under it (a mask, or a
      // crossfade): fading both at once would let the black behind show through halfway. Only
      // going to no picture (back to the map) fades the old one out.
      const kept = current.map((layer) => ({ ...layer, leaving: true, held: value !== null }))
      if (value !== null)
        kept.push({ id: nextId.current++, value, leaving: false, held: false, mask, fadeMs })
      return kept
    })
    const timer = setTimeout(
      () => setLayers((current) => current.filter((layer) => !layer.leaving)),
      // A moment longer, so the new picture's last frame is on screen before the old one goes.
      fadeMs + (mask ? 80 : 30),
    )
    return () => clearTimeout(timer)
  }, [value, fadeMs, transition])

  return layers.map((layer) => <BackgroundView key={layer.id} layer={layer} leaveMs={fadeMs} />)
}

/**
 * A picture in the player's language (see the language file's `images`); a video from a movie's
 * voice-language folder in the voice language.
 */
function localPicture(value: BackgroundValue): BackgroundValue {
  if (typeof value === 'string') return lang.image(voiceLangFile(value))
  return { ...value, layers: value.layers.map((l) => ({ ...l, src: lang.image(l.src) })) }
}

function BackgroundView({ layer, leaveMs }: { layer: BackgroundLayer; leaveMs: number }) {
  useLang() // a new language may bring its own pictures
  const [masking, setMasking] = useState(layer.mask !== null)
  const value = localPicture(layer.value)
  const video = typeof value === 'string' && backgroundKind(value) === 'video'
  const animation = layer.held
    ? 'none'
    : layer.leaving
      ? `${fadeOut} ${leaveMs}ms ease both`
      : layer.mask
        ? 'none'
        : `${fade} ${layer.fadeMs}ms ease both`
  return (
    <Box sx={{ position: 'absolute', inset: 0, overflow: 'hidden', animation }}>
      {/* Hidden while the mask plays (the canvas shows it); loaded and in place when it ends. */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          visibility: masking ? 'hidden' : 'visible',
          ...(typeof value === 'string' ? backgroundStyle(value) : {}),
        }}
      >
        {typeof value !== 'string' && <StackedPictureView picture={value} fit="cover" />}
        {video && (
          <Box
            component="video"
            src={value as string}
            autoPlay
            loop
            muted
            playsInline
            disablePictureInPicture
            sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        )}
      </Box>
      {masking && layer.mask && (
        <MaskCanvas
          value={value}
          name={layer.mask}
          duration={layer.fadeMs}
          onDone={() => setMasking(false)}
        />
      )}
    </Box>
  )
}

/** Paints a background through a moving mask, then reports that it is fully shown. */
function MaskCanvas(props: {
  value: Picture
  name: TransitionName
  duration: number
  onDone: () => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const done = useEffectEvent(props.onDone)
  const { value, name, duration } = props
  const urls = pictureUrls(value).join('|')
  // biome-ignore lint/correctness/useExhaustiveDependencies: `urls` stands for `value` (a new object each render)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    let alive = true
    const finish = () => {
      if (!alive) return
      alive = false
      done()
    }
    playMask(canvas, value, name, duration, () => alive).then(finish, finish)
    return () => {
      alive = false
    }
  }, [urls, name, duration])
  return (
    <Box
      component="canvas"
      ref={ref}
      sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
    />
  )
}

/** movie(): a video over the whole scene. Confirm, a click or a tap shows "Skip"; again skips. */
