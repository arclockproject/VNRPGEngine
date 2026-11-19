import { Paper, Typography } from '@mui/material'
import type { Battle, Fighter } from '@/core/battle/engine'
import { useLang } from '@/core/lang'
import { hurt } from './animations'
import { Bar } from './Bar'
import { StatusIcons } from './StatusIcons'

/** A party member's status card (name, HP, MP, statuses) under the stage. */
export function MemberCard({
  battle,
  member,
  active,
  hitKey,
  small,
  onPick,
}: {
  battle: Battle
  member: Fighter
  active: boolean
  hitKey: number
  /** A short screen: a narrower card. */
  small?: boolean
  onPick?: () => void
}) {
  const t = useLang()
  const maxHp = battle.maxHp(member)
  const maxMp = battle.maxMp(member)
  return (
    <Paper
      component={onPick ? 'button' : 'div'}
      onClick={onPick}
      key={hitKey}
      data-fighter={onPick ? member.key : undefined}
      sx={{
        p: small ? 0.75 : 1,
        width: small ? 128 : 170,
        flexShrink: 0,
        textAlign: 'left',
        font: 'inherit',
        color: 'inherit',
        cursor: onPick ? 'pointer' : 'default',
        border: '2px solid',
        borderColor: active ? 'warning.main' : onPick ? 'success.main' : 'transparent',
        opacity: member.hp <= 0 ? 0.5 : 1,
        animation: hitKey > 0 ? `${hurt} 250ms` : 'none',
      }}
    >
      <Typography variant="subtitle2">{t(member.name)}</Typography>
      <Typography variant="caption">
        HP {member.hp}/{maxHp}
      </Typography>
      <Bar value={member.hp} max={maxHp} color="error" />
      {maxMp > 0 && (
        <>
          <Typography variant="caption">
            MP {member.mp}/{maxMp}
          </Typography>
          <Bar value={member.mp} max={maxMp} color="info" />
        </>
      )}
      <StatusIcons battle={battle} fighter={member} />
    </Paper>
  )
}
