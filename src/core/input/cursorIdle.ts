// Hides the mouse cursor after it sits still for settings.cursorAutoHide seconds (0 = never).
// Separate from the gamepad hide in manager.ts (html[data-hide-cursor]): this one uses its own
// attribute, so either can hide the cursor without the other un-hiding it.
// Only mouse events arm the timer, so touch screens never get the attribute.
import { useSettingsStore } from '../stores/settings'

const ATTR = 'data-idle-cursor'
let timer: ReturnType<typeof setTimeout> | undefined
let started = false

function arm() {
  clearTimeout(timer)
  document.documentElement.removeAttribute(ATTR)
  const seconds = useSettingsStore.getState().cursorAutoHide
  if (seconds > 0) {
    timer = setTimeout(() => document.documentElement.setAttribute(ATTR, ''), seconds * 1000)
  }
}

function onPointer(e: PointerEvent) {
  if (e.pointerType === 'mouse') arm()
}

export function startCursorIdle() {
  if (started || typeof window === 'undefined') return
  started = true
  const style = document.createElement('style')
  style.textContent = `html[${ATTR}], html[${ATTR}] * { cursor: none !important; }`
  document.head.append(style)
  window.addEventListener('pointermove', onPointer, { passive: true })
  window.addEventListener('pointerdown', onPointer, { capture: true, passive: true })
  useSettingsStore.subscribe((s, prev) => {
    if (s.cursorAutoHide !== prev.cursorAutoHide) arm()
  })
  // A mouse is likely: start counting now, so a cursor left still from launch hides too.
  if (window.matchMedia?.('(pointer: fine)').matches) arm()
}
