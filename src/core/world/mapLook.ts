// The map's text and speech bubbles, from src/content/look/map.ts with today's look as the default
// for anything left out (content written before a setting existed keeps working).
import type { TextStyleOptions } from 'pixi.js'
import mapLook from '@/content/look/map'
import { withFallbacks } from '../fontList'
import type { LookMapText } from '../look'

const FONT = 'system-ui, sans-serif'

function textStyle(look: LookMapText | undefined, base: Required<LookMapText>): TextStyleOptions {
  const merged = { ...base, ...look }
  return {
    fontFamily: withFallbacks(merged.font),
    fontSize: merged.size,
    fontWeight: merged.weight as TextStyleOptions['fontWeight'],
    fill: merged.color,
    ...(merged.outlineWidth > 0 && merged.outline !== 'transparent'
      ? { stroke: { color: merged.outline, width: merged.outlineWidth } }
      : {}),
  }
}

const LABEL: Required<LookMapText> = {
  font: FONT,
  size: 13,
  weight: 'normal',
  color: '#ffffff',
  outline: '#000000',
  outlineWidth: 3,
}

/** Name labels over objects and NPCs. */
export const labelStyle = textStyle(mapLook.label, LABEL)

/** The "press A" prompt over the player. */
export const promptStyle = textStyle(mapLook.prompt, { ...LABEL, size: 22 })

/** The prompt's text on touch screens. */
export const promptTouchText = mapLook.prompt?.touch ?? '!'

const b = mapLook.bubble ?? {}
/** Speech bubbles (npc.bark). */
export const bubbleLook = {
  fill: b.fill ?? '#ffffff',
  outline: b.outline ?? '#1d1d1d',
  outlineWidth: b.outlineWidth ?? 2,
  radius: b.radius ?? 8,
  padding: b.padding ?? 7,
  tail: b.tail ?? 7,
  maxWidth: b.maxWidth ?? 200,
  font: withFallbacks(b.text?.font ?? FONT),
  size: b.text?.size ?? 14,
  weight: b.text?.weight ?? 'normal',
  color: b.text?.color ?? '#1d1d1d',
  fadeMs: b.fadeMs ?? 150,
  time: {
    minMs: b.time?.minMs ?? 1500,
    maxMs: b.time?.maxMs ?? 6000,
    baseMs: b.time?.baseMs ?? 900,
    perLetterMs: b.time?.perLetterMs ?? 55,
  },
}
