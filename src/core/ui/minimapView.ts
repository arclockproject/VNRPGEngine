// Pure maths for the minimap: which part of the map is shown and how big a tile is drawn.

export interface MinimapView {
  /** First tile shown (may be fractional: the view follows the player smoothly). */
  x: number
  y: number
  /** Tiles shown. */
  w: number
  h: number
  /** Screen px per tile. */
  scale: number
  /** Canvas size, px. */
  width: number
  height: number
}

/**
 * The part of a `mapW` × `mapH` map shown on a minimap whose longest side is `size` px.
 * radius 0 (or a map smaller than the window) = the whole map; else a window of 2 × radius tiles
 * around the player, kept inside the map.
 */
export function minimapView(
  mapW: number,
  mapH: number,
  player: { x: number; y: number },
  size: number,
  radius: number,
): MinimapView {
  const span = radius > 0 ? radius * 2 : Number.POSITIVE_INFINITY
  const w = Math.min(mapW, span)
  const h = Math.min(mapH, span)
  const clamp = (value: number, max: number) => Math.min(Math.max(0, value), Math.max(0, max))
  const scale = size / Math.max(w, h, 1)
  return {
    x: clamp(player.x - w / 2, mapW - w),
    y: clamp(player.y - h / 2, mapH - h),
    w,
    h,
    scale,
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  }
}
