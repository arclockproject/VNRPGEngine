// Quick save and quick load keys (src/content/config/input.ts: F5 / F9), on the map and in scenes,
// and the screenshot (F8) and fullscreen (F11) keys everywhere.
import { useAction } from '../input/useAction'
import { isFullscreen, setFullscreen } from '../platform'
import { save } from '../save/manager'
import { screenshot } from '../screenshot'

export function QuickKeys() {
  useAction(
    'quickSave',
    (e) => {
      if (!e.repeat) save.quickSave()
    },
    { layers: ['map', 'event'] },
  )
  useAction(
    'quickLoad',
    (e) => {
      if (!e.repeat) void save.quickLoad()
    },
    { layers: ['map', 'event'] },
  )
  // Everywhere, also on the title screen and in windows.
  useAction(
    'screenshot',
    (e) => {
      if (!e.repeat) void screenshot()
    },
    { layers: ['map', 'event', 'minigame', 'windows', 'title'] },
  )
  // Desktop and browser (Electron no longer catches F11 itself, so this can be rebound).
  useAction(
    'fullscreen',
    (e) => {
      if (!e.repeat) void isFullscreen().then((on) => setFullscreen(!on))
    },
    { layers: ['map', 'event', 'minigame', 'windows', 'title'] },
  )
  return null
}
