// A small map of where the player is: walls, doors, characters, the player. Put <Minimap /> in
// src/content/ui/Hud.tsx. Settings and colours: src/content/config/screen.ts `minimap`.
// It is drawn on a canvas a few times a second, not through React.
import { Box, type SxProps, type Theme } from '@mui/material'
import { useEffect, useRef } from 'react'
import screen from '@/content/config/screen'
import { useSettingsStore } from '../stores/settings'
import { useSystemStore } from '../stores/system'
import { peekWorld } from '../world/getWorld'
import { minimapView } from './minimapView'

const REDRAW_MS = 100

export function Minimap({ sx }: { sx?: SxProps<Theme> }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const config = screen.minimap
  const mapId = useSystemStore((s) => s.map?.id)
  // The game's switch (screen.ts minimap.show) first; while it is on, the player's (Settings).
  const playerOn = useSettingsStore((s) => s.showMinimap)
  const on = config.show && playerOn

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new map restarts the drawing
  useEffect(() => {
    if (!on) return
    const draw = () => {
      const element = canvas.current
      const data = peekWorld()?.minimap()
      if (!element) return
      if (!data || data.hidden) {
        element.style.display = 'none'
        return
      }
      element.style.display = 'block'
      const view = minimapView(data.width, data.height, data.player, config.size, config.radius)
      const ratio = Math.min(2, window.devicePixelRatio || 1)
      const w = Math.round(view.width * ratio)
      const h = Math.round(view.height * ratio)
      if (element.width !== w || element.height !== h) {
        element.width = w
        element.height = h
        element.style.width = `${view.width}px`
        element.style.height = `${view.height}px`
      }
      const ctx = element.getContext('2d')
      if (!ctx) return
      const s = view.scale * ratio
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.fillStyle = config.colors.ground
      ctx.clearRect(0, 0, w, h)
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = config.colors.wall
      const x0 = Math.floor(view.x)
      const y0 = Math.floor(view.y)
      for (let y = y0; y < Math.min(data.height, y0 + view.h + 1); y++)
        for (let x = x0; x < Math.min(data.width, x0 + view.w + 1); x++)
          if (data.solid[y * data.width + x])
            ctx.fillRect((x - view.x) * s, (y - view.y) * s, Math.ceil(s), Math.ceil(s))
      const dot = (at: { x: number; y: number }, colour: string, size: number) => {
        ctx.fillStyle = colour
        ctx.beginPath()
        ctx.arc((at.x - view.x) * s, (at.y - view.y) * s, size * ratio, 0, Math.PI * 2)
        ctx.fill()
      }
      const small = Math.max(1.5, view.scale * 0.35)
      if (config.doors) for (const door of data.doors) dot(door, config.colors.door, small)
      if (config.actors) for (const actor of data.actors) dot(actor, config.colors.actor, small)
      dot(data.player, config.colors.player, Math.max(2, view.scale * 0.45))
    }
    draw()
    const timer = setInterval(draw, REDRAW_MS)
    return () => clearInterval(timer)
  }, [mapId, config, on])

  if (!on) return null
  return (
    <Box
      component="canvas"
      ref={canvas}
      aria-hidden
      sx={{
        display: 'none',
        borderRadius: 1,
        opacity: config.opacity,
        pointerEvents: 'none',
        imageRendering: 'pixelated',
        ...sx,
      }}
    />
  )
}
