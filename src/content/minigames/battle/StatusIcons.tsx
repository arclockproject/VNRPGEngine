import { Box, Stack } from '@mui/material'
import type { Battle, Fighter } from '@/core/battle/engine'
import { useLang } from '@/core/lang'

const isImage = (icon: string) => /[/.]/.test(icon)

/** One status: its icon (or first letter) in its colour. */
export function StatusIcon({
  battle,
  id,
  size = 18,
}: {
  battle: Battle
  id: string
  size?: number
}) {
  const info = battle.statusInfo(id)
  const icon = info?.icon ?? (info?.name ?? id).slice(0, 1)
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: '4px',
        fontSize: size * 0.66,
        lineHeight: 1,
        color: '#fff',
        bgcolor: 'rgba(0,0,0,0.55)',
        border: `1px solid ${info?.color ?? '#9e9e9e'}`,
        backgroundImage: isImage(icon) ? `url(${icon})` : undefined,
        backgroundSize: 'contain',
      }}
    >
      {isImage(icon) ? null : icon}
    </Box>
  )
}

/**
 * A fighter's statuses as small icons with the turns left. Only a glance: the Check command lists
 * them with names and what they do (works with every input).
 */
export function StatusIcons({ battle, fighter }: { battle: Battle; fighter: Fighter }) {
  const t = useLang()
  const names = fighter.statuses.map((s) => t(battle.statusInfo(s.id)?.name ?? s.id)).join(', ')
  return (
    <Stack
      direction="row"
      useFlexGap
      role={names ? 'img' : undefined}
      aria-label={names || undefined}
      sx={{ gap: 0.5, minHeight: 18, flexWrap: 'wrap', justifyContent: 'center' }}
    >
      {fighter.defending && <Box component="span">🛡</Box>}
      {fighter.statuses.map((s) => (
        <Stack key={s.id} direction="row" sx={{ alignItems: 'center', gap: '2px', fontSize: 11 }}>
          <StatusIcon battle={battle} id={s.id} />
          {s.turns}
        </Stack>
      ))}
    </Stack>
  )
}
