// Reading comfort: the font the player picked (Settings → Text → Font), or the language's own.
// The whole UI uses the CSS variable --game-font (see boot.tsx); without it, the look's font.
import { effectiveFont, FONT_CHOICES } from './fontList'
import { useLangStore } from './lang'
import { useSettingsStore } from './stores/settings'

const fonts = FONT_CHOICES

/** The CSS font-family in use besides the game's own font, or null. The player's choice wins. */
export function chosenFont(): string | null {
  return (
    fonts[effectiveFont(useSettingsStore.getState().font)]?.family ??
    useLangStore.getState().font ??
    null
  )
}

let started = false

export function startComfort(): void {
  if (started || typeof document === 'undefined') return
  started = true
  const apply = () => {
    const family = chosenFont()
    const root = document.documentElement
    if (family) root.style.setProperty('--game-font', family)
    else root.style.removeProperty('--game-font')
  }
  apply()
  useSettingsStore.subscribe((s, previous) => {
    if (s.font !== previous.font) apply()
  })
  useLangStore.subscribe(apply)
}
