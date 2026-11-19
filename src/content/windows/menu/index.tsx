// The pause menu (Menu key, Start on a pad, or the Menu button). Every window is reachable from
// here, so a controller never needs a key it doesn't have. Edit freely: this is game content.
import { Box, Button } from '@mui/material'
import { defineWindow } from '@/core/define'
import { game } from '@/core/game'
import { useLang } from '@/core/lang'
import { openLog } from '@/core/layers/EventLayer'
import { canQuit } from '@/core/platform'
import { useSystemStore } from '@/core/stores/system'

function Menu() {
  const t = useLang()
  const inEvent = useSystemStore((s) => s.event !== null)
  const onMap = useSystemStore((s) => s.map !== null)
  // Visual novel only (src/content/config/mode.ts): no inventory, quests, crafting, travel, party, journal.
  const rpg = !game.vnOnly
  // Windows here stay open underneath: cancel comes back to this menu.
  const open = (id: 'inventory' | 'quests' | 'party' | 'journal' | 'settings') =>
    game.windows.open(id)

  // A grid: as many columns as fit (3 on a wide screen, 2 on a phone). Arrows / d-pad move
  // between buttons by position (spatial focus), so rows and columns both work.
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
        gap: 1,
      }}
    >
      {rpg && (
        <Button variant="outlined" onClick={() => open('inventory')}>
          {t('Inventory')}
        </Button>
      )}
      {rpg && (
        <Button variant="outlined" onClick={() => open('quests')}>
          {t('Quests')}
        </Button>
      )}
      {rpg && game.crafting.inMenu() && (
        <Button variant="outlined" onClick={() => game.crafting.open()}>
          {t('Crafting')}
        </Button>
      )}
      {rpg && onMap && !inEvent && game.travel.inMenu() && (
        <Button variant="outlined" onClick={() => game.travel.open()}>
          {t('Travel')}
        </Button>
      )}
      {game.vnOnly && (
        <Button variant="outlined" onClick={() => game.windows.open('flowchart')}>
          {t('Flowchart')}
        </Button>
      )}
      {rpg && (
        <Button variant="outlined" onClick={() => open('party')}>
          {t('Party')}
        </Button>
      )}
      {rpg && (
        <Button variant="outlined" onClick={() => open('journal')}>
          {t('Journal')}
        </Button>
      )}
      <Button
        variant="outlined"
        onClick={() =>
          (game.windows.open as (id: string, p: unknown) => void)('saves', { mode: 'save' })
        }
      >
        {t('Save')}
      </Button>
      <Button
        variant="outlined"
        onClick={() =>
          (game.windows.open as (id: string, p: unknown) => void)('saves', { mode: 'load' })
        }
      >
        {t('Load')}
      </Button>
      <Button variant="outlined" onClick={() => open('settings')}>
        {t('Settings')}
      </Button>
      {inEvent && (
        <Button
          variant="outlined"
          onClick={() => {
            game.windows.close('menu')
            openLog()
          }}
        >
          {t('Log')}
        </Button>
      )}
      {rpg && onMap && !inEvent && (
        <Button
          variant="outlined"
          onClick={() => {
            game.windows.closeAll()
            void game.maps.unstuck().then((moved) => {
              if (!moved) game.toast(t('Nothing happens.'))
            })
          }}
        >
          {t("I'm stuck")}
        </Button>
      )}
      <Button variant="outlined" color="warning" onClick={() => void game.session.leave('title')}>
        {t('Title')}
      </Button>
      {canQuit && (
        <Button
          variant="outlined"
          color="warning"
          data-voice="quit"
          onClick={() => void game.session.leave('quit')}
        >
          {t('Quit')}
        </Button>
      )}
    </Box>
  )
}

// transition: how it comes in and goes out, e.g. { in: 180, out: 140, effect: 'slideUp' } (fade, scale,
// slideUp / slideDown / slideLeft / slideRight). Left out: it appears and goes at once.
export default defineWindow({ title: 'Menu', component: Menu, width: 440 })
