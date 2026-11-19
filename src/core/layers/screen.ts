// The game screen: one box, letterboxed to the player's chosen ratio (Settings → Screen ratio).
// Everything inside sizes itself to this box, not to the browser window: use 100cqw / 100cqh
// (container units) instead of 100vw / 100dvh, and SHORT_SCREEN instead of a height @media query.
// The values (ratios, bar colour, image viewer zoom...) live in src/content/config/screen.ts.
import { useSyncExternalStore } from 'react'
import screen from '@/content/config/screen'
import type { ScreenRatio } from '../screen'

/** The game screen element (null before GameRoot mounts). Portal full-screen overlays into it. */
export function gameScreen(): HTMLElement | null {
  return document.getElementById('game-screen')
}

/** sx key for styles used while the game screen is short (see `shortHeight`). */
export const SHORT_SCREEN = '[data-short] &'

function watchShort(onChange: () => void): () => void {
  const el = gameScreen()
  if (!el) return () => {}
  const observer = new MutationObserver(onChange)
  observer.observe(el, { attributes: true, attributeFilter: ['data-short'] })
  return () => observer.disconnect()
}

/** Whether the game screen is short right now (same test as SHORT_SCREEN), for layouts built in code. */
export function useShortScreen(): boolean {
  return useSyncExternalStore(watchShort, () => gameScreen()?.hasAttribute('data-short') ?? false)
}

/** A stored ratio if it is still offered, else the default. */
export function validRatio(ratio: unknown): ScreenRatio {
  return screen.ratios.includes(ratio as ScreenRatio) ? (ratio as ScreenRatio) : screen.defaultRatio
}

/** CSS width/height of the game screen for a ratio (largest box that fits the window). */
export function screenSize(ratio: ScreenRatio): { width: string; height: string } {
  if (ratio === 'fill') return { width: '100dvw', height: '100dvh' }
  const [w, h] = ratio.split(':').map(Number)
  return {
    width: `min(100dvw, calc(100dvh * ${w} / ${h}))`,
    height: `min(100dvh, calc(100dvw * ${h} / ${w}))`,
  }
}

/** A stored cursor auto-hide time if it is still offered, else the default. */
export function validCursorAutoHide(seconds: unknown): number {
  return screen.cursorAutoHide.includes(seconds as number)
    ? (seconds as number)
    : screen.defaultCursorAutoHide
}
