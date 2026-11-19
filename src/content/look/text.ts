// Fonts and text sizes. The names are MUI Typography variants: <Typography variant="body2">.
// Each takes plain CSS (fontSize, fontWeight, letterSpacing, textShadow, fontFamily...).
// Leave one out to keep MUI's default for it.
import type { LookText } from '@/core/look'

export default {
  // A font name, e.g. "'MyFont', sans-serif". Unset = the default font.
  // font: "'MyFont', sans-serif",
  // Base size in px (MUI default 14). Variants without their own fontSize scale with it.
  // size: 14,
  // h5: { fontWeight: 700 }, // big titles
  // h6: { fontWeight: 700 }, // window and section titles
  // subtitle1: {},           // window title bar
  // body1: {},               // event text, normal text
  // body2: {},               // most text in windows
  // caption: {},             // small hints
  // overline: {},            // tiny headings
  // button: { textTransform: 'none', fontWeight: 600 }, // the text on every Button
} satisfies LookText
