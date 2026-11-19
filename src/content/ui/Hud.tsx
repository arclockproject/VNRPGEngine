// The game's on-screen buttons over the map. Edit freely: this is game content, not engine.
// Party, Journal, Save, Load and Settings are in the pause menu (src/content/windows/menu).
import { /* Button ,*/ Chip, Stack } from '@mui/material'
import { game } from '@/core/game'
// import { ActionHint } from '@/core/input/ActionHint'
import { useAction } from '@/core/input/useAction'
// import { useLang } from '@/core/lang'
import { useMoney } from '@/core/managers/money'
import { Minimap } from '@/core/ui/Minimap'

export function Hud() {
  // Active over the map and while windows are open, so the same key closes them again.
  useAction('inventory', () => game.windows.toggle('inventory'), { layers: ['map', 'windows'] })
  // Map only: while a window is open the engine makes menu close the front one (like cancel).
  useAction('menu', () => game.windows.toggle('menu'))
  // useAction('quests', () => game.windows.toggle('quests'), { layers: ['map', 'windows'] })

  // const t = useLang()
  const money = useMoney()

  return (
    <>
      <Stack
        direction="row"
        spacing={1}
        sx={{ position: 'absolute', top: 16, left: 16, pointerEvents: 'auto' }}
      >
        <Chip label={game.money.format(money)} color="warning" sx={{ alignSelf: 'center' }} />
      </Stack>
      {/* The small map (settings: src/content/config/screen.ts `minimap`). Move it with sx, or delete it.
          Top right, under the menu button: the bottom corners belong to the touch controls. */}
      <Minimap sx={{ position: 'absolute', right: 16, top: 72 }} />
    </>
  )
}
