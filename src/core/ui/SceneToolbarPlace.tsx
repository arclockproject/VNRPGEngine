// Where the scene toolbar sits: src/content/ui/TextDialog.tsx (with a line) and src/content/ui/Choice.tsx
// (choices without a line) wrap their `toolbar` part in it. Its sx is the content's; this only adds
// the auto-hide of src/content/scenes.ts toolbar.autoHide: the bar slides down and fades out unless
// the mouse is near the bottom of the game screen (or over the bar), keyboard focus is in it, the
// player locked it (Lock button / Settings), or the player uses touch (no hover, so always shown).

import { Box, type SxProps, type Theme } from '@mui/material'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import scenes from '@/content/scenes'
import { useSettingsStore } from '../stores/settings'
import { useSystemStore } from '../stores/system'

/** The toolbar can hide (scenes.ts toolbar.autoHide): it then offers the Lock button. */
export const toolbarAutoHides = (): boolean => scenes.toolbar.autoHide !== null

export function SceneToolbarPlace({ sx, children }: { sx?: SxProps<Theme>; children: ReactNode }) {
  const autoHide = scenes.toolbar.autoHide
  const locked = useSettingsStore((s) => s.toolbarLocked)
  const still = useSettingsStore((s) => s.reduceMotion)
  const touch = useSystemStore((s) => s.device === 'touch')
  const [near, setNear] = useState(false)
  const [focused, setFocused] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!autoHide) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const set = (on: boolean) => {
      clearTimeout(timer)
      if (on) setNear(true)
      else timer = setTimeout(() => setNear(false), autoHide.delay)
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      const r = document.getElementById('game-screen')?.getBoundingClientRect()
      const inZone =
        !!r &&
        e.clientX >= r.left &&
        e.clientX <= r.right &&
        e.clientY <= r.bottom &&
        e.clientY >= r.bottom - autoHide.zone
      const overBar = !!barRef.current && barRef.current.contains(e.target as Node)
      set(inZone || overBar)
    }
    const onLeave = () => set(false)
    window.addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
    }
  }, [autoHide])

  const shown = !autoHide || locked || touch || near || focused
  return (
    <Box sx={sx} data-scene-toolbar>
      <Box
        ref={barRef}
        data-shown={shown}
        // Keyboard / pad focus only: a mouse click also focuses the button, and must not pin it.
        onFocus={(e) => setFocused(e.target.matches(':focus-visible'))}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false)
        }}
        sx={
          autoHide
            ? {
                transition: `transform ${autoHide.ms}ms ease, opacity ${autoHide.ms}ms ease`,
                transform: shown || still ? 'none' : `translateY(${autoHide.slide}px)`,
                opacity: shown ? 1 : 0,
                // Hidden: clicks go through to the scene (the text continues as usual).
                pointerEvents: shown ? 'auto' : 'none',
              }
            : undefined
        }
      >
        {children}
      </Box>
    </Box>
  )
}
