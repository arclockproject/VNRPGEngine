import { Box } from '@mui/material'
import { MenuButton } from '@/content/ui/MenuButton'
import { useSystemStore } from '../stores/system'
import { Z } from './zIndex'

/**
 * Pause menu button on every device, above every layer during play. It stays mounted while windows
 * open (so the tap that opens the menu can't land on the scene below). It sits above the window
 * layer's click catcher, so a click on it only toggles the menu.
 */
export function MenuButtonLayer() {
  // Not over a minigame that asks for none (menuButton: false, e.g. Extras).
  const shown = useSystemStore(
    (s) => (s.title === null || (s.sceneReplay && s.event !== null)) && !s.minigame?.noMenuButton,
  )
  if (!shown) return null
  return (
    <Box
      data-no-screenshot
      sx={{ position: 'absolute', inset: 0, zIndex: Z.menuButton, pointerEvents: 'none' }}
    >
      <MenuButton />
    </Box>
  )
}
