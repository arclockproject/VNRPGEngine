// Achievements with earned ones first-class and secret ones hidden. Used by the journal and Extras.
import { Avatar, Stack, Typography } from '@mui/material'
import { useLang } from '@/core/lang'
import { useAchievements } from '@/core/managers/achievements'

export function AchievementList() {
  const t = useLang()
  const list = useAchievements()
  if (list.length === 0)
    return <Typography color="text.secondary">{t('Nothing here yet.')}</Typography>
  const earned = list.filter((a) => a.unlockedAt).length
  return (
    <Stack spacing={1.5}>
      <Typography variant="body2" color="text.secondary">
        {t('{earned} of {total} earned', { earned, total: list.length })}
      </Typography>
      {list.map(({ id, achievement, unlockedAt }) => {
        const hidden = achievement.secret && !unlockedAt
        return (
          <Stack
            key={id}
            direction="row"
            spacing={1.5}
            sx={{ alignItems: 'center', opacity: unlockedAt ? 1 : 0.45 }}
          >
            <Avatar src={hidden ? undefined : achievement.icon} sx={{ bgcolor: 'warning.main' }}>
              {unlockedAt ? '★' : '?'}
            </Avatar>
            <Stack sx={{ minWidth: 0 }}>
              <Typography>{hidden ? '???' : t(achievement.title)}</Typography>
              <Typography variant="body2" color="text.secondary">
                {hidden ? t('A secret achievement.') : t(achievement.description)}
              </Typography>
            </Stack>
          </Stack>
        )
      })}
    </Stack>
  )
}
