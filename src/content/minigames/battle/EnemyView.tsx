import { Box, Stack, Typography } from '@mui/material'
import type { Battle, Fighter } from '@/core/battle/engine'
import { useLang } from '@/core/lang'
import type { Popup, Reaction } from './animations'
import { Bar } from './Bar'
import { Figure } from './Figure'
import { Popups } from './Popups'
import { StatusIcons } from './StatusIcons'

/** An enemy on the stage: sprite, name, HP bar and statuses. Clickable when it can be picked. */
export function EnemyView({
  battle,
  enemy,
  active,
  reaction,
  popups,
  scale,
  onPick,
}: {
  battle: Battle
  enemy: Fighter
  active: boolean
  reaction?: Reaction
  popups: Popup[]
  scale: number
  onPick?: () => void
}) {
  const t = useLang()
  // Only with `showIntent: true` in src/content/battle.ts.
  const intent = battle.intentOf(enemy)
  const plan = !intent
    ? ''
    : intent.kind === 'skill'
      ? t(intent.name ?? '')
      : intent.kind === 'defend'
        ? t('Defend')
        : t('Attack')
  return (
    <Stack
      component={onPick ? 'button' : 'div'}
      type={onPick ? 'button' : undefined}
      onClick={onPick}
      data-fighter={onPick ? enemy.key : undefined}
      spacing={0.5}
      sx={{
        all: 'unset',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.5,
        minWidth: 90,
        p: 0.5,
        borderRadius: 1,
        cursor: onPick ? 'pointer' : 'default',
        outline: onPick ? '3px solid #ffd54f' : 'none',
        outlineOffset: 2,
        '&:focus-visible': { outline: '3px solid #fff' },
      }}
    >
      <Typography
        sx={{ color: '#ffd54f', lineHeight: 1, visibility: active ? 'visible' : 'hidden' }}
      >
        ▼
      </Typography>
      {plan && (
        <Typography
          variant="caption"
          sx={{
            px: 0.75,
            borderRadius: 1,
            bgcolor: 'rgba(0,0,0,0.55)',
            color: '#ffe082',
            lineHeight: 1.4,
            whiteSpace: 'nowrap',
          }}
        >
          {plan}
        </Typography>
      )}
      <Figure fighter={enemy} reaction={reaction} scale={scale} facing="right" />
      <Popups popups={popups} />
      <Typography variant="body2" sx={{ textShadow: '0 1px 2px #000' }}>
        {enemy.name}
      </Typography>
      <Box sx={{ width: 90, opacity: enemy.hp <= 0 ? 0.3 : 1 }}>
        <Bar value={enemy.hp} max={battle.maxHp(enemy)} color="error" />
      </Box>
      <StatusIcons battle={battle} fighter={enemy} />
    </Stack>
  )
}
