import { Box, Stack, Typography } from '@mui/material'
import type { Battle, Fighter } from '@/core/battle/engine'
import { game } from '@/core/game'
import { useLang } from '@/core/lang'
import { characters } from '@/core/registry'

/** How many coming turns to show. */
const TURNS = 8
const TURNS_SMALL = 6

const colorOf = (f: Fighter) =>
  f.side === 'enemy'
    ? (game.battles.enemyInfo(f.id)?.color ?? '#ef5350')
    : ((characters as Record<string, { color?: string }>)[f.id]?.color ?? '#66bb6a')

/**
 * Who acts next, left to right (the first is acting now). `previewDelay` shows the order as it
 * would be after an action that slow / quick (a skill's `delay`).
 */
export function TurnStrip({
  battle,
  previewDelay,
  small,
}: {
  battle: Battle
  previewDelay?: number
  small: boolean
}) {
  const t = useLang()
  const preview = previewDelay !== undefined && previewDelay !== 1
  const order = battle.upcoming(small ? TURNS_SMALL : TURNS, { delay: previewDelay })
  if (order.length === 0) return null
  return (
    <Stack
      direction="row"
      role="img"
      aria-label={t('Turn order: {names}', { names: order.map((f) => f.name).join(', ') })}
      sx={{ alignItems: 'center', gap: 0.5, flexShrink: 0, overflow: 'hidden', mb: 1 }}
    >
      <Typography variant="caption" sx={{ opacity: 0.8, mr: 0.5, textShadow: '0 1px 2px #000' }}>
        {preview ? t('After this') : t('Next')}
      </Typography>
      {order.map((f, i) => (
        <Box
          // biome-ignore lint/suspicious/noArrayIndexKey: the same fighter appears several times
          key={i}
          sx={{
            px: 0.75,
            py: 0.25,
            maxWidth: i === 0 ? 120 : 84,
            flexShrink: i === 0 ? 0 : 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: i === 0 ? 14 : 12,
            fontWeight: i === 0 ? 700 : 400,
            borderRadius: 1,
            bgcolor: 'rgba(0,0,0,0.6)',
            borderBottom: `3px solid ${colorOf(f)}`,
            // Enemies: a marker besides the colour.
            borderTop:
              f.side === 'enemy' ? '1px solid rgba(255,255,255,0.5)' : '1px solid transparent',
            outline: i === 0 ? '2px solid #ffd54f' : preview ? '1px dashed #ffd54f' : 'none',
            opacity: i === 0 ? 1 : 0.9,
          }}
        >
          {i === 0 ? '▶ ' : ''}
          {f.name}
        </Box>
      ))}
    </Stack>
  )
}
