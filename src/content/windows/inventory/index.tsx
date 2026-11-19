import { Avatar, Button, Stack, Typography } from '@mui/material'
import { defineWindow } from '@/core/define'
import { game } from '@/core/game'
import { useLang } from '@/core/lang'
import { useInventory, useItemsOn } from '@/core/managers/items'

// import { useGameData } from '@/core/state'

function Inventory() {
  const t = useLang()
  // const health = useGameData((d) => d.stats.health)
  // const hunger = useGameData((d) => d.stats.hunger)
  const items = useInventory()
  // Re-render when an item is switched on / off (its button text may change).
  useItemsOn()

  return (
    <Stack spacing={1.5}>
      {items.length === 0 ? (
        <Typography color="text.secondary">{t('Your bag is empty.')}</Typography>
      ) : (
        items.map(({ id, count, item }) => (
          <Stack key={id} direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Avatar
              src={item.icon}
              variant="square"
              sx={{ width: 32, height: 32, imageRendering: 'pixelated', bgcolor: 'transparent' }}
            >
              {t(item.name).slice(0, 1)}
            </Avatar>
            <Stack sx={{ flex: 1, minWidth: 0 }}>
              <Typography>
                {t(item.name)} × {count}
              </Typography>
              {item.description && (
                <Typography variant="caption" color="text.secondary">
                  {t(item.description)}
                </Typography>
              )}
            </Stack>
            {item.use && (
              <Button size="small" variant="outlined" onClick={() => void game.items.use(id)}>
                {game.items.actionLabel(id)}
              </Button>
            )}
          </Stack>
        ))
      )}
    </Stack>
  )
}

export default defineWindow({ title: 'Inventory', component: Inventory })
