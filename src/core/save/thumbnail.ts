// The small picture in a save slot: the game screen as the player sees it (the map plus the scene
// or HUD drawn over it), without windows, touch buttons or the black bars around the screen.
import { peekWorld } from '../world/getWorld'

/** Layers that belong in the picture carry this attribute (EventLayer, HudLayer). */
export const CAPTURE_ATTRIBUTE = 'data-capture'

export interface ThumbnailOptions {
  /** Width in px; the height follows the shape of the game screen. */
  width: number
  /** JPEG quality, 0..1. */
  quality: number
}

export const DEFAULT_THUMBNAIL: ThumbnailOptions = { width: 256, quality: 0.72 }

const screenElement = () =>
  typeof document === 'undefined' ? null : document.getElementById('game-screen')

/** At once: the map only. Used right away, so a save always has a picture. */
export function mapThumbnail(options: ThumbnailOptions): string | null {
  try {
    const map = peekWorld()?.screenCanvas()
    if (!map || map.width === 0) return null
    const canvas = document.createElement('canvas')
    canvas.width = options.width
    canvas.height = Math.max(1, Math.round((options.width * map.height) / map.width))
    canvas.getContext('2d')?.drawImage(map, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', options.quality)
  } catch (error) {
    console.warn('[save] map picture failed', error)
    return null
  }
}

/** Whether something is drawn over the map that mapThumbnail() misses (a scene, the HUD). */
export function hasOverlay(): boolean {
  return !!screenElement()?.querySelector(`:scope > [${CAPTURE_ATTRIBUTE}]`)
}

/**
 * The whole game screen: the map with the scene / HUD layers on top. Slower (the page is redrawn
 * into a picture), so it replaces the map-only picture a moment after saving. Null if it fails.
 */
export async function screenThumbnail(options: ThumbnailOptions): Promise<string | null> {
  const screen = screenElement()
  if (!screen || screen.clientWidth === 0) return null
  try {
    // Taken first, in the same frame as the save, before anything moves on.
    const map = peekWorld()?.screenCanvas() ?? null
    const { domToCanvas } = await import('modern-screenshot')
    const scale = options.width / screen.clientWidth
    const overlay = await domToCanvas(screen, {
      scale,
      backgroundColor: null,
      // Only the marked layers: no windows, touch buttons, toasts, dev panel. The map canvas is
      // WebGL (can't be copied later), so it is drawn from `map` instead.
      filter: (node) =>
        !(node instanceof Element) ||
        node.parentElement !== screen ||
        node.hasAttribute(CAPTURE_ATTRIBUTE),
      style: { position: 'static', margin: '0', background: 'transparent' },
    })
    const canvas = document.createElement('canvas')
    canvas.width = options.width
    canvas.height = Math.max(1, Math.round(screen.clientHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) return null
    context.fillRect(0, 0, canvas.width, canvas.height)
    if (map && map.width > 0) context.drawImage(map, 0, 0, canvas.width, canvas.height)
    context.drawImage(overlay, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', options.quality)
  } catch (error) {
    console.warn('[save] screen picture failed', error)
    return null
  }
}
