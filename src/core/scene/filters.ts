import scenes from '@/content/scenes'
import type { StageTint } from '../scenes'
import type { SceneFilter } from './types'

/** Preset scene filters (CSS filter values). Add your own here or use filter({ css }). */
export const FILTERS = {
  flashback: 'grayscale(1) sepia(0.35) contrast(1.05)',
  night: 'brightness(0.55) saturate(0.6) hue-rotate(15deg)',
  dream: 'blur(1.5px) saturate(1.5) brightness(1.1)',
  blur: 'blur(6px)',
} as const

// Tints (src/content/scenes.ts `tints`, or filter({ color, strength })) multiply a colour over the
// picture. Plain CSS filters can't do that, so each tint is an SVG colour matrix (TintDefs in
// layers/event/TintDefs.tsx draws them) used as `filter: url(#…)`. Transparent pixels stay
// transparent (alpha is not touched), so portraits keep their edges.

const tints = (scenes.tints ?? {}) as Record<string, StageTint>

/** r, g, b from 0 to 1 of a #rgb, #rrggbb, #rrggbbaa or rgb(…) colour; null = can't read it. */
export function parseColour(colour: string): [number, number, number] | null {
  const hex = /^#([\da-f]{3,8})$/i.exec(colour.trim())?.[1]
  if (hex) {
    const full =
      hex.length <= 4
        ? hex
            .slice(0, 3)
            .split('')
            .map((c) => c + c)
            .join('')
        : hex.slice(0, 6)
    if (full.length !== 6) return null
    return [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16) / 255) as [
      number,
      number,
      number,
    ]
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(colour.trim())
  if (rgb) return [rgb[1], rgb[2], rgb[3]].map((v) => Math.min(1, Number(v) / 255)) as never
  return null
}

/** The tint (or preset) a filter value stands for, as one shape. */
function resolve(value: SceneFilter): StageTint {
  if (typeof value !== 'string') return value
  const tint = tints[value]
  if (tint) return tint
  const preset = (FILTERS as Record<string, string>)[value]
  return preset ? { css: preset } : {}
}

/** The colour matrix's diagonal (r, g, b multipliers) of a tint; null = no colour part. */
export function tintScale(tint: StageTint): [number, number, number] | null {
  if (!tint.color) return null
  const rgb = parseColour(tint.color)
  if (!rgb) {
    console.warn(`[events] tint colour "${tint.color}" is not #rrggbb or rgb(): left out`)
    return null
  }
  const strength = Math.min(1, Math.max(0, tint.strength ?? 1))
  return rgb.map((c) => 1 - strength + strength * c) as [number, number, number]
}

/** The SVG filter id of a colour multiply (the same scale always gives the same id). */
export function tintId(scale: readonly [number, number, number]): string {
  return `tint-${scale.map((v) => Math.round(v * 1000)).join('-')}`
}

/** The CSS `filter` value of a scene filter (undefined = none). */
export function filterCss(value: SceneFilter | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined
  const tint = resolve(value)
  const scale = tintScale(tint)
  const parts = [scale ? `url(#${tintId(scale)})` : '', tint.css ?? ''].filter(Boolean)
  return parts.length ? parts.join(' ') : undefined
}

/**
 * The same for backdrop-filter (the map behind the scene): browsers don't take url() there, so only
 * the `css` part of a tint reaches the map.
 */
export function backdropCss(value: SceneFilter | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined
  return resolve(value).css || undefined
}

/** Every colour multiply these filters need (for TintDefs). */
export function tintScales(
  values: readonly (SceneFilter | null | undefined)[],
): [number, number, number][] {
  const out = new Map<string, [number, number, number]>()
  for (const value of values) {
    if (value === null || value === undefined) continue
    const scale = tintScale(resolve(value))
    if (scale) out.set(tintId(scale), scale)
  }
  return [...out.values()]
}

/** The tint a background variant brings to the characters (src/content/scenes.ts tintByBackground). */
export function backgroundTint(variant: string | undefined): SceneFilter | null {
  const map = scenes.tintByBackground as Partial<Record<string, string>> | undefined
  if (!variant || !map) return null
  // A layered CG's variant can be several toggles: 'crying.full_moon'.
  for (const part of variant.split('.')) {
    const tint = map[part]
    if (tint) return tint as SceneFilter
  }
  return null
}
