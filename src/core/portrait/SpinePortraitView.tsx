// Draws a Spine portrait (spine.ts) into a canvas: the pose's animation, the mouth while this
// character talks, blinking. The Spine runtime loads the first time one is shown.
import { Box } from '@mui/material'
import { useEffect, useRef, useState } from 'react'
import scenes from '@/content/scenes'
import { reportError } from '../errors'
import type { FaceArea } from './define'
import type { SpinePortrait } from './spine'
import type { SpineHandle } from './spineRuntime'
import { onTalking, voiceLevel } from './talking'

/** How often the mouth checks how loud the voice clip is, ms. */
const VOICE_FRAME_MS = scenes.voice.lipSync.checkMs ?? 40
/** Sharpest the canvas gets, in canvas pixels per screen pixel. */
const MAX_DENSITY = 2

interface Props {
  /** Character id: the mouth moves while this character talks. */
  id: string
  portrait: SpinePortrait
  expression: string | null
  parts?: Record<string, string | null>
  alt?: string
  /** Largest CSS height of the whole portrait (ignored with `crop`). */
  height?: string
  /** Largest CSS width. */
  maxWidth?: string
  /** Only this part of the portrait (portrait pixels), filling the parent's width. */
  crop?: FaceArea
}

export function SpinePortraitView({
  id,
  portrait,
  expression,
  parts,
  alt,
  height,
  maxWidth,
  crop,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [handle, setHandle] = useState<SpineHandle | null>(null)

  // Load the runtime and this export (once each), make this portrait's handle.
  useEffect(() => {
    let alive = true
    let made: SpineHandle | null = null
    portrait
      .load()
      .then((runtime) => runtime.createSpineHandle(portrait))
      .then((next) => {
        made = next
        if (alive) setHandle(next)
        else next.destroy()
      })
      .catch((error: unknown) => reportError(`spine portrait "${id}"`, error))
    return () => {
      alive = false
      made?.destroy()
    }
  }, [portrait, id])

  useEffect(() => {
    handle?.setCanvas(canvasRef.current)
    handle?.setCrop(crop ?? null)
  }, [handle, crop])

  useEffect(() => {
    handle?.setPose(expression, parts)
  }, [handle, expression, parts])

  // The canvas's pixel size follows its size on screen.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || typeof ResizeObserver === 'undefined') return
    const resize = () => {
      const density = Math.min(MAX_DENSITY, window.devicePixelRatio || 1)
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * density))
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * density))
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  // The mouth: while this character's line types, or (voiced) while their clip is loud enough.
  useEffect(() => {
    if (!handle || !portrait.talk) return
    let timer: ReturnType<typeof setInterval> | undefined
    const stop = () => {
      if (timer) clearInterval(timer)
      timer = undefined
    }
    const unsubscribe = onTalking((talkers, mode) => {
      stop()
      if (!talkers.includes(id)) return handle.setTalking(false)
      if (mode === 'voice' && voiceLevel(id) !== null) {
        const { threshold, holdMs } = scenes.voice.lipSync
        let openUntil = 0
        timer = setInterval(() => {
          const now = performance.now()
          if ((voiceLevel(id) ?? 0) >= threshold) openUntil = now + holdMs
          handle.setTalking(now < openUntil)
        }, VOICE_FRAME_MS)
      } else handle.setTalking(true)
    })
    return () => {
      unsubscribe()
      stop()
      handle.setTalking(false)
    }
  }, [handle, portrait, id])

  const ratio = crop ? `${crop.w} / ${crop.h}` : `${portrait.width} / ${portrait.height}`
  const size = crop
    ? { width: '100%' }
    : {
        width: maxWidth
          ? `min(${maxWidth}, calc(${height} * ${portrait.width} / ${portrait.height}))`
          : `calc(${height} * ${portrait.width} / ${portrait.height})`,
      }
  return (
    <Box role="img" aria-label={alt} sx={{ ...size, aspectRatio: ratio, position: 'relative' }}>
      <Box
        component="canvas"
        ref={canvasRef}
        data-spine-portrait={id}
        sx={{ display: 'block', width: '100%', height: '100%' }}
      />
    </Box>
  )
}
