import { Button, Stack, Tab, Tabs, Typography } from '@mui/material'
import { useEffect, useState } from 'react'
import screen from '@/content/config/screen'
import scenes from '@/content/scenes'
import { systemVoiceCharacters } from '@/core/audio/systemVoice'
import { voiceLanguages } from '@/core/audio/voiceClips'
import { voicedCharacters } from '@/core/audio/voices'
import { defineWindow } from '@/core/define'
import { game } from '@/core/game'
import { useTabs } from '@/core/input/useTabs'
import { lang, tx, useLang } from '@/core/lang'
import { useDifficulty } from '@/core/managers/difficulty'
import { setFullscreen } from '@/core/platform'
import type { SideImageShow } from '@/core/scenes'
import { selfVoicing } from '@/core/selfVoicing'
import {
  type SettingsState,
  SIDE_IMAGE_SHOW,
  TEXT_SPEED_INSTANT,
  useSettingsStore,
} from '@/core/stores/settings'
import { useSystemStore } from '@/core/stores/system'
import { Controls } from './Controls'
import { percent, put, SettingSelect, SettingSlider, SettingSwitch } from './parts'
import { PICKED, Voices } from './Voices'

type VolumeKey = keyof SettingsState['volume']
const VOLUMES: { key: VolumeKey; label: string }[] = [
  { key: 'master', label: 'Master' },
  { key: 'music', label: 'Music' },
  { key: 'sfx', label: 'Sound effects' },
  { key: 'voice', label: 'Voice' },
  { key: 'movie', label: 'Movies' },
]

/** Language names come from their files, so they load when the window opens. */
function useLanguageNames() {
  const [names, setNames] = useState<Record<string, string>>({ source: lang.source.name })
  useEffect(() => {
    let alive = true
    for (const id of lang.ids) {
      lang
        .name(id)
        .then((name) => alive && setNames((n) => ({ ...n, [id]: name })))
        .catch(() => {})
    }
    return () => {
      alive = false
    }
  }, [])
  return names
}

function GeneralTab() {
  const t = useLang()
  const language = useSettingsStore((s) => s.language)
  const languageNames = useLanguageNames()
  const screenRatio = useSettingsStore((s) => s.screenRatio)
  const cursorAutoHide = useSettingsStore((s) => s.cursorAutoHide)
  // No mouse cursor on touch screens, so the option only shows for keyboard/mouse and pads.
  const touch = useSystemStore((s) => s.device === 'touch')
  const difficulty = useDifficulty()
  // Difficulty belongs to a playthrough: there is none on the title screen.
  const inGame = useSystemStore((s) => s.map !== null && s.title === null)
  // Keyboards don't vibrate: the switch shows for a controller, or a touch device that can buzz.
  const canVibrate = useSystemStore(
    (s) =>
      s.device === 'gamepad' ||
      (s.device === 'touch' && typeof navigator !== 'undefined' && 'vibrate' in navigator),
  )
  const description = game.difficulty.level().description
  return (
    <Stack spacing={1}>
      {lang.ids.length > 0 && (
        <SettingSelect
          label={t('Language')}
          value={language}
          options={['source', ...lang.ids].map((id) => ({
            value: id,
            label: languageNames[id] ?? id,
          }))}
          onChange={put('language')}
        />
      )}
      {inGame && game.difficulty.canChange() && (
        <SettingSelect
          label={t('Difficulty')}
          value={difficulty}
          options={game.difficulty.list().map(({ id, level }) => ({
            value: id,
            label: t(level.name),
          }))}
          onChange={(id) => game.difficulty.set(id)}
        >
          {description && (
            <Typography variant="caption" color="text.secondary">
              {t(description)}
            </Typography>
          )}
        </SettingSelect>
      )}
      <SettingSelect
        label={t('Screen ratio')}
        value={screenRatio}
        options={screen.ratios.map((ratio) => ({
          value: ratio,
          label: ratio === 'fill' ? t('Fill screen') : ratio,
        }))}
        onChange={put('screenRatio')}
      />
      {!touch && (
        <SettingSelect
          label={t('Hide idle mouse')}
          value={cursorAutoHide}
          options={screen.cursorAutoHide.map((seconds) => ({
            value: seconds,
            label: seconds > 0 ? t('After {seconds} s', { seconds }) : t('Never'),
          }))}
          onChange={put('cursorAutoHide')}
        />
      )}
      <SettingSwitch
        setting="fullscreen"
        label={t('Fullscreen (F11)')}
        then={(on) => void setFullscreen(on)}
      />
      {canVibrate && (
        <SettingSwitch setting="vibration" label={t('Vibration (controller, phone)')} />
      )}
      {/* Only when the game has a minimap (screen.ts minimap.show) and maps (not VN mode). */}
      {screen.minimap.show && !game.vnOnly && (
        <SettingSwitch setting="showMinimap" label={t('Show minimap')} />
      )}
      {import.meta.env.DEV && (
        <SettingSwitch setting="showDevPanel" label={t('Dev panel (` key)')} />
      )}
      <Button color="error" variant="outlined" onClick={() => void game.session.wipeAllData()}>
        {t('Erase all data')}
      </Button>
    </Stack>
  )
}

/** Settings → Text → "Face next to the text". */
const SIDE_IMAGE_LABELS: Record<SideImageShow, string> = {
  offstage: tx('When they are not on screen'),
  always: tx('Always'),
  never: tx('Never'),
}

function TextTab() {
  const t = useLang()
  const textSpeed = useSettingsStore((s) => s.textSpeed)
  const autoDelay = useSettingsStore((s) => s.autoDelay)
  const textSize = useSettingsStore((s) => s.textSize)
  const font = useSettingsStore((s) => s.font)
  const boxOpacity = useSettingsStore((s) => s.boxOpacity)
  const sideImage = useSettingsStore((s) => s.sideImage)
  const fonts = game.fonts.choices()
  return (
    <Stack spacing={1}>
      <SettingSelect
        label={t('Text size')}
        value={textSize}
        options={scenes.text.sizes.map((size) => ({ value: size, label: percent(size) }))}
        onChange={put('textSize')}
      />
      {game.fonts.playerPicks() && fonts.length > 1 && (
        <SettingSelect
          label={t('Font')}
          value={font}
          options={fonts.map((choice) => ({
            value: choice.id,
            label: t(choice.name),
            sx: { fontFamily: choice.family ?? undefined },
          }))}
          onChange={put('font')}
        />
      )}
      <SettingSlider
        label={t('Text box opacity')}
        value={boxOpacity}
        onChange={put('boxOpacity')}
      />
      <SettingSelect
        label={t('Face next to the text')}
        value={sideImage}
        options={SIDE_IMAGE_SHOW.map((choice) => ({
          value: choice,
          label: t(SIDE_IMAGE_LABELS[choice]),
        }))}
        onChange={put('sideImage')}
      />
      <SettingSlider
        label={t('Text speed')}
        value={textSpeed}
        min={10}
        max={TEXT_SPEED_INSTANT}
        step={10}
        format={(v) => (v >= TEXT_SPEED_INSTANT ? t('Instant') : `${v} / s`)}
        onChange={put('textSpeed')}
      />
      <SettingSlider
        label={t('Auto-play pause')}
        value={autoDelay}
        min={300}
        max={4000}
        step={100}
        format={(v) => `${(v / 1000).toFixed(1)} s`}
        onChange={put('autoDelay')}
      />
      <SettingSwitch setting="skipUnread" label={t('Skip unread text too')} />
      <SettingSwitch setting="skipAfterChoice" label={t('Keep skipping after a choice')} />
      <SettingSwitch setting="skipEffects" label={t('Finish effects while skipping')} />
      <SettingSwitch setting="reduceMotion" label={t('Reduce shaking and flashes')} />
      {/* Only when the toolbar hides by itself (src/content/scenes.ts toolbar.autoHide). */}
      {scenes.toolbar.autoHide && (
        <SettingSwitch setting="toolbarLocked" label={t('Keep the scene buttons shown')} />
      )}
      {selfVoicing.supported && (
        <SettingSwitch setting="selfVoicing" label={t('Read text aloud')} />
      )}
    </Stack>
  )
}

function AudioTab() {
  const t = useLang()
  const volume = useSettingsStore((s) => s.volume)
  const voiceLanguage = useSettingsStore((s) => s.voiceLanguage)
  const textLanguageNames = useLanguageNames()
  // Voice languages are their own setting (not the text language); only shown when there is a choice.
  const voiceLangs = voiceLanguages()
  const voiceName = (id: string) => {
    const own = scenes.voice.languageNames?.[id]
    return own ? t(own) : (textLanguageNames[id] ?? id)
  }
  return (
    <Stack spacing={1}>
      {VOLUMES.map(({ key, label }) => (
        <SettingSlider
          key={key}
          label={t(label)}
          value={volume[key]}
          onChange={(value) =>
            useSettingsStore.setState((s) => {
              s.volume[key] = value
            })
          }
        />
      ))}
      <SettingSwitch setting="voiceKeep" label={t('Voices play to the end')} />
      <SettingSwitch setting="voiceDuck" label={t('Lower music under voices')} />
      {voiceLangs.length > 1 && (
        <SettingSelect
          label={t('Voice language')}
          value={voiceLangs.includes(voiceLanguage) ? voiceLanguage : (voiceLangs[0] as string)}
          options={voiceLangs.map((id) => ({ value: id, label: voiceName(id) }))}
          onChange={put('voiceLanguage')}
        />
      )}
    </Stack>
  )
}

type SettingsTab = 'general' | 'text' | 'audio' | 'voices' | 'controls'

function Settings() {
  const t = useLang()
  // Rebinding keys means nothing on a touch screen, so the Controls tab only shows while the
  // player uses a keyboard or pad (it comes back as soon as they press a key or button).
  const touch = useSystemStore((s) => s.device === 'touch')
  // Voices only shows when some character has voice clips or system voice clips.
  const hasVoices = voicedCharacters().length > 0 || systemVoiceCharacters().length > 0
  const tabs: SettingsTab[] = [
    'general',
    'text',
    'audio',
    ...(hasVoices ? (['voices'] as const) : []),
    ...(touch ? [] : (['controls'] as const)),
  ]
  const [picked, setTab] = useState<SettingsTab>('general')
  const tab = tabs.includes(picked) ? picked : 'general'
  useTabs(setTab, tabs)

  return (
    <Stack spacing={2}>
      <Tabs
        value={tab}
        onChange={(_, value) => setTab(value)}
        variant="fullWidth"
        data-nav-down={tab === 'voices' ? PICKED : undefined}
      >
        <Tab value="general" label={t('General')} />
        <Tab value="text" label={t('Text')} />
        <Tab value="audio" label={t('Audio')} />
        {hasVoices && <Tab value="voices" label={t('Voices')} />}
        {!touch && <Tab value="controls" label={t('Controls')} />}
      </Tabs>
      {tab === 'general' && <GeneralTab />}
      {tab === 'text' && <TextTab />}
      {tab === 'audio' && <AudioTab />}
      {tab === 'voices' && <Voices />}
      {tab === 'controls' && <Controls />}
    </Stack>
  )
}

// Wide enough for the keyboard picture in Controls; never wider than the screen.
export default defineWindow({ title: 'Settings', component: Settings, width: 880 })
