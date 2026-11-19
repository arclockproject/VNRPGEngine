// The on-screen joystick and buttons: shown only after the player touches the screen, and only
// over the map / events (windows and minigames are tapped directly). Drawn by
// src/content/ui/TouchControls.tsx with core/ui/TouchControls.tsx (the touch handling).
import { Box } from '@mui/material'
import inputConfig from '@/content/config/input'
import { TouchControls as TouchControlsSlot } from '@/content/ui/TouchControls'
import type { TouchButton as TouchButtonConfig } from '../input/define'
import type { ActionName } from '../input/manager'
import { useLang } from '../lang'
import type { TouchButtonInfo } from '../slots'
import { topLayer, useSystemStore } from '../stores/system'
import { Z } from './zIndex'

export function TouchControls() {
  const t = useLang()
  const device = useSystemStore((s) => s.device)
  const layer = useSystemStore(topLayer)
  if (device !== 'touch' || (layer !== 'map' && layer !== 'event')) return null
  const buttons: TouchButtonInfo[] = (
    (inputConfig.touchButtons ?? []) as TouchButtonConfig<ActionName>[]
  )
    .filter((b) => !b.layers || b.layers.includes(layer))
    .map((b) => ({
      action: b.action,
      label: t(b.label),
      place: b.place === 'top-right' ? 'top-right' : 'group',
    }))
  return (
    <Box
      data-no-screenshot
      sx={{ position: 'absolute', inset: 0, zIndex: Z.touch, pointerEvents: 'none' }}
    >
      <TouchControlsSlot buttons={buttons} joystick={layer === 'map'} />
    </Box>
  )
}
