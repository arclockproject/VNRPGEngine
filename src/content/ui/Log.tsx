// The log (backlog): the lines read so far in this scene. Edit freely: the panel, the line layout,
// the buttons' symbols or icons. Keys / pad: up / down scroll (down at the end closes), left / right
// pick a line's button, confirm presses it, cancel closes.
// From @/core/ui/Log: put the lines in <LogList> (the engine scrolls it) and each line button in a
// <LogButton> (left / right step through them). The dark cover behind: `logCover` in look/parts.ts.
import { Box, IconButton, Paper, Stack, Typography } from '@mui/material'
import { useLang } from '@/core/lang'
import type { LogSlotProps } from '@/core/slots'
import { LogButton, LogList } from '@/core/ui/Log'
import { part } from '@/core/ui/part'

export function Log({ entries, close, hasButtons, textSize }: LogSlotProps) {
  const t = useLang()
  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        ...part('logCover'),
        display: 'grid',
        placeItems: 'center',
        p: 2,
      }}
    >
      <Paper
        sx={{
          width: 'min(760px, 100%)',
          maxHeight: '80cqh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Stack
          direction="row"
          sx={{ alignItems: 'center', px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}
        >
          <Typography variant="subtitle1" sx={{ flex: 1 }}>
            {t('Log')}
          </Typography>
          {hasButtons && (
            <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
              {t('◀ ▶ pick a line')}
            </Typography>
          )}
          <IconButton size="small" aria-label={t('Close log')} onClick={close}>
            ✕
          </IconButton>
        </Stack>
        <LogList sx={{ p: 2 }}>
          {entries.length === 0 && (
            <Typography color="text.secondary">{t('Nothing yet.')}</Typography>
          )}
          {entries.map((entry, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: log lines have no id and never reorder
            <Stack key={i} direction="row" spacing={1} sx={{ mb: 1.5, alignItems: 'flex-start' }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                {entry.name && (
                  <Typography
                    variant="caption"
                    sx={{ color: entry.color ?? 'text.secondary', fontWeight: 700 }}
                  >
                    {entry.name}
                  </Typography>
                )}
                <Typography
                  color={entry.name ? 'text.primary' : 'text.secondary'}
                  sx={{
                    fontSize: `${textSize}rem`,
                    lineBreak: 'strict',
                    overflowWrap: 'break-word',
                  }}
                >
                  {entry.text}
                </Typography>
              </Box>
              {entry.jumpBack && (
                <LogButton label={t('Jump back here')} onPress={entry.jumpBack}>
                  ↩
                </LogButton>
              )}
              {entry.replay && (
                <LogButton label={t('Play the voice again')} onPress={entry.replay}>
                  ▶
                </LogButton>
              )}
              {entry.star && (
                <LogButton
                  label={t(
                    entry.star.on ? 'Remove from favourite voices' : 'Add to favourite voices',
                  )}
                  pressed={entry.star.on}
                  onPress={entry.star.toggle}
                >
                  {entry.star.on ? '★' : '☆'}
                </LogButton>
              )}
            </Stack>
          ))}
        </LogList>
      </Paper>
    </Box>
  )
}
