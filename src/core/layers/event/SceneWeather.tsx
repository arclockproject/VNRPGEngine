// Weather over the event stage (weather('snow')): the same particles as on maps
// (src/content/weather.ts), drawn on a canvas.
import { Box } from '@mui/material'
import { useEffect, useRef } from 'react'
import weatherConfig from '@/content/weather'
import type { SceneState } from '../../scene/state'
import { drawWeather, WeatherField, type WeatherLook } from '../../weather'

export function SceneWeather({ weather }: { weather: NonNullable<SceneState['weather']> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fieldRef = useRef<WeatherField | null>(null)
  const { kind, intensity } = weather

  useEffect(() => {
    fieldRef.current ??= new WeatherField()
    const look = (weatherConfig.kinds as Record<string, WeatherLook>)[kind] ?? null
    fieldRef.current.set(look, intensity)
  }, [kind, intensity])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      // A hidden tab hands back one huge step: cap it.
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      if (width === 0 || height === 0) return
      const ratio = Math.min(2, window.devicePixelRatio || 1)
      if (
        canvas.width !== Math.round(width * ratio) ||
        canvas.height !== Math.round(height * ratio)
      ) {
        canvas.width = Math.round(width * ratio)
        canvas.height = Math.round(height * ratio)
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
      ctx.clearRect(0, 0, width, height)
      const field = fieldRef.current
      if (!field) return
      field.update(dt, width, height)
      drawWeather(ctx, field)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <Box
      component="canvas"
      ref={canvasRef}
      aria-hidden
      sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  )
}
