// The key/button label of an action for the device in use (no React: the map uses it too).
import { useSystemStore } from '../stores/system'
import { type ButtonGlyph, buttonGlyph, keyLabel } from './glyphs'
import { type ActionName, input } from './manager'

/** The label for an action on the current device, or null (touch, or nothing bound). */
export function actionLabel(
  action: ActionName,
  device = useSystemStore.getState().device,
  kind = useSystemStore.getState().gamepad,
): ButtonGlyph | null {
  const binding = input.bindings(action)
  if (device === 'keyboard') {
    const key = binding.keys?.[0]
    return key ? { label: keyLabel(key) } : null
  }
  if (device === 'gamepad') {
    // The buttons that work right now (the normal ones inside the pause menu / Settings).
    const button = input.liveButtons(action)[0]
    return button === undefined ? null : buttonGlyph(button, kind)
  }
  return null
}
