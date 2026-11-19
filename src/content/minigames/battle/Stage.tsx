import { Box, Stack } from '@mui/material'
import type { Battle, Fighter } from '@/core/battle/engine'
import type { Popup, Reaction } from './animations'
import { EnemyView } from './EnemyView'
import { PartyFigure } from './PartyFigure'

const row = { flexWrap: 'wrap', alignItems: 'flex-end', gap: { xs: 1, sm: 3 } } as const

/** The stage: enemies on the left, the party on the right. */
export function Stage({
  battle,
  reactions,
  popups,
  scale,
  pickable,
}: {
  battle: Battle
  reactions: Record<string, Reaction>
  popups: Popup[]
  scale: number
  pickable: (f: Fighter) => (() => void) | undefined
}) {
  const current = battle.current()
  const of = (f: Fighter) => popups.filter((p) => p.key === f.key)
  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        px: { xs: 0, sm: 4 },
      }}
    >
      <Stack direction="row" useFlexGap sx={row}>
        {battle.side('enemy', false).map((enemy, i) => (
          <Box key={enemy.key} sx={{ mb: i % 2 ? 4 : 0 }}>
            <EnemyView
              battle={battle}
              enemy={enemy}
              active={enemy.key === current?.key}
              reaction={reactions[enemy.key]}
              popups={of(enemy)}
              scale={scale}
              onPick={pickable(enemy)}
            />
          </Box>
        ))}
      </Stack>
      <Stack direction="row" useFlexGap sx={row}>
        {battle.side('party', false).map((member, i) => (
          <Box key={member.key} sx={{ mb: i % 2 ? 4 : 0 }}>
            <PartyFigure
              member={member}
              active={member.key === current?.key}
              reaction={reactions[member.key]}
              popups={of(member)}
              scale={scale}
              onPick={pickable(member)}
            />
          </Box>
        ))}
      </Stack>
    </Box>
  )
}
