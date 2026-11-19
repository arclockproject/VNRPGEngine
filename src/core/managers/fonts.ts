// The font the player picked (Settings → Text → Font): useFont() in React, game.fonts outside.
// For content that changes with the font: `useFont() === 'pixel' ? smallIcon : icon`.
import {
  effectiveFont,
  FONT_CHOICES,
  type FontId,
  PLAYER_PICKS_FONT,
  withFallbacks,
} from '../fontList'
import { useSettingsStore } from '../stores/settings'

export type { FontId } from '../fontList'

const valid = (id: string) => effectiveFont(id) as FontId

/** React: the id of the font in use; re-renders when the player picks another. */
export function useFont(): FontId {
  return useSettingsStore((s) => valid(s.font))
}

export const fonts = {
  /** The id of the font in use (a key of scenes.ts `text.fonts` or of src/content/fonts). */
  current(): FontId {
    return valid(useSettingsStore.getState().font)
  },

  /** Whether the player can pick a font (scenes.ts `text.playerPicksFont`): the Settings Font row. */
  playerPicks(): boolean {
    return PLAYER_PICKS_FONT
  },

  /** Every font the player can pick, in order: id, name (translated with t()), CSS family. */
  choices(): { id: FontId; name: string; family: string | null }[] {
    return Object.entries(FONT_CHOICES).map(([id, choice]) => ({
      id: id as FontId,
      name: choice.name,
      family: choice.family ? withFallbacks(choice.family) : null,
    }))
  },
}
