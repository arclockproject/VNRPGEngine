// The game's own fonts. Put a font file in this folder (woff2, woff, ttf or otf), import it here and
// give it an id and a name. Edit freely.
//   - The id is its CSS family name: use it anywhere a font is set, e.g. src/content/look/text.ts
//     font: "pixel, sans-serif", look/map.ts, line styles in scenes.ts.
//   - A 'choice' font (the default) is also listed in Settings → Text → Font, after the choices
//     in src/content/scenes.ts `text.fonts`, with its name.
//   - A 'fallback' font is never picked: it comes after every font, so letters the others lack
//     still show. An emoji font here makes '💾' show on every device.
//   - An 'internal' font is loaded but never picked or added anywhere: only where you name it,
//     e.g. <p style={{ fontFamily: 'special' }}>Rocket</p>.
//   - No Font row in Settings at all: src/content/scenes.ts text.playerPicksFont: false.
//   - In code: useFont() (React, from '@/core/managers/fonts') or game.fonts.current() is the id of the
//     font the player picked: `useFont() === 'pixel' ? smallIcon : icon`.
// The fonts ship with the game (no internet needed). Check the font's licence allows that.
import { defineFonts } from '@/core/fonts'

// import pixel from './pixel.woff2'
// import emoji from './NotoColorEmoji.ttf'
// import special from './special.woff2'

export default defineFonts({
  // pixel: { name: 'Pixel', file: pixel },
  // emoji: { name: 'Emoji', file: emoji, use: 'fallback' },
  // special: { name: 'Special', file: special, use: 'internal' },
})
