import { Box } from '@mui/material'
import { Hud } from '@/content/ui/Hud'
import { useSystemStore } from '../stores/system'
import { Z } from './zIndex'

/** The game's on-screen buttons over the map. Hidden during events and minigames. */
export function HudLayer() {
  const hidden = useSystemStore((s) => s.event !== null || s.minigame !== null || s.map === null)
  if (hidden) return null
  return (
    <Box
      data-capture // part of save pictures (core/save/thumbnail.ts)
      sx={{ position: 'absolute', inset: 0, zIndex: Z.hud, pointerEvents: 'none' }}
    >
      <Hud />
    </Box>
  )
}
