// The music room's controls (Extras -> Music), VN style: what plays, a seek bar with the
// time, previous / play-pause / stop / next, repeat and shuffle. Edit freely: the engine plays the
// music (core/audio/musicPlayer.ts) and gives the state and the actions as props.
// Keys / pad: every button and the bar can be reached with the arrows / d-pad (left / right on the
// bar seek); Y (or H) plays / pauses anywhere on the tab. Touch / mouse: tap, drag the bar.
import { Box, IconButton, Slider, Stack, SvgIcon, Typography } from '@mui/material'
import { useEffect, useState } from 'react'
import { useLang } from '@/core/lang'
import type { MusicPlayerSlotProps } from '@/core/slots'

const ICONS = {
  play: 'M8 5v14l11-7z',
  pause: 'M6 19h4V5H6v14zm8-14v14h4V5h-4z',
  stop: 'M6 6h12v12H6z',
  previous: 'M6 6h2v12H6zm3.5 6 8.5 6V6z',
  next: 'M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z',
  repeat: 'M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z',
  repeatOne:
    'M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z',
  shuffle:
    'M10.59 9.17 5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z',
} as const

function Icon({ path }: { path: string }) {
  return (
    <SvgIcon>
      <path d={path} />
    </SvgIcon>
  )
}

/** 75000 -> "1:15". */
function time(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function MusicPlayer(p: MusicPlayerSlotProps) {
  const t = useLang()
  // While the bar is dragged it shows the drag, and seeks once on release.
  const [dragging, setDragging] = useState<number | null>(null)
  useEffect(() => {
    if (!p.title) setDragging(null)
  }, [p.title])
  const shown = dragging ?? p.positionMs
  const repeatLabel =
    p.repeat === 'one'
      ? t('Repeat: this track')
      : p.repeat === 'all'
        ? t('Repeat: all')
        : t('Repeat: off')
  return (
    <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: 'action.hover' }}>
      <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
        {p.title ?? t('Pick a track')}
      </Typography>
      <Stack direction="row" sx={{ alignItems: 'center' }}>
        <Typography variant="caption" sx={{ minWidth: 40, flexShrink: 0, textAlign: 'right' }}>
          {time(shown)}
        </Typography>
        {/* The slider's look reaches past its box: padding keeps it off the times. */}
        <Box sx={{ flex: 1, minWidth: 0, px: 2.5, display: 'flex', alignItems: 'center' }}>
          <Slider
            size="small"
            disabled={!p.title || p.durationMs <= 0}
            min={0}
            max={Math.max(1, p.durationMs)}
            step={1000}
            value={Math.min(shown, p.durationMs)}
            aria-label={t('Position')}
            valueLabelDisplay="off"
            onChange={(_, value) => setDragging(value as number)}
            onChangeCommitted={(_, value) => {
              setDragging(null)
              p.onSeek(value as number)
            }}
          />
        </Box>
        <Typography variant="caption" sx={{ minWidth: 40, flexShrink: 0 }}>
          {time(p.durationMs)}
        </Typography>
      </Stack>
      <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'center', alignItems: 'center' }}>
        <IconButton
          aria-label={t('Shuffle')}
          aria-pressed={p.shuffle}
          color={p.shuffle ? 'primary' : 'default'}
          onClick={p.onShuffle}
        >
          <Icon path={ICONS.shuffle} />
        </IconButton>
        <IconButton aria-label={t('Previous')} onClick={p.onPrevious}>
          <Icon path={ICONS.previous} />
        </IconButton>
        <IconButton aria-label={p.playing ? t('Pause') : t('Play')} onClick={p.onToggle}>
          <Icon path={p.playing ? ICONS.pause : ICONS.play} />
        </IconButton>
        <IconButton aria-label={t('Stop')} disabled={!p.title} onClick={p.onStop}>
          <Icon path={ICONS.stop} />
        </IconButton>
        <IconButton aria-label={t('Next')} onClick={p.onNext}>
          <Icon path={ICONS.next} />
        </IconButton>
        <IconButton
          aria-label={repeatLabel}
          title={repeatLabel}
          color={p.repeat === 'off' ? 'default' : 'primary'}
          onClick={p.onRepeat}
        >
          <Icon path={p.repeat === 'one' ? ICONS.repeatOne : ICONS.repeat} />
        </IconButton>
      </Stack>
    </Box>
  )
}
