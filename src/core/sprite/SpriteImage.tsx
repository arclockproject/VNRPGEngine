// An Aseprite sprite sheet drawn as a plain DOM element (battle screen, windows). Frames are written
// straight to the element's style each animation frame, never through React state.
import { type CSSProperties, useEffect, useRef } from 'react'
import type { Facing } from '../define'
import { useLangStore } from '../lang'
import { frameAt, idleAnimation, pickAnimation } from './anim'
import { type AsepriteSpriteData, spriteSheet } from './types'

export interface SpriteImageProps {
  data: AsepriteSpriteData
  /** Animation state to play ('idle', 'hurt', 'attack'…). Missing ones play idle. */
  state?: string
  facing?: Facing
  /** Screen pixels per sprite pixel. */
  scale?: number
  /** Change it to play `state` again from the start (e.g. a hit counter). */
  replay?: number
  /** Keep the last frame once a non-looping `state` ends (e.g. 'down'). Default: back to idle. */
  hold?: boolean
  style?: CSSProperties
}

export function SpriteImage({
  data,
  state = 'idle',
  facing = 'down',
  scale = 4,
  replay = 0,
  hold = false,
  style,
}: SpriteImageProps) {
  const ref = useRef<HTMLDivElement>(null)
  // The language's own sheet (layers named "<name>.<lang>"), redrawn when the language changes.
  const language = useLangStore((s) => s.id)

  // biome-ignore lint/correctness/useExhaustiveDependencies: replay only restarts the animation
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const names = Object.keys(data.animations)
    const idle = idleAnimation(names, facing)
    let current = (state === 'idle' ? idle : pickAnimation(names, state, facing)) ?? idle
    if (!current) return
    let start = performance.now()
    let raf = 0
    const draw = (now: number) => {
      if (!current) return
      const anim = data.animations[current.name]
      if (!anim) return
      let { cell, done } = frameAt(anim, now - start)
      if (done && !hold && idle && current.name !== idle.name) {
        current = idle
        start = now
        cell = frameAt(data.animations[idle.name] ?? anim, 0).cell
        done = false
      }
      const [x = 0, y = 0] = data.cells[cell] ?? []
      el.style.backgroundPosition = `${-x * scale}px ${-y * scale}px`
      el.style.transform = current.flip ? 'scaleX(-1)' : ''
      if (!done) raf = requestAnimationFrame(draw)
    }
    draw(start)
    return () => cancelAnimationFrame(raf)
  }, [data, state, facing, scale, replay, hold])

  return (
    <div
      ref={ref}
      style={{
        width: data.box.w * scale,
        height: data.box.h * scale,
        backgroundImage: `url(${spriteSheet(data, language)})`,
        backgroundSize: `${data.sheetWidth * scale}px ${data.sheetHeight * scale}px`,
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
        ...style,
      }}
    />
  )
}
