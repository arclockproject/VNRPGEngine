// The title screen's frame: the parts every title screen variant shares (menu, prompt, switcher,
// version). The art behind them is the current variant from src/content/titles/. Edit freely; the
// flow (boot screens, press any key, entrance, then the menu) is in start.ts.
import { keyframes } from '@emotion/react'
import { Box, Typography } from '@mui/material'
import { tx, useLang } from '@/core/lang'
import { SHORT_SCREEN } from '@/core/layers/screen'
import { TitleArt, TitleMenu, TitleSwitcher } from '@/core/layers/TitleLayer'
import { useSystemStore } from '@/core/stores/system'

const pulse = keyframes`
  0%, 100% { opacity: 0.35; }
  50%      { opacity: 1; }
`

const fadeIn = keyframes`from { opacity: 0 } to { opacity: 1 }`

const PROMPT = {
  keyboard: tx('Press any key to continue'),
  gamepad: tx('Press any button to continue'),
  touch: tx('Tap to continue'),
} as const

export function TitleFrame() {
  const t = useLang()
  const device = useSystemStore((s) => s.device)
  const phase = useSystemStore((s) => s.title)
  // True once the menu buttons have fully appeared (or the player skipped to that).
  const menuIn = useSystemStore((s) => s.titleMenuIn)
  // Switcher and version wait for the variant's entrance (`intro`), then fade in with the menu.
  const extras = phase === 'shown' || phase === 'menu' || phase === 'leaving'
  const extrasLook = menuIn ? undefined : { animation: `${fadeIn} 600ms ease both` }

  // "Press any key": on black, before the art shows.
  if (phase === 'waiting')
    return (
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          px: 2,
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <Typography
          variant="h6"
          sx={{
            letterSpacing: 2,
            textTransform: 'uppercase',
            textAlign: 'center',
            animation: `${pulse} 2s ease-in-out infinite both`,
          }}
        >
          {t(PROMPT[device])}
        </Typography>
      </Box>
    )

  return (
    <Box sx={{ position: 'absolute', inset: 0, userSelect: 'none' }}>
      {/* The current variant's art and entrance (switches with a cross-fade). */}
      <TitleArt />
      {/* The menu on the right, so a short phone screen never pushes it off the bottom. The
          variants keep the left side for their logo. */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          right: 0,
          width: 'min(400px, 45cqw)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Box
          sx={{
            width: '100%',
            maxWidth: 352,
            maxHeight: '100%',
            overflowY: 'auto',
            // The side padding is the room the buttons slide in through (TitleMenu `distance`):
            // this box scrolls, so anything outside it would be cut off.
            p: 2,
            [SHORT_SCREEN]: { py: 1 },
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {/* Continue / New game / … from game.title.menu() in start.ts. The buttons appear one
              after another, top to bottom. effect: 'fade', or 'left' / 'right' / 'top' / 'bottom'
              (fades in while sliding `distance` px from that side). Times in ms. */}
          {/* Short screens (a phone held sideways, `shortHeight` in screen.ts): smaller buttons,
              closer together, so the full menu (7 buttons) fits without scrolling. With more than
              fits, this box scrolls. */}
          <TitleMenu
            effect="right"
            distance={16}
            duration={350}
            stagger={110}
            sx={{ [SHORT_SCREEN]: { gap: 0.75 } }}
            buttonSx={{ [SHORT_SCREEN]: { minHeight: 40, py: 0 } }}
          />
        </Box>
      </Box>
      {/* Older and current title screens, once two are unlocked (Q / R, LB / RB too). */}
      {extras && (
        <Box
          sx={{
            position: 'absolute',
            left: 'max(12px, env(safe-area-inset-left))',
            bottom: 'max(8px, env(safe-area-inset-bottom))',
            maxWidth: 'calc(100% - 120px)',
            ...extrasLook,
          }}
        >
          <TitleSwitcher />
        </Box>
      )}
      {extras && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ position: 'absolute', right: 16, bottom: 12, ...extrasLook }}
        >
          v{__APP_VERSION__}
        </Typography>
      )}
    </Box>
  )
}
