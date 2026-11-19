// Self-voicing: reads lines, choices and focused buttons aloud with the device's speech synthesis
// (Settings → Text → "Read text aloud"). Not every device has it (Android's WebView has none):
// `selfVoicing.supported` says so, and the setting is hidden where it is false.
import { useLangStore } from './lang'
import { useSettingsStore } from './stores/settings'

const synth = (): SpeechSynthesis | null =>
  typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined'
    ? null
    : speechSynthesis

const enabled = () => useSettingsStore.getState().selfVoicing && synth() !== null

let started = false
let lastFocused = ''

export const selfVoicing = {
  get supported(): boolean {
    return synth() !== null
  },

  /** Says `text` if the setting is on. `interrupt: false` queues it after what is being said. */
  speak(text: string, options: { interrupt?: boolean } = {}): void {
    const engine = synth()
    if (!engine || !enabled() || !text.trim()) return
    if (options.interrupt !== false) engine.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = useLangStore.getState().locale
    utterance.volume = useSettingsStore.getState().volume.master
    engine.speak(utterance)
  },

  stop(): void {
    synth()?.cancel()
  },

  /** Reads the focused button, tab, slider or list row aloud (keyboard and gamepad navigation). */
  start(): void {
    if (started || typeof document === 'undefined') return
    started = true
    document.addEventListener('focusin', (event) => {
      if (!enabled()) return
      const el = event.target
      if (!(el instanceof HTMLElement)) return
      const label = (
        el.getAttribute('aria-label') ??
        el.getAttribute('aria-valuetext') ??
        el.textContent ??
        ''
      ).trim()
      if (!label || label === lastFocused) return
      lastFocused = label
      selfVoicing.speak(label)
    })
    document.addEventListener('focusout', () => {
      lastFocused = ''
    })
    useSettingsStore.subscribe((s, previous) => {
      if (previous.selfVoicing && !s.selfVoicing) selfVoicing.stop()
    })
  },
}
