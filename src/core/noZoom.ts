// The game page never zooms (browser, Electron, Android). CSS touch-action (boot.tsx) and the
// viewport meta (index.html) stop most of it; this covers what they can't.

const ZOOM_KEYS = new Set(['Equal', 'Minus', 'NumpadAdd', 'NumpadSubtract', 'Digit0', 'Numpad0'])

export function startNoZoom() {
  // No browser right-click / long-press menu (save image, view source...). Only the default is
  // cancelled, the event still reaches the game, so onContextMenu handlers keep working.
  window.addEventListener('contextmenu', (e) => e.preventDefault(), { capture: true })
  // Ctrl + wheel, and trackpad pinch (Chrome sends it as a ctrl wheel).
  window.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault()
    },
    { passive: false, capture: true },
  )
  // Ctrl/Cmd + plus / minus / 0.
  window.addEventListener(
    'keydown',
    (e) => {
      if ((e.ctrlKey || e.metaKey) && ZOOM_KEYS.has(e.code)) e.preventDefault()
    },
    { capture: true },
  )
  // iOS Safari ignores user-scalable=no; its pinch comes as gesture events.
  for (const type of ['gesturestart', 'gesturechange']) {
    document.addEventListener(type, (e) => e.preventDefault(), { passive: false })
  }
}
