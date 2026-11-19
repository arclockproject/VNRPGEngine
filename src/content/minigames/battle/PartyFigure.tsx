import { Box, Typography } from '@mui/material'
import type { Fighter } from '@/core/battle/engine'
import type { Popup, Reaction } from './animations'
import { Figure } from './Figure'
import { Popups } from './Popups'

/** A party member standing on the stage. Clicking it picks it as a target, like its card. */
export function PartyFigure({
  member,
  active,
  reaction,
  popups,
  scale,
  onPick,
}: {
  member: Fighter
  active: boolean
  reaction?: Reaction
  popups: Popup[]
  scale: number
  onPick?: () => void
}) {
  return (
    <Box
      onClick={onPick}
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: onPick ? 'pointer' : 'default',
        borderRadius: 1,
        outline: onPick ? '3px solid #66bb6a' : 'none',
        outlineOffset: 2,
      }}
    >
      <Typography
        sx={{ color: '#ffd54f', lineHeight: 1, visibility: active ? 'visible' : 'hidden' }}
      >
        ▼
      </Typography>
      <Figure fighter={member} reaction={reaction} scale={scale} facing="left" />
      <Popups popups={popups} />
    </Box>
  )
}
