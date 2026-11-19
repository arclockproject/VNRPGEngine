// The game's own look. Edit freely: this is game content, not engine.
// One folder for how the game looks, sounds and behaves:
//   colors.ts   the palette (text, accent, good / warn / danger...)
//   text.ts     font and text sizes
//   frames.ts   the frame pictures
//   buttons.ts  every Button, by colour and variant
//   parts.ts    named looks: engine parts (choices, touch buttons...) and your own
//   sounds.ts   UI sounds (move, click, tab, open, close)
//   mui.ts      default props and raw MUI theme options, merged last
//   map.ts      text and speech bubbles on the map (drawn by the map, not MUI)
//   glyphs.ts   names and colours of keys and controller buttons in prompts
// This file: panels and the other MUI parts.
//
// Each box takes a CSS `background` (colour, gradient, or url(...)), a text `color`, and an
// optional 9-slice frame (`image`, `slice`, `scale`, `sides`, `pixelated`: see frames.ts).
// Parts that react (buttons, tabs...) also take `focus`, `pressed`, `disabled`, `selected` boxes;
// a missing one reuses the normal look (focus brighter, pressed darker, disabled grey).
// Every box also takes `css: { ... }`: plain CSS that is applied last, so it wins over the rest
// (e.g. `css: { borderRadius: 8 }` on a framed box). In a state it adds to the normal `css`.
// Remove a part to get the plain MUI look back. The ui/ images are placeholders: swap in your art.
import { defineLook } from '@/core/look'
import button from './buttons'
import colors, { cream, gold } from './colors'
import * as frames from './frames'
import mui from './mui'
import parts from './parts'
import sounds from './sounds'
import text from './text'

export default defineLook({
  colors,
  text,
  button,
  parts,
  sounds,
  mui,

  // Every MUI Paper: windows, the chat box, toasts, battle panels, dropdown lists.
  panel: { ...frames.panel, color: cream, background: 'rgba(163, 32, 32, 0.88)' },
  // Override the panel for one kind of box only:
  window: {},
  dialog: { background: 'rgba(15, 18, 26, 0.88)' },

  tabs: {
    tab: {
      color: cream,
      focus: { background: 'rgba(242, 212, 138, 0.12)', color: gold },
      selected: { ...frames.buttonFocus, color: gold },
    },
    indicator: 'none',
  },
  // A closed dropdown, the list it opens, one row of it.
  input: { ...frames.button, focus: frames.buttonFocus },
  // menu: {...},
  menuItem: { focus: { background: '#2c3850' }, selected: { color: gold } },
  // Bars (HP, XP, loading). Make `height` room for the frame: 3px each side here.
  progress: { height: 10, rail: frames.progress },
  slider: {
    height: 8,
    rail: frames.button,
    // The filled part up to the value: none, so only the framed bar and the knob show.
    track: { background: 'transparent', css: { border: 'none' } },
    thumb: frames.buttonFocus,
    thumbSize: 32,
  },
  // switch: { track: {...}, thumb: {...}, on: { track: {...}, thumb: {...} } },
  // chip: {...}, iconButton: {...}, alert: {...}, avatar: {...},

  // Space around windows so the game shows at their edges (px). It grows with the screen's
  // shorter side: min on screens up to smallScreen px, max from largeScreen px.
  windowGap: { min: 8, max: 32, smallScreen: 480, largeScreen: 1000 },
  // Scrollbars in windows and lists: thumb = the part you drag, track = behind it.
  scrollbar: { thumb: '#4a5468', track: 'transparent', width: 'thin' },
})
