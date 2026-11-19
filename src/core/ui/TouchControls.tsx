// The parts of src/content/ui/TouchControls.tsx that the engine needs. Each sx is the content's
// (where it sits, its look); they keep the touch handling.
//   <TouchButton>  presses its action while the finger is down (also when the finger slides off)
//   <Joystick>     the stick: drag from its middle; its size is src/content/config/input.ts
//                  feel.joystick (size, knob)

import { Box, ButtonBase, type SxProps, type Theme } from '@mui/material'
import { type PointerEvent, type ReactNode, useEffect, useRef } from 'react'
import inputConfig from '@/content/config/input'
import { type ActionName, input } from '../input/manager'
import type { TouchButtonInfo } from '../slots'

const BASE = inputConfig.feel.joystick.size
const KNOB = inputConfig.feel.joystick.knob
const asList = (sx?: SxProps<Theme>) => (Array.isArray(sx) ? sx : [sx])

export function TouchButton({
  button,
  sx,
  children,
}: {
  button: TouchButtonInfo
  sx?: SxProps<Theme>
  /** What it shows (default: its label). */
  children?: ReactNode
}) {
  const action = button.action as ActionName
  const up = () => input.touch.release(action)
  // Removed while held (an event or battle started): let go, or it stays pressed.
  useEffect(() => () => input.touch.release(action), [action])
  return (
    <ButtonBase
      aria-label={button.label}
      data-touch-button={button.action}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        input.touch.press(action)
      }}
      onPointerUp={up}
      onPointerCancel={up}
      sx={[{ pointerEvents: 'auto', touchAction: 'none', userSelect: 'none' }, ...asList(sx)]}
    >
      {children ?? button.label}
    </ButtonBase>
  )
}

export function Joystick({ sx, knobSx }: { sx?: SxProps<Theme>; knobSx?: SxProps<Theme> }) {
  const knob = useRef<HTMLDivElement>(null)
  const centre = useRef<{ x: number; y: number } | null>(null)

  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!centre.current || !knob.current) return
    const radius = BASE / 2
    let dx = e.clientX - centre.current.x
    let dy = e.clientY - centre.current.y
    const length = Math.hypot(dx, dy)
    if (length > radius) {
      dx = (dx / length) * radius
      dy = (dy / length) * radius
    }
    // Written straight to the DOM: no React re-render while dragging.
    knob.current.style.transform = `translate(${dx}px, ${dy}px)`
    input.touch.setStick(dx / radius, dy / radius)
  }
  const end = () => {
    centre.current = null
    if (knob.current) knob.current.style.transform = ''
    input.touch.setStick(0, 0)
  }
  // Removed while held (an event or battle started): no pointerup will come, so centre it.
  useEffect(() => () => input.touch.setStick(0, 0), [])

  return (
    <Box
      data-joystick
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        const rect = e.currentTarget.getBoundingClientRect()
        centre.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        move(e)
      }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      sx={[
        {
          width: BASE,
          height: BASE,
          display: 'grid',
          placeItems: 'center',
          pointerEvents: 'auto',
          touchAction: 'none',
        },
        ...asList(sx),
      ]}
    >
      <Box ref={knob} sx={[{ width: KNOB, height: KNOB }, ...asList(knobSx)]} />
    </Box>
  )
}
