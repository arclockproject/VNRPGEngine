// A colour over the map (day/night, caves), light sources and weather particles. Drawn in screen
// space over the map, under labels and prompts.
import { AlphaFilter, Container, Graphics, Sprite, Texture } from 'pixi.js'
import weather from '@/content/weather'
import type { WeatherKind } from '../define'
import { mixColor } from '../scene/color'
import { WeatherField, type WeatherLook, weatherColors } from '../weather'

/** A light in screen pixels (World works these out from objects each frame). */
export interface ScreenLight {
  x: number
  y: number
  radius: number
  color: string
  intensity: number
  flicker: number
  /** Keeps each light's flicker different. */
  seed: number
}

let lightTexture: Texture | undefined
/** A soft white dot (opaque centre, fading to nothing at the edge), made once. */
function softDot(): Texture {
  if (lightTexture) return lightTexture
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.45, 'rgba(255,255,255,0.75)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)
  }
  lightTexture = Texture.from(canvas)
  return lightTexture
}

/** Smooth wobble in 0..1 for flickering lights. */
const wobble = (t: number, seed: number) =>
  0.5 + 0.3 * Math.sin(t * 9.1 + seed) + 0.2 * Math.sin(t * 23.7 + seed * 2.3)

export class Atmosphere {
  readonly view = new Container()
  /** Darkness and the holes lights cut in it. Has a filter so "erase" only affects this layer. */
  private readonly darkness = new Container()
  private readonly shade = new Graphics()
  private readonly holes: Sprite[] = []
  /** Coloured glow added on top of the darkness. */
  private readonly glow = new Container()
  private readonly glows: Sprite[] = []
  private readonly particles = new Graphics()
  private color = '#000000'
  private strength = 0
  private fade: {
    from: { color: string; strength: number }
    to: { color: string; strength: number }
    start: number
    duration: number
  } | null = null
  private kind: WeatherKind | null = null
  private readonly field = new WeatherField()
  private width = 0
  private height = 0

  constructor() {
    this.darkness.addChild(this.shade)
    this.darkness.filters = [new AlphaFilter({ alpha: 1 })]
    this.view.addChild(this.darkness, this.glow, this.particles)
  }

  /** Colour over everything (null = none). Fades over `duration` ms. */
  setTint(color: string | null, strength: number, duration = 0) {
    const to = { color: color ?? this.color, strength: color ? strength : 0 }
    if (duration <= 0) {
      this.fade = null
      this.color = to.color
      this.strength = to.strength
      return
    }
    this.fade = {
      from: { color: this.color, strength: this.strength },
      to,
      start: performance.now(),
      duration,
    }
  }

  setWeather(kind: WeatherKind | null, intensity = weather.defaultIntensity) {
    this.kind = kind
    const looks = weather.kinds as Record<string, WeatherLook>
    this.field.set(kind ? (looks[kind] ?? null) : null, intensity)
  }

  get weather() {
    return this.kind
  }

  /** `scroll` = how far the camera moved this frame (screen pixels), so weather stays in the world. */
  update(
    dt: number,
    width: number,
    height: number,
    scroll: { x: number; y: number },
    lights: readonly ScreenLight[] = [],
  ) {
    if (this.fade) {
      const t = Math.min(1, (performance.now() - this.fade.start) / this.fade.duration)
      this.color = mixColor(this.fade.from.color, this.fade.to.color, t)
      this.strength =
        this.fade.from.strength + (this.fade.to.strength - this.fade.from.strength) * t
      if (t >= 1) this.fade = null
    }
    if (width !== this.width || height !== this.height) {
      this.width = width
      this.height = height
    }
    this.shade.clear()
    // Daylight: skip the layer (and its filter pass) entirely.
    this.darkness.visible = this.strength > 0.001
    if (this.strength > 0.001) {
      this.shade.rect(0, 0, width, height).fill({ color: this.color, alpha: this.strength })
    }
    this.updateLights(lights)
    this.updateWeather(dt, scroll)
  }

  private updateLights(lights: readonly ScreenLight[]) {
    const dark = this.strength > 0.02
    const shown = dark ? lights : []
    const t = performance.now() / 1000
    while (this.holes.length < shown.length) {
      const hole = new Sprite(softDot())
      hole.anchor.set(0.5)
      hole.blendMode = 'erase'
      this.darkness.addChild(hole)
      this.holes.push(hole)
      const glow = new Sprite(softDot())
      glow.anchor.set(0.5)
      glow.blendMode = 'add'
      this.glow.addChild(glow)
      this.glows.push(glow)
    }
    this.holes.forEach((hole, i) => {
      const light = shown[i]
      const glow = this.glows[i] as Sprite
      hole.visible = glow.visible = light !== undefined
      if (!light) return
      const flick = light.flicker > 0 ? 1 - light.flicker * wobble(t, light.seed) : 1
      const size = light.radius * 2 * (0.94 + 0.06 * flick)
      hole.position.set(light.x, light.y)
      hole.width = hole.height = size
      hole.alpha = Math.min(1, light.intensity * flick)
      glow.position.set(light.x, light.y)
      glow.width = glow.height = size * 0.8
      glow.tint = light.color
      glow.alpha = Math.min(1, this.strength * light.intensity * flick * 0.5)
    })
  }

  private updateWeather(dt: number, scroll: { x: number; y: number }) {
    const g = this.particles
    g.clear()
    this.field.update(dt, this.width, this.height, scroll)
    const look = this.field.current
    if (!look) return
    const colors = weatherColors(look)
    for (let c = 0; c < colors.length; c++) {
      let any = false
      for (const p of this.field.particles) {
        if (p.color !== c) continue
        any = true
        if (look.shape === 'streak') {
          const length = Math.hypot(p.drift, p.speed) || 1
          g.moveTo(p.x, p.y).lineTo(
            p.x - (p.drift / length) * p.size,
            p.y - (p.speed / length) * p.size,
          )
        } else if (look.shape === 'dot') {
          g.circle(p.x, p.y, p.size)
        } else {
          const a = this.field.angle(p)
          g.ellipse(p.x, p.y, p.size, p.size * 0.5 * Math.abs(Math.cos(a * 0.7)) + 0.5)
        }
      }
      if (!any) continue
      if (look.shape === 'streak')
        g.stroke({ color: colors[c], alpha: look.alpha, width: look.width ?? 1.5 })
      else g.fill({ color: colors[c], alpha: look.alpha })
    }
  }
}
