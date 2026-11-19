// The rows of the Settings window: a switch, a select and a slider, each with its name. Labels come
// in translated (t('…') where they are used, so `pnpm lang` finds them).
import {
  FormControlLabel,
  MenuItem,
  Select,
  Slider,
  Switch,
  type SxProps,
  Typography,
} from '@mui/material'
import type { ReactNode } from 'react'
import { type GameSettingId, gameSettings } from '@/core/managers/gameSettings'
import { type GameSettings, type SettingsState, useSettingsStore } from '@/core/stores/settings'

type OnOffKey = {
  [K in keyof SettingsState]: SettingsState[K] extends boolean ? K : never
}[keyof SettingsState]

/** onChange for a plain setting: put('font') stores the picked value. */
export const put =
  <K extends keyof SettingsState>(key: K) =>
  (value: SettingsState[K]) =>
    useSettingsStore.setState((s) => {
      ;(s as SettingsState)[key] = value
    })

/** The game's own on/off settings (src/content/settings.ts). */
type GameOnOffKey = {
  [K in GameSettingId]: GameSettings[K] extends boolean ? K : never
}[GameSettingId]

/** onChange for one of the game's own settings (src/content/settings.ts): putGame('hints'). */
export const putGame =
  <K extends GameSettingId>(id: K) =>
  (value: GameSettings[K]) =>
    gameSettings.set(id, value)

/**
 * An on/off setting: an engine one (`setting`) or one of src/content/settings.ts (`gameSetting`).
 * `then` runs after it is stored (fullscreen also switches the window).
 */
export function SettingSwitch(
  p: { label: string; then?: (on: boolean) => void } & (
    | { setting: OnOffKey; gameSetting?: never }
    | { gameSetting: GameOnOffKey; setting?: never }
  ),
) {
  const checked = useSettingsStore((s) =>
    p.setting ? s[p.setting] : Boolean((s.game as Record<string, unknown>)[p.gameSetting]),
  )
  return (
    <FormControlLabel
      control={
        <Switch
          checked={checked}
          onChange={(_, on) => {
            if (p.setting) put(p.setting)(on)
            else gameSettings.set(p.gameSetting, on as GameSettings[GameOnOffKey])
            p.then?.(on)
          }}
        />
      }
      label={p.label}
    />
  )
}

export interface SelectOption<V> {
  value: V
  label: ReactNode
  sx?: SxProps
}

/** A choice from a list, its name above it; `children` go under it (a description). */
export function SettingSelect<V extends string | number>(p: {
  label: string
  value: V
  options: readonly SelectOption<V>[]
  onChange: (value: V) => void
  children?: ReactNode
}) {
  return (
    <div>
      <Typography variant="body2">{p.label}</Typography>
      <Select
        size="small"
        fullWidth
        value={p.value}
        onChange={(e) => {
          const picked = p.options.find((o) => String(o.value) === String(e.target.value))
          if (picked) p.onChange(picked.value)
        }}
      >
        {p.options.map((o) => (
          <MenuItem key={o.value} value={o.value} sx={o.sx}>
            {o.label}
          </MenuItem>
        ))}
      </Select>
      {p.children}
    </div>
  )
}

/** "40%" for a 0..1 setting. */
export const percent = (v: number) => `${Math.round(v * 100)}%`

/** A number on a slider, its name above it. Default range 0..1 shown as a percentage. */
export function SettingSlider(p: {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  format?: (value: number) => string
}) {
  return (
    <div>
      <Typography variant="body2">{p.label}</Typography>
      <Slider
        value={p.value}
        min={p.min ?? 0}
        max={p.max ?? 1}
        step={p.step ?? 0.05}
        valueLabelDisplay="auto"
        valueLabelFormat={p.format ?? percent}
        onChange={(_, value) => p.onChange(value as number)}
      />
    </div>
  )
}
