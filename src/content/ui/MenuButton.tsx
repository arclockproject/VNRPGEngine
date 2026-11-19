// The ☰ button that opens the pause menu. Edit its look freely.
// It shows on every device during play (map, scenes, minigames, over open windows), never on the title.
import { ButtonBase } from '@mui/material'
import { game } from '@/core/game'
import { useSystemStore } from '@/core/stores/system'
import { part } from '@/core/ui/part'

export function MenuButton() {
  const windows = useSystemStore((data) => data.windows.length)
  return (
    <ButtonBase
      aria-label="Menu"
      onClick={() => game.windows.toggle('menu')}
      sx={{
        display: windows > 0 ? 'none' : undefined,
        position: 'absolute',
        right: 'max(12px, env(safe-area-inset-right))',
        top: 'max(12px, env(safe-area-inset-top))',
        width: 44,
        height: 44,
        fontSize: 20,
        pointerEvents: 'auto',
        touchAction: 'none',
        userSelect: 'none',
        // The same look as the touch buttons: src/content/look/parts.ts.
        ...part('touchButton'),
      }}
    >
      ☰
    </ButtonBase>
  )
}
