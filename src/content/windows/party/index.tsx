// Party: levels, HP/MP, stats and equipment of each member. game.windows.open('party').
import { Box, LinearProgress, MenuItem, Paper, Select, Stack, Typography } from '@mui/material'
import { defineWindow } from '@/core/define'
import { game } from '@/core/game'
import { useLang } from '@/core/lang'
import { useInventory } from '@/core/managers/items'
import { useMember, usePartyMembers, usePartyStatuses, xpForLevel } from '@/core/managers/party'
import type { CharacterId, ItemId, SlotId } from '@/core/registry'

const NONE = '__none'

function Bar({
  value,
  max,
  color,
}: {
  value: number
  max: number
  color: 'error' | 'info' | 'warning'
}) {
  return (
    <LinearProgress
      variant="determinate"
      color={color}
      value={max > 0 ? (value / max) * 100 : 0}
      sx={{ borderRadius: 3, flex: 1 }}
    />
  )
}

function Member({ id }: { id: CharacterId }) {
  const t = useLang()
  const member = useMember(id)
  const carried = Object.keys(usePartyStatuses(id))
  useInventory() // equippable items change with the inventory
  if (!member) return null
  const pools = game.party.stats.filter((s) => game.party.isPool(s))
  const others = game.party.stats.filter((s) => !game.party.isPool(s))
  const levelStart = xpForLevel(member.level)
  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Stack spacing={1}>
        <Stack direction="row" sx={{ alignItems: 'baseline' }}>
          <Typography variant="subtitle1" sx={{ flex: 1 }}>
            {t(member.name)}
          </Typography>
          <Typography variant="body2">{t('Level {level}', { level: member.level })}</Typography>
        </Stack>
        {pools.map((stat, i) => (
          <Stack key={stat} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Typography variant="caption" sx={{ width: 28 }}>
              {t(game.party.statName(stat))}
            </Typography>
            <Bar
              value={member.current[stat] ?? 0}
              max={member.stats[stat]}
              color={i === 0 ? 'error' : 'info'}
            />
            <Typography variant="caption" sx={{ width: 56, textAlign: 'right' }}>
              {member.current[stat] ?? 0} / {member.stats[stat]}
            </Typography>
          </Stack>
        ))}
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Typography variant="caption" sx={{ width: 28 }}>
            XP
          </Typography>
          <Bar
            value={member.xp - levelStart}
            max={(member.nextLevelXp ?? member.xp) - levelStart}
            color="warning"
          />
          <Typography variant="caption" sx={{ width: 56, textAlign: 'right' }}>
            {member.nextLevelXp === null ? t('Max') : `${member.xp} / ${member.nextLevelXp}`}
          </Typography>
        </Stack>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.5 }}>
          {others.map((stat) => (
            <Typography key={stat} variant="body2">
              {t(game.party.statName(stat))}: <b>{member.stats[stat]}</b>
            </Typography>
          ))}
        </Box>
        {carried.length > 0 && (
          <Typography variant="body2" color="warning.main">
            {carried
              .map((status) => {
                const info = game.battles.statusInfo(status)
                return `${info?.icon ?? ''} ${t(info?.name ?? status)}`.trim()
              })
              .join(' · ')}
          </Typography>
        )}
        {game.party.slots.map((slot) => (
          <Slot key={slot} id={id} slot={slot} worn={member.equipment[slot]} />
        ))}
      </Stack>
    </Paper>
  )
}

function Slot({ id, slot, worn }: { id: CharacterId; slot: SlotId; worn: ItemId | undefined }) {
  const t = useLang()
  const options = game.party.equippable(slot)
  const describe = (item: ItemId) => {
    const stats = game.items.info(item).equip?.stats ?? {}
    const bonus = Object.entries(stats)
      .map(([stat, n]) => `${t(game.party.statName(stat as never))} +${n}`)
      .join(', ')
    return `${t(game.items.info(item).name)} (${bonus})`
  }
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <Typography variant="body2" sx={{ width: 80 }}>
        {t(game.party.slotName(slot))}
      </Typography>
      <Select
        size="small"
        sx={{ flex: 1 }}
        value={worn ?? NONE}
        onChange={(e) => {
          const value = e.target.value as string
          if (value === NONE) game.party.unequip(id, slot)
          else game.party.equip(id, value as ItemId)
        }}
      >
        <MenuItem value={NONE}>{t('(nothing)')}</MenuItem>
        {worn && <MenuItem value={worn}>{describe(worn)}</MenuItem>}
        {options.map((item) => (
          <MenuItem key={item} value={item}>
            {describe(item)}
          </MenuItem>
        ))}
      </Select>
    </Stack>
  )
}

function Party() {
  const t = useLang()
  const members = usePartyMembers()
  if (members.length === 0)
    return <Typography color="text.secondary">{t('Nobody is in the party.')}</Typography>
  return (
    <Stack spacing={1.5}>
      {members.map((id) => (
        <Member key={id} id={id} />
      ))}
    </Stack>
  )
}

export default defineWindow({ title: 'Party', component: Party, width: 440 })
