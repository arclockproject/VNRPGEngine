// Bits the event layer's parts share: keyframes, text sizes, character lookups.
import { keyframes } from '@emotion/react'
import { useRef } from 'react'
import look from '@/content/look'
import { boxLook } from '../../look'
import type { LayeredPortrait } from '../../portrait/define'
import type { SpinePortrait } from '../../portrait/spine'
import { type AudioId, characters } from '../../registry'
import { registerCameraTarget } from '../../scene/effects'
import { type PartName, part } from '../../ui/part'
import { SHORT_SCREEN } from '../screen'

export const appear = keyframes`from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: none }`
export const fade = keyframes`from { opacity: 0 } to { opacity: 1 }`
export const fadeOut = keyframes`from { opacity: 1 } to { opacity: 0 }`
export const blink = keyframes`0%, 100% { opacity: 0.2 } 50% { opacity: 1 }`
export const timerShrink = keyframes`from { transform: scaleX(1) } to { transform: scaleX(0) }`

export const shake = keyframes`
  0%, 100% { transform: translate(0, 0) }
  20% { transform: translate(-2px, 1px) }
  40% { transform: translate(2px, -1px) }
  60% { transform: translate(-1px, -1px) }
  80% { transform: translate(1px, 1px) }
`

/** Registers an element as a camera target while it is mounted. */
export function useCameraTarget() {
  const unregister = useRef<() => void>(() => {})
  return (el: HTMLDivElement | null) => {
    unregister.current()
    unregister.current = registerCameraTarget(el)
  }
}

export const TEXT_SIZE = { small: '0.95rem', normal: '1.15rem', large: '1.6rem' } as const
/** Short game screen (phones held sideways): a smaller dialogue box, so the scene stays visible. */
export const SHORT = SHORT_SCREEN
export const TEXT_SIZE_SHORT = { small: '0.85rem', normal: '1rem', large: '1.3rem' } as const

/**
 * The chat box is two layers: its look (a Paper, faded by "Text box opacity") and the text on top.
 * The text layer takes the look's own sizes (frame widths, padding from `css`, text colour) so the
 * words sit exactly where they would in one box, and draws nothing itself.
 */
export const DIALOG_TEXT_BOX = {
  ...boxLook({ ...look.panel, ...look.dialog }),
  background: 'none',
  borderImage: 'none',
  borderColor: 'transparent',
  boxShadow: 'none',
} as const

export type CharacterInfo = {
  name: string
  color?: string
  portraits?: Record<string, string>
  layered?: LayeredPortrait
  spine?: SpinePortrait
  blip?: AudioId
  chatBox?: { box?: string; name?: string; text?: string }
  stage?: { show?: [number, number]; scale?: number; x?: number; y?: number }
}
export const info = (id: string) => (characters as Record<string, CharacterInfo>)[id]

const warnedParts = new Set<string>()
/**
 * The speaker's own chat box looks (their character file's `chatBox`), as styles to lay over the
 * normal box, name tag and text. Empty for narration, ad hoc speakers, full-page text, and names
 * that are not in src/content/look/parts.ts (a DEV warning says so, once).
 */
export function chatBoxLooks(
  speaker: string | null | undefined,
  nvl = false,
): { box: object; name: object; text: object } {
  const own = (!nvl && speaker && info(speaker)?.chatBox) || {}
  const style = (name: string | undefined): object => {
    if (!name) return NO_LOOK
    if (name in look.parts) return part(name as PartName)
    if (import.meta.env.DEV && !warnedParts.has(name)) {
      warnedParts.add(name)
      console.warn(
        `[events] chatBox of "${speaker}": no look "${name}" in src/content/look/parts.ts`,
      )
    }
    return NO_LOOK
  }
  return { box: style(own.box), name: style(own.name), text: style(own.text) }
}
const NO_LOOK = {}
