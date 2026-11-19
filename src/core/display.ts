// Applies the fullscreen setting and keeps it in sync with F11 / Esc.
import { input } from './input/manager'
import { isElectron, onFullscreenChange, setFullscreen } from './platform'
import { useSettingsStore } from './stores/settings'

let started = false

export function startDisplay() {
  if (started || typeof window === 'undefined') return
  started = true
  if (useSettingsStore.getState().fullscreen) {
    if (isElectron) {
      void setFullscreen(true)
    } else {
      // Browsers only allow fullscreen during a key press or click: use the title screen press.
      const stop = input.onAnyInput(() => {
        stop()
        void setFullscreen(true)
      })
    }
  }
  onFullscreenChange((on) => {
    if (useSettingsStore.getState().fullscreen !== on) {
      useSettingsStore.setState((s) => {
        s.fullscreen = on
      })
    }
  })
}
