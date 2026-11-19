// The small buttons in scenes: Settings, Lock, Save, Load, Q.Save, Q.Load, Skip back, Last choice,
// Back, Auto, To choice, Skip, Flowchart, Replay voice, Favourite voices, Hide. Edit freely: their
// order, which show, gaps, sizes, text or icons. What each one does, and where the toolbar sits
// (src/content/scenes.ts toolbar.place), are the engine's. The strip's frame and background are
// `sceneToolbar` in src/content/look/parts.ts.
//
// Draw each button with <SceneToolbarButton> (it runs the action and keeps the click from also
// continuing the text). Its children are what it shows: here the icon from ICONS, else the label.
// The label always stays the button's name for screen readers, and shows as a tooltip.
// b.disabled = nothing to do right now (Replay voice on a line without a voice): drawn faded.
//
// Hide one:     buttons.filter((b) => b.id !== 'quickLoad')
// Reorder:      const ORDER: SceneToolbarButtonId[] = ['auto', 'skip', …], then
//               ORDER.flatMap((id) => buttons.filter((b) => b.id === id))
// Some only come when they can work: Lock (toolbar.autoHide set), Flowchart (visual novel mode),
// Favourite voices (scenes.ts voice.favourites on).
import { Box, Stack, Tooltip } from '@mui/material'
import type { ReactNode } from 'react'
import { SHORT_SCREEN } from '@/core/layers/screen'
import type {
  SceneToolbarButtonId,
  SceneToolbarButtonInfo,
  SceneToolbarSlotProps,
} from '@/core/slots'
import { part } from '@/core/ui/part'
import { SceneToolbarButton } from '@/core/ui/SceneToolbarButton'

/** A 16 x 16 icon drawn in the button's colour. */
const icon = (children: ReactNode) => (
  <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden>
    {children}
  </svg>
)
const line = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
} as const

/**
 * A picture instead of the word, per button. Either an imported image file (.svg, .png…):
 *   import autoIcon from '../assets/ui/auto.svg'      ->  auto: autoIcon,
 * or an SVG written here (with `currentColor` it takes the button's colour, the warning colour
 * while switched on). Buttons not listed show their word (here Save, Load, Q.Save, Q.Load; on phones
 * their SMALL_SCREEN_ICONS below).
 */
const ICONS: Partial<Record<SceneToolbarButtonId, string | ReactNode>> = {
  settings: icon(
    <>
      <circle cx="8" cy="8" r="2.4" {...line} />
      <path
        d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"
        {...line}
      />
    </>,
  ),
  lock: icon(
    <>
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5 7V5a3 3 0 0 1 6 0v2" {...line} />
    </>,
  ),
  skipBack: icon(<path d="M8 3 1 8l7 5zM15 3 8 8l7 5z" />),
  lastChoice: icon(<path d="M2.5 3h2v10h-2zM13 3 5.5 8l7.5 5z" />),
  back: icon(<path d="M11.5 3 4 8l7.5 5z" />),
  auto: icon(<path d="M4.5 3 12 8l-7.5 5z" />),
  toChoice: icon(<path d="M3 3l7.5 5L3 13zM11.5 3h2v10h-2z" />),
  skip: icon(<path d="M1 3l7 5-7 5zM8 3l7 5-7 5z" />),
  flowchart: icon(
    <>
      <path d="M4 5v2.5h8V5M8 7.5V11" {...line} />
      <rect x="1.5" y="1.5" width="5" height="3.5" rx="1" />
      <rect x="9.5" y="1.5" width="5" height="3.5" rx="1" />
      <rect x="5.5" y="11" width="5" height="3.5" rx="1" />
    </>,
  ),
  replayVoice: icon(
    <>
      <path d="M2 6h3l4-3v10l-4-3H2z" />
      <path d="M11 5.5a3.5 3.5 0 0 1 0 5M12.8 3.6a6 6 0 0 1 0 8.8" {...line} />
    </>,
  ),
  favouriteVoices: icon(
    <path d="M8 1.5l1.9 4.4 4.8.4-3.7 3.1 1.2 4.6L8 11.5 3.8 14l1.2-4.6-3.7-3.1 4.8-.4z" />,
  ),
  hide: icon(
    <>
      <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" {...line} />
      <path d="M2.5 13.5l11-11" {...line} />
    </>,
  ),
}

/** With an icon, still show the word next to it. */
const LABEL_WITH_ICON = false

/** Icon size, px (image files; the SVGs above set their own). */
const ICON_SIZE = 16

/**
 * Shown as their word, but as these icons on small screens (phones held sideways), where all the
 * words don't fit in one row. Move a button to ICONS to always show its icon.
 */
const SMALL_SCREEN_ICONS: Partial<Record<SceneToolbarButtonId, ReactNode>> = {
  save: icon(<path d="M8 1.5v8M4.5 6.5 8 10l3.5-3.5M2 11v3h12v-3" {...line} />),
  load: icon(<path d="M8 10.5v-8M4.5 5.5 8 2l3.5 3.5M2 11v3h12v-3" {...line} />),
  quickSave: icon(
    <>
      <path d="M10 1.5v8M7 6.5 10 10l3-3.5M5 11v3h9v-3" {...line} />
      <path d="M4.5 1 1.5 6h2.5L3 10l3.5-5.5H4z" />
    </>,
  ),
  quickLoad: icon(
    <>
      <path d="M10 10.5v-8M7 5.5 10 2l3 3.5M5 11v3h9v-3" {...line} />
      <path d="M4.5 1 1.5 6h2.5L3 10l3.5-5.5H4z" />
    </>,
  ),
}

/** Its word, swapped for its small-screen icon on phones held sideways. */
function wordOrIcon(b: SceneToolbarButtonInfo): ReactNode {
  const small = SMALL_SCREEN_ICONS[b.id]
  if (!small) return b.label
  return (
    <>
      <Box component="span" sx={{ [SHORT_SCREEN]: { display: 'none' } }}>
        {b.label}
      </Box>
      <Box component="span" sx={{ display: 'none', [SHORT_SCREEN]: { display: 'flex' } }}>
        {small}
      </Box>
    </>
  )
}

/** What one button shows: its icon (and word), or the word. */
function face(b: SceneToolbarButtonInfo): ReactNode {
  const pictured = ICONS[b.id]
  if (pictured === undefined) return wordOrIcon(b)
  const picture =
    typeof pictured === 'string' ? (
      <Box
        component="img"
        src={pictured}
        alt=""
        draggable={false}
        sx={{ width: ICON_SIZE, height: ICON_SIZE, display: 'block' }}
      />
    ) : (
      pictured
    )
  return LABEL_WITH_ICON ? (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
      {picture}
      {b.label}
    </Box>
  ) : (
    picture
  )
}

export function SceneToolbar({ buttons }: SceneToolbarSlotProps) {
  return (
    <Stack direction="row" sx={[part('sceneToolbar'), { gap: 0, alignItems: 'center' }]}>
      {buttons.map((b) => {
        const word = ICONS[b.id] === undefined
        return (
          // The name over an icon: on pointing at it, on keyboard / controller focus, on a long
          // press. (Buttons that show their word only need it on phones, where it is an icon.)
          <Tooltip key={b.id} title={b.label} enterDelay={400}>
            <SceneToolbarButton
              button={b}
              sx={{
                minWidth: 0,
                px: word ? 1 : 0.6,
                py: 0.25,
                fontSize: 12,
                lineHeight: 1.5,
                // Switched on (Auto, Skip, To choice, Skip back, Lock): the palette's warning colour.
                color: b.on ? 'warning.main' : 'text.secondary',
                opacity: b.disabled ? 0.35 : 1,
                // Phones held sideways: all of them have to fit in one row.
                [SHORT_SCREEN]: { px: 0.35, fontSize: 11 },
              }}
            >
              {face(b)}
            </SceneToolbarButton>
          </Tooltip>
        )
      })}
    </Stack>
  )
}
