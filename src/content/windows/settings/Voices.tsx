// Settings → Voices: a portrait per voiced character, and one volume row for the picked one. Below
// them, who speaks the system voice (src/content/audio/system_voice), when any character has one.
import { Box, ButtonBase, IconButton, Slider, Stack, SvgIcon, Typography } from '@mui/material'
import { useEffect, useState } from 'react'
import { cream, gold } from '@/content/look/colors'
import { systemVoice, systemVoiceCharacters } from '@/core/audio/systemVoice'
import { voicedCharacters } from '@/core/audio/voices'
import { useLang } from '@/core/lang'
import { isAndroid } from '@/core/platform'
import { type CharacterId, characters } from '@/core/registry'
import { useSettingsStore } from '@/core/stores/settings'
import { useSystemStore } from '@/core/stores/system'
import { CharacterFace, hasFace } from '@/core/ui/CharacterFace'
import { SettingSelect } from './parts'

const set = useSettingsStore.setState

/** The face of their default portrait (their face box), or their initial when they have none. */
function Face({ id }: { id: CharacterId }) {
  const info = characters[id] as { name: string; color?: string } | undefined
  if (hasFace(id)) return <CharacterFace id={id} />
  // No portraits yet: the character's colour with their initial.
  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        display: 'grid',
        placeItems: 'center',
        bgcolor: info?.color ?? 'grey.600',
        color: 'common.black',
        fontSize: 32,
        fontWeight: 800,
        opacity: 0.85,
      }}
    >
      {info?.name.charAt(0)}
    </Box>
  )
}

const SPEAKER_ON =
  'M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z'
const SPEAKER_OFF =
  'M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.8 8.8 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z'

/** The picked portrait: where up from the volume row (and down from the tabs) goes. */
export const PICKED = '[data-voice-tile][aria-pressed="true"]'

/** Portrait tile width and the gap between tiles, in px. */
const TILE = 88
const GAP = 8
/** Space inside the scrolling box, so the picked portrait's outline is not cut off. */
const PAD = 4
/** Rows of portraits before they spill to the right (and scroll): phones keep one row. */
const ROWS = { phone: 1, other: 2 }

/** How many tiles fit across `el` (measured, so it follows window and screen size). */
function useTilesAcross() {
  const [el, setEl] = useState<HTMLElement | null>(null)
  const [across, setAcross] = useState(1)
  useEffect(() => {
    if (!el) return
    const measure = () =>
      setAcross(Math.max(1, Math.floor((el.clientWidth - 2 * PAD + GAP) / (TILE + GAP))))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [el])
  return [setEl, across] as const
}

/**
 * Rows fill left to right, top to bottom. Up to `maxRows` rows; once those are full, the
 * columns grow past the visible width and the grid scrolls sideways.
 */
function gridShape(count: number, across: number, maxRows: number) {
  const rows = Math.min(maxRows, Math.max(1, Math.ceil(count / across)))
  return { rows, columns: Math.max(Math.min(count, across), Math.ceil(count / rows)) }
}

export function Voices() {
  const t = useLang()
  // Characters with line voices, then those who only have system voice clips.
  const lines = voicedCharacters()
  const system = systemVoiceCharacters()
  const voiced = [...lines, ...system.filter((c) => !lines.some((l) => l.id === c.id))]
  const systemPick = useSettingsStore((s) => s.systemVoice)
  const volumes = useSettingsStore((s) => s.voiceVolumes)
  const muted = useSettingsStore((s) => s.voiceMuted)
  const [picked, setPicked] = useState<CharacterId | undefined>(voiced[0]?.id)
  const current = voiced.find((c) => c.id === picked) ?? voiced[0]
  const phone = useSystemStore((s) => isAndroid || s.device === 'touch')
  const [gridRef, across] = useTilesAcross()
  const { columns } = gridShape(voiced.length, across, phone ? ROWS.phone : ROWS.other)
  if (!current)
    return <Typography color="text.secondary">{t('No character has a voice.')}</Typography>
  const isMuted = muted[current.id] ?? false

  return (
    <Stack spacing={1.5}>
      <Box
        ref={gridRef}
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, ${TILE}px)`,
          gap: `${GAP}px`,
          overflowX: 'auto',
          overflowY: 'hidden',
          p: `${PAD}px`,
          m: `-${PAD}px`,
        }}
      >
        {voiced.map(({ id, name }, index) => {
          const selected = id === current.id
          return (
            <ButtonBase
              key={id}
              data-voice-tile=""
              // Pad / arrows: down from a portrait with nothing under it goes to the mute button
              // (it sits left of the slider, where left/right only change the volume).
              data-nav-down={index + columns >= voiced.length ? '[data-voice-mute]' : undefined}
              aria-pressed={selected}
              onClick={() => setPicked(id)}
              sx={{
                flexDirection: 'column',
                alignItems: 'stretch',
                borderRadius: 1,
                overflow: 'hidden',
                bgcolor: 'action.hover',
                outline: '2px solid',
                outlineColor: selected ? gold : 'transparent',
                outlineOffset: 2,
                transition: 'outline-color 120ms',
                '&.Mui-focusVisible': {
                  outlineColor: selected ? cream : 'text.secondary',
                },
              }}
            >
              <Box
                sx={{
                  position: 'relative',
                  aspectRatio: '1',
                  overflow: 'hidden',
                  filter: muted[id] ? 'grayscale(1) brightness(0.6)' : 'none',
                }}
              >
                <Face id={id} />
              </Box>
              <Typography variant="caption" noWrap sx={{ px: 0.5, py: 0.25, textAlign: 'center' }}>
                {t(name)}
              </Typography>
            </ButtonBase>
          )
        })}
      </Box>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }} data-nav-up={PICKED}>
        <IconButton
          data-voice-mute=""
          aria-label={
            isMuted
              ? t('Unmute {name}', { name: t(current.name) })
              : t('Mute {name}', { name: t(current.name) })
          }
          aria-pressed={isMuted}
          color={isMuted ? 'error' : 'default'}
          onClick={() =>
            set((s) => {
              s.voiceMuted[current.id] = !isMuted
            })
          }
        >
          <SvgIcon>
            <path d={isMuted ? SPEAKER_OFF : SPEAKER_ON} />
          </SvgIcon>
        </IconButton>
        <Typography variant="body2" noWrap sx={{ width: 80 }}>
          {t(current.name)}
        </Typography>
        <Slider
          value={volumes[current.id] ?? 1}
          disabled={isMuted}
          min={0}
          max={1}
          step={0.05}
          valueLabelDisplay="auto"
          valueLabelFormat={(v) => `${Math.round(v * 100)}%`}
          aria-label={t('{name} voice volume', { name: t(current.name) })}
          onChange={(_, value) =>
            set((s) => {
              s.voiceVolumes[current.id] = value as number
            })
          }
        />
      </Stack>
      {system.length > 0 && (
        <SettingSelect
          label={t('System voice')}
          value={systemPick}
          options={[
            { value: 'random', label: t('Random') },
            ...system.map((c) => ({ value: c.id as string, label: t(c.name) })),
            { value: 'off', label: t('Off') },
          ]}
          onChange={(value) => {
            set((s) => {
              s.systemVoice = value
            })
            // They say hello (the cue "picked"), if they have that clip.
            void systemVoice.play('picked')
          }}
        />
      )}
    </Stack>
  )
}
