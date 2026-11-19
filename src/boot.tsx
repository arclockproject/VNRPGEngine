// Starts the game. Loaded by main.tsx once stored data (saves, settings) has been read.
import { CssBaseline, createTheme, ThemeProvider } from '@mui/material'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import screen from '@/content/config/screen'
import look from '@/content/look'
import { start } from '@/content/start'
import { audio } from '@/core/audio/manager'
import { startComfort } from '@/core/comfort'
import { runDevStart } from '@/core/dev/startRun'
import { startDisplay } from '@/core/display'
import { startErrorWatch } from '@/core/errors'
import { loadGameFonts, withFallbacks } from '@/core/fontList'
import { game } from '@/core/game'
import { input } from '@/core/input/manager'
import { startLanguage } from '@/core/lang'
import { GameRoot } from '@/core/layers/GameRoot'
import { lookComponents, lookPalette, lookTypography, scrollbarLook } from '@/core/look'
import { clock } from '@/core/managers/clock'
import { session } from '@/core/managers/session'
import { timers } from '@/core/managers/timers'
import { travel } from '@/core/managers/travel'
import { startNoZoom } from '@/core/noZoom'
import { save } from '@/core/save/manager'
import { selfVoicing } from '@/core/selfVoicing'
import { startUiSounds } from '@/core/ui/sounds'

const MUI_FONT = '"Roboto", "Helvetica", "Arial", sans-serif'

// Everything about the look comes from src/content/look/. Its `mui` options are merged last.
const theme = createTheme(
  {
    palette: lookPalette(look.colors),
    typography: {
      ...lookTypography(look.text),
      // The player's font (Settings → Text) or the language's own font replaces the game's.
      // The game's own "fallback" fonts (src/content/fonts) come last: letters the others lack (emoji).
      fontFamily: withFallbacks(
        `var(--game-font, ${(look.text as { font?: string }).font ?? MUI_FONT})`,
      ),
    },
    components: {
      // Frames and colours for every MUI part (src/content/look/).
      ...lookComponents(look),
      MuiCssBaseline: {
        styleOverrides: {
          '*': {
            ...scrollbarLook(look.scrollbar),
            // A game, not a web page: no text selection, no blue tap flash, no long-press callout,
            // and no pinch / double-tap zoom (scrolling still works; elements may set their own).
            userSelect: 'none',
            WebkitUserSelect: 'none',
            WebkitTapHighlightColor: 'transparent',
            WebkitTouchCallout: 'none',
            touchAction: 'pan-x pan-y',
          },
          'input, textarea, [contenteditable]': {
            userSelect: 'text',
            WebkitUserSelect: 'text',
            WebkitTouchCallout: 'default',
          },
          img: { WebkitUserDrag: 'none' },
          // Bars around the game screen (Settings → Screen ratio).
          'html, body': { backgroundColor: screen.barColor },
        },
      },
    },
  },
  look.mui ?? {},
)

const root = document.getElementById('root')
if (!root) throw new Error('#root element missing from index.html')

createRoot(root).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      {/* enableColorScheme = dark native parts (scrollbars, select popups) */}
      <CssBaseline enableColorScheme />
      <GameRoot />
    </ThemeProvider>
  </StrictMode>,
)

startErrorWatch()
input.start()
audio.start()
save.start()
clock.start()
timers.startTicking()
travel.start()
startDisplay()
startNoZoom()
startLanguage()
loadGameFonts()
startComfort()
selfVoicing.start()
startUiSounds()
session.setStart(() => start(game))
// Dev server: an @start / devStart() marker opens the game right at it (src/core/dev/startRun.ts).
void (async () => {
  if (import.meta.env.DEV && (await runDevStart(game))) return
  await start(game)
})().catch((error: unknown) => console.error('[start]', error))
