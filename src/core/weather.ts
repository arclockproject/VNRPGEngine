// Weather particles (rain, snow, petals…): the types for src/content/weather.ts and the small
// simulation both drawers share (the map's Pixi layer and the event stage's canvas).
// Must not import content (content/weather.ts imports this file).

/** A range [from, to]: each particle gets a random value in it. A single number = always that. */
export type Range = number | readonly [number, number]

export interface WeatherLook {
  /**
   * 'streak' = a line along its fall (rain), 'dot' = a round flake (snow, dust, fireflies),
   * 'petal' = a small turning oval (petals, leaves).
   */
  shape: 'streak' | 'dot' | 'petal'
  /** Particles per million screen pixels at intensity 1. */
  perMegapixel: number
  /** Fall speed, screen pixels per second (negative = rising, e.g. embers). */
  speed: Range
  /** Sideways speed, pixels per second (negative = to the left). */
  drift: Range
  /** Length of a streak / radius of a dot / half-length of a petal, in pixels. */
  size: Range
  /** Side to side swing in pixels per second (snow, petals). 0 = straight. */
  sway?: number
  /** CSS colour. A list = each particle picks one. */
  color: string | readonly string[]
  /** 0..1. */
  alpha: number
  /** Line width of streaks, pixels. Default 1.5. */
  width?: number
}

export interface WeatherConfig<K extends string> {
  kinds: Record<K, WeatherLook>
  /** Used when a map or scene names a kind without an intensity (0..1). */
  defaultIntensity: number
}

export function defineWeather<const K extends string>(config: WeatherConfig<K>): WeatherConfig<K> {
  return config
}

export interface Particle {
  x: number
  y: number
  speed: number
  drift: number
  size: number
  /** Index into the look's colour list. */
  color: number
  /** 0..1, each particle's own: phase of its sway and turn. */
  seed: number
}

const pick = (range: Range, random: () => number): number =>
  typeof range === 'number' ? range : range[0] + (range[1] - range[0]) * random()

export const weatherColors = (look: WeatherLook): readonly string[] =>
  typeof look.color === 'string' ? [look.color] : look.color

/** Particles of one weather kind on a screen-sized area. No drawing: see `particles`. */
export class WeatherField {
  particles: Particle[] = []
  private look: WeatherLook | null = null
  private intensity = 0
  private width = 0
  private height = 0
  private time = 0
  private readonly random: () => number

  constructor(random: () => number = Math.random) {
    this.random = random
  }

  set(look: WeatherLook | null, intensity: number) {
    if (look !== this.look) this.particles = []
    this.look = look
    this.intensity = Math.max(0, Math.min(1, intensity))
  }

  get current(): WeatherLook | null {
    return this.intensity > 0 ? this.look : null
  }

  /** `scroll` = how far the view moved this frame (pixels), so particles stay in the world. */
  update(dt: number, width: number, height: number, scroll = { x: 0, y: 0 }) {
    this.width = width
    this.height = height
    this.time += dt
    const look = this.current
    if (!look) {
      this.particles.length = 0
      return
    }
    const wanted = Math.round(((width * height) / 1_000_000) * look.perMegapixel * this.intensity)
    while (this.particles.length < wanted) this.particles.push(this.spawn(look, true))
    if (this.particles.length > wanted) this.particles.length = wanted
    const sway = look.sway ?? 0
    for (const p of this.particles) {
      p.x += p.drift * dt + scroll.x
      p.y += p.speed * dt + scroll.y
      if (sway) p.x += Math.sin(this.time * 1.7 + p.seed * 6.283) * sway * dt
      if (p.y > height + 40 || p.y < -80 || p.x < -60 || p.x > width + 60)
        Object.assign(p, this.spawn(look, false))
    }
  }

  /** A petal's turn right now, radians. */
  angle(p: Particle): number {
    return this.time * (1 + p.seed * 2) + p.seed * 6.283
  }

  private spawn(look: WeatherLook, anywhere: boolean): Particle {
    const speed = pick(look.speed, this.random)
    const rising = speed < 0
    const edge = rising ? this.height + 20 + this.random() * 20 : -20 - this.random() * 40
    return {
      x: this.random() * (this.width + 120) - 60,
      y: anywhere ? this.random() * this.height : edge,
      speed,
      drift: pick(look.drift, this.random),
      size: pick(look.size, this.random),
      color: Math.floor(this.random() * weatherColors(look).length),
      seed: this.random(),
    }
  }
}

/** Draws a field on a 2D canvas (the event stage; the map draws with Pixi in world/atmosphere.ts). */
export function drawWeather(ctx: CanvasRenderingContext2D, field: WeatherField): void {
  const look = field.current
  if (!look) return
  const colors = weatherColors(look)
  ctx.globalAlpha = look.alpha
  for (let c = 0; c < colors.length; c++) {
    ctx.fillStyle = ctx.strokeStyle = colors[c] as string
    ctx.lineWidth = look.width ?? 1.5
    ctx.beginPath()
    for (const p of field.particles) {
      if (p.color !== c) continue
      if (look.shape === 'streak') {
        const length = Math.hypot(p.drift, p.speed) || 1
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(p.x - (p.drift / length) * p.size, p.y - (p.speed / length) * p.size)
      } else if (look.shape === 'dot') {
        ctx.moveTo(p.x + p.size, p.y)
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      } else {
        const a = field.angle(p)
        ctx.moveTo(p.x + Math.cos(a) * p.size, p.y + Math.sin(a) * p.size)
        ctx.ellipse(
          p.x,
          p.y,
          p.size,
          p.size * 0.5 * Math.abs(Math.cos(a * 0.7)) + 0.5,
          a,
          0,
          Math.PI * 2,
        )
      }
    }
    if (look.shape === 'streak') ctx.stroke()
    else ctx.fill()
  }
  ctx.globalAlpha = 1
}
