// Every font the player can pick, and the game's own font files (src/content/fonts) loaded at start.
// No settings here (the settings store imports this file): the current font is managers/fonts.ts.
import gameFonts from '@/content/fonts'
import scenes from '@/content/scenes'
import type { GameFont } from './fonts'
import type { FontChoice } from './scenes'

const own = gameFonts as Partial<Record<string, GameFont>>
const ownEntries = Object.entries(own).filter((entry): entry is [string, GameFont] => !!entry[1])

/** A font id the player can have picked: scenes.ts `text.fonts`, or a font of src/content/fonts. */
export type FontId = Extract<keyof typeof scenes.text.fonts | keyof typeof gameFonts, string>

/** A family name as CSS (quoted, so ids like "my font" or "emoji" are never read as keywords). */
const css = (family: string) => `"${family.replace(/["\\]/g, '')}"`
const familyOf = (id: string, font: GameFont) => font.family ?? id

/** The 'fallback' fonts as a CSS list ('' when there are none). */
export const FALLBACK_FONTS = [
  ...new Set(
    ownEntries.filter(([, font]) => font.use === 'fallback').map(([id, f]) => css(familyOf(id, f))),
  ),
].join(', ')

/** A CSS font-family list with the 'fallback' fonts after it. */
export function withFallbacks(family: string): string {
  return FALLBACK_FONTS ? `${family}, ${FALLBACK_FONTS}` : family
}

function buildChoices(): Record<string, FontChoice> {
  const choices: Record<string, FontChoice> = {
    ...(scenes.text.fonts as Record<string, FontChoice>),
  }
  const listed = new Set<string>()
  for (const [id, font] of ownEntries) {
    // Fallback and internal fonts are never picked.
    if ((font.use ?? 'choice') !== 'choice') continue
    const family = familyOf(id, font)
    // A bold / italic file of a family already listed adds no new choice.
    if (listed.has(family)) continue
    listed.add(family)
    if (id in choices) {
      console.warn(`[fonts] "${id}" is also in scenes.ts text.fonts: that one is used`)
      continue
    }
    choices[id] = { name: font.name, family: `${css(family)}, sans-serif` }
  }
  return choices
}

/** Settings → Text → Font, in order: scenes.ts `text.fonts`, then the folder's 'choice' fonts. */
export const FONT_CHOICES: Readonly<Record<string, FontChoice>> = buildChoices()

/** The first choice: what new players get. */
export const DEFAULT_FONT = Object.keys(FONT_CHOICES)[0] ?? ''

/** Whether Settings has a Font row (scenes.ts `text.playerPicksFont`, default true). */
export const PLAYER_PICKS_FONT = scenes.text.playerPicksFont !== false

/** The font in use for a stored choice: the default when picking is off or the id is gone. */
export function effectiveFont(stored: string): string {
  return PLAYER_PICKS_FONT && stored in FONT_CHOICES ? stored : DEFAULT_FONT
}

let started = false

/** Registers and loads every file of src/content/fonts (once, at start). */
export function loadGameFonts(): void {
  if (started || typeof document === 'undefined' || typeof FontFace === 'undefined') return
  started = true
  for (const [id, font] of ownEntries) {
    try {
      const face = new FontFace(familyOf(id, font), `url("${font.file}")`, {
        ...(font.weight ? { weight: font.weight } : {}),
        ...(font.style ? { style: font.style } : {}),
      })
      document.fonts.add(face)
      face.load().catch((error: unknown) => console.error(`[fonts] "${id}" did not load`, error))
    } catch (error) {
      console.error(`[fonts] "${id}" did not load`, error)
    }
  }
}
