// Readable names for keys and gamepad buttons (button prompts, rebinding screen), from
// src/content/look/glyphs.ts.
import glyphs from '@/content/look/glyphs'
import type { GamepadKind } from '../stores/system'
import type { ButtonGlyph } from './define'
import { swapFace } from './faceSwap'

export type { ButtonGlyph } from './define'

/** KeyboardEvent.code -> label: 'KeyW' -> 'W', 'Digit1' -> '1', 'ArrowUp' -> '↑'. */
export function keyLabel(code: string): string {
  const named = glyphs.keys?.[code]
  if (named) return named
  if (/^Key[A-Z]$/.test(code)) return code.slice(3)
  if (/^Digit\d$/.test(code)) return code.slice(5)
  if (/^Numpad\d$/.test(code)) return `Num ${code.slice(6)}`
  return code
}

/**
 * The name of a bound button (an index as the bindings use it): with "Confirm with" swapped
 * (faceSwap.ts), the bottom and right buttons show each other's names, as they act.
 */
export function buttonGlyph(index: number, kind: GamepadKind): ButtonGlyph {
  const onPad = swapFace(index, kind)
  return glyphs.gamepads?.[kind]?.[onPad] ?? { label: `#${onPad}` }
}
