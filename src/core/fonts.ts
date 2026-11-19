// Types for src/content/fonts/index.ts: the game's own font files, each with an id and a name.
// This file must not import content: src/content/fonts/index.ts imports it.

/** One font file of the game. */
export interface GameFont {
  /** Shown in Settings → Text → Font (translated). */
  name: string
  /** The font file, imported: `import pixel from './pixel.woff2'` (woff2, woff, ttf or otf). */
  file: string
  /**
   * 'choice' (default): the player can pick it in Settings → Text → Font (after the choices in
   * src/content/scenes.ts `text.fonts`). 'fallback': never picked; it comes after every font, so
   * letters the other fonts lack still show (an emoji font for '💾'). 'internal': loaded, never
   * picked or added anywhere; only used where you name it: <p style={{ fontFamily: 'special' }}>.
   */
  use?: 'choice' | 'fallback' | 'internal'
  /** For a second file of the same family (a bold one): CSS font-weight, e.g. 'bold' or '700'. */
  weight?: string
  /** CSS font-style, e.g. 'italic'. */
  style?: string
  /**
   * The CSS family name to register it under. Default: its id. Several files with the same family
   * (regular + bold) make one font; only the first of them is listed as a choice.
   */
  family?: string
}

/**
 * src/content/fonts/index.ts: id -> font. The id is what useFont() / game.fonts.current() return
 * while it is the player's choice, and (unless `family` says otherwise) its CSS family name.
 */
export function defineFonts<const K extends string>(
  fonts: Record<K, GameFont>,
): Record<K, GameFont> {
  return fonts
}
