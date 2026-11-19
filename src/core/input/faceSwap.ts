// Settings → Controls "Confirm with": Nintendo controllers confirm with the RIGHT face button (A), the
// rest with the bottom one. Bindings name the bottom one GamepadButton.A (0) and the right one B (1);
// with the swap on, the two trade places when the pad is read, when a press is recorded for
// rebinding, and when a button's name is shown, so all three always agree.
import { type ConfirmButton, useSettingsStore } from '../stores/settings'
import type { GamepadKind } from '../stores/system'

/** Whether the bottom and right face buttons trade places for this kind of controller. */
export function faceSwapped(
  kind: GamepadKind,
  setting: ConfirmButton = useSettingsStore.getState().confirmButton,
): boolean {
  return setting === 'right' || (setting === 'auto' && kind === 'nintendo')
}

/** A button index as the bindings mean it <-> the button on the pad (the same swap both ways). */
export function swapFace(index: number, kind: GamepadKind): number {
  if (!faceSwapped(kind)) return index
  return index === 0 ? 1 : index === 1 ? 0 : index
}
