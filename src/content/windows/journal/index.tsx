// The journal: entries found in this playthrough (game.codex) and achievements.
import { Box, Stack, Tab, Tabs, Typography } from '@mui/material'
import { useState } from 'react'
import { defineWindow } from '@/core/define'
import { useTabs } from '@/core/input/useTabs'
import { useLang } from '@/core/lang'
import { useCodex } from '@/core/managers/codex'
import type { CodexId } from '@/core/registry'
import { AchievementList } from '../_shared/AchievementList'

function Codex() {
  const t = useLang()
  const groups = useCodex()
  const [openId, setOpen] = useState<CodexId | null>(null)
  const open = groups.flatMap((g) => g.entries).find((e) => e.id === openId)
  if (groups.length === 0)
    return <Typography color="text.secondary">{t('Nothing written down yet.')}</Typography>
  return (
    <Stack direction="row" spacing={2} sx={{ minHeight: 220 }}>
      <Stack spacing={1.5} sx={{ width: 150, flexShrink: 0 }}>
        {groups.map(({ category, entries }) => (
          <Stack key={category} spacing={0.25}>
            <Typography variant="overline" color="text.secondary">
              {t(category)}
            </Typography>
            {entries.map((e) => (
              <Box
                key={e.id}
                component="button"
                type="button"
                onClick={() => setOpen(e.id)}
                sx={{
                  all: 'unset',
                  cursor: 'pointer',
                  px: 1,
                  py: 0.5,
                  borderRadius: 1,
                  bgcolor: openId === e.id ? 'action.selected' : 'transparent',
                  '&:hover, &:focus-visible': { bgcolor: 'action.hover' },
                }}
              >
                {t(e.entry.title)}
              </Box>
            ))}
          </Stack>
        ))}
      </Stack>
      <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
        {open ? (
          <>
            <Typography variant="h6">{t(open.entry.title)}</Typography>
            {open.entry.image && (
              <Box component="img" src={open.entry.image} alt="" sx={{ maxWidth: '100%' }} />
            )}
            <Typography>{t(open.entry.text)}</Typography>
          </>
        ) : (
          <Typography color="text.secondary">{t('Pick an entry.')}</Typography>
        )}
      </Stack>
    </Stack>
  )
}

function Journal() {
  const t = useLang()
  const [tab, setTab] = useState<'codex' | 'achievements'>('codex')
  useTabs(setTab, ['codex', 'achievements'] as const)
  return (
    <Stack spacing={2}>
      <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="fullWidth">
        <Tab value="codex" label={t('Journal')} />
        <Tab value="achievements" label={t('Achievements')} />
      </Tabs>
      {tab === 'codex' ? <Codex /> : <AchievementList />}
    </Stack>
  )
}

export default defineWindow({ title: 'Journal', component: Journal, width: 560 })
