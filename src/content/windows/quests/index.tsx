import { Chip, Stack, Typography } from '@mui/material'
import { defineWindow } from '@/core/define'
import { useLang } from '@/core/lang'
import { useQuests } from '@/core/managers/quests'

// Quest log: game.windows.open('quests').
function Quests() {
  const t = useLang()
  const quests = useQuests()
  if (quests.length === 0)
    return <Typography color="text.secondary">{t('No quests yet.')}</Typography>

  return (
    <Stack spacing={2}>
      {quests.map(({ id, quest, status, steps }) => (
        <Stack key={id} spacing={0.5}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Typography variant="subtitle1" sx={{ flex: 1 }}>
              {t(quest.title)}
            </Typography>
            {status !== 'active' && (
              <Chip
                size="small"
                color={status === 'done' ? 'success' : 'error'}
                label={t(status === 'done' ? 'Done' : 'Failed')}
              />
            )}
          </Stack>
          {quest.description && (
            <Typography variant="body2" color="text.secondary">
              {t(quest.description)}
            </Typography>
          )}
          {/* Finished steps, the current one, and masked ones ("???" until their `when` is true). */}
          {steps.map(({ id: stepId, text, masked, done, current }) => {
            return (
              <Typography
                key={stepId}
                color={masked ? 'text.secondary' : undefined}
                variant="body2"
                sx={{
                  textDecoration: done ? 'line-through' : 'none',
                  opacity: done ? 0.6 : 1,
                  fontWeight: current ? 600 : 400,
                }}
              >
                {done ? '✓' : '•'} {t(text)}
              </Typography>
            )
          })}
        </Stack>
      ))}
    </Stack>
  )
}

export default defineWindow({ title: 'Quests', component: Quests, width: 420 })
