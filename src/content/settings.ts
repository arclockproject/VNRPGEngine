// The game's own settings, next to the engine's (text speed, volume…). Kept per device, like the
// engine's, and erased with "Erase all data". Add a line with its default; its type comes from it.
// Edit freely.
//   game.settings.get('hints') / game.settings.set('hints', 'off'); in React useGameSetting('hints')
//   (from '@/core/managers/gameSettings').
//   Settings window rows: <SettingSwitch gameSetting="bigCursor" label={t('Big cursor')} />, or
//   SettingSelect / SettingSlider with value={useGameSetting('hints')} onChange={putGame('hints')}
//   (src/content/windows/settings/parts.tsx).
// A setting added later gets its default for players who already have settings saved.
import { defineSettings } from '@/core/gameSettings'

export default defineSettings({
  // bigCursor: false,
  // hints: 'on' as 'on' | 'off',
  // brightness: 0.5,
})
