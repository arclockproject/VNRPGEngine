// The keyboard in Settings → Controls (shown while the keyboard is in use): every key in its place,
// and each key is a button: press one to choose what it does (the panel under it, Controls.tsx).
// Keys that do something stand out; the key picked is outlined; the keys of the action pointed at in
// the panel light up. Keys are KeyboardEvent.code names (where the key sits), so it fits any layout.
// Edit freely: the key table, the sizes, the colours (from the theme).
import { alpha, Box, ButtonBase, useTheme } from '@mui/material'
import { keyLabel } from '@/core/input/glyphs'

/** One key: its code, and its width in key units (1 = a letter key). A null code is a gap. */
type Key = [code: string | null, width?: number]

/** The rows, top to bottom: the main block, then (after a gap) the arrows / Page Up block. */
const ROWS: { y: number; keys: Key[]; nav?: Key[] }[] = [
  {
    y: 0,
    keys: [
      ['Escape'],
      [null],
      ['F1'],
      ['F2'],
      ['F3'],
      ['F4'],
      [null, 0.5],
      ['F5'],
      ['F6'],
      ['F7'],
      ['F8'],
      [null, 0.5],
      ['F9'],
      ['F10'],
      ['F11'],
      ['F12'],
    ],
  },
  {
    y: 1.25,
    keys: [
      ['Backquote'],
      ...['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((d): Key => [`Digit${d}`]),
      ['Minus'],
      ['Equal'],
      ['Backspace', 2],
    ],
    nav: [['Insert'], ['Home'], ['PageUp']],
  },
  {
    y: 2.25,
    keys: [
      ['Tab', 1.5],
      ...[...'QWERTYUIOP'].map((c): Key => [`Key${c}`]),
      ['BracketLeft'],
      ['BracketRight'],
      ['Backslash', 1.5],
    ],
    nav: [['Delete'], ['End'], ['PageDown']],
  },
  {
    y: 3.25,
    keys: [
      ['CapsLock', 1.75],
      ...[...'ASDFGHJKL'].map((c): Key => [`Key${c}`]),
      ['Semicolon'],
      ['Quote'],
      ['Enter', 2.25],
    ],
  },
  {
    y: 4.25,
    keys: [
      ['ShiftLeft', 2.25],
      ...[...'ZXCVBNM'].map((c): Key => [`Key${c}`]),
      ['Comma'],
      ['Period'],
      ['Slash'],
      ['ShiftRight', 2.75],
    ],
    nav: [[null], ['ArrowUp'], [null]],
  },
  {
    y: 5.25,
    keys: [
      ['ControlLeft', 1.25],
      ['MetaLeft', 1.25],
      ['AltLeft', 1.25],
      ['Space', 6.25],
      ['AltRight', 1.25],
      ['MetaRight', 1.25],
      ['ContextMenu', 1.25],
      ['ControlRight', 1.25],
    ],
    nav: [['ArrowLeft'], ['ArrowDown'], ['ArrowRight']],
  },
]

/** Where the arrows / Page Up block starts (key units). */
const NAV_X = 15.5
/** The picture's size in key units, and the space between keys (a share of a key). */
const WIDTH = 18.5
const HEIGHT = 6.25
const GAP = 0.08

/** Shorter names where a full one wouldn't fit on its key. */
const SHORT: Record<string, string> = {
  CapsLock: 'Caps',
  ContextMenu: 'Menu',
  Insert: 'Ins',
  Delete: 'Del',
  Home: 'Hm',
  PageUp: 'PgUp',
  PageDown: 'PgDn',
}

export function Keyboard(props: {
  /** Key code -> the (translated) actions on it: those keys stand out. */
  bound: Record<string, string[]>
  /** The keys of the action pointed at in the panel: lit up. */
  active: string[]
  /** The key picked (its panel is open), or null. */
  selected: string | null
  onSelect: (code: string) => void
}) {
  const theme = useTheme()
  const accent = theme.palette.primary.main
  const text = theme.palette.text.primary
  const placed: { code: string; x: number; y: number; w: number }[] = []
  for (const row of ROWS) {
    let x = 0
    for (const [code, width = 1] of row.keys) {
      if (code) placed.push({ code, x, y: row.y, w: width })
      x += width
    }
    x = NAV_X
    for (const [code, width = 1] of row.nav ?? []) {
      if (code) placed.push({ code, x, y: row.y, w: width })
      x += width
    }
  }
  const pct = (units: number, of: number) => `${(units / of) * 100}%`
  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        aspectRatio: `${WIDTH} / ${HEIGHT}`,
        // Letters size with the picture: 1cqw = 1% of its width.
        containerType: 'inline-size',
      }}
    >
      {placed.map(({ code, x, y, w }) => {
        const actions = props.bound[code] ?? []
        const lit = props.active.includes(code)
        const picked = props.selected === code
        const used = actions.length > 0
        const label = SHORT[code] ?? keyLabel(code)
        return (
          <ButtonBase
            key={code}
            data-key={code}
            aria-label={used ? `${label}: ${actions.join(', ')}` : label}
            aria-pressed={picked}
            title={used ? actions.join(', ') : undefined}
            onClick={() => props.onSelect(code)}
            sx={{
              position: 'absolute',
              left: pct(x + GAP / 2, WIDTH),
              top: pct(y + GAP / 2, HEIGHT),
              width: pct(w - GAP, WIDTH),
              height: pct(1 - GAP, HEIGHT),
              borderRadius: '0.6cqw',
              fontSize: label.length > 3 ? '1.25cqw' : '1.8cqw',
              fontWeight: used ? 700 : 400,
              color: lit ? theme.palette.getContrastText(accent) : alpha(text, used ? 1 : 0.55),
              bgcolor: lit ? accent : used ? alpha(accent, 0.25) : alpha(text, 0.06),
              border: `${picked ? 3 : 1}px solid`,
              borderColor: picked ? text : used || lit ? accent : alpha(text, 0.25),
              '&.Mui-focusVisible, &:hover': { borderColor: text },
            }}
          >
            {label}
          </ButtonBase>
        )
      })}
    </Box>
  )
}
