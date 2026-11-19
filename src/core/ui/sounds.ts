// Plays the UI sounds from src/content/look/sounds.ts: focus moves, clicks, tabs, switches and
// windows opening / closing. Elements choose with data-sound="name" or data-sound="none".
// data-voice="<cue>" also plays the system voice's clip for that cue (core/audio/systemVoice.ts).
import look from '@/content/look'
import { audio } from '../audio/manager'
import { systemVoice } from '../audio/systemVoice'
import { input } from '../input/manager'
import type { LookSound } from '../look'
import { useSystemStore } from '../stores/system'

const CONTROL =
  'button, a[href], input, select, [role="button"], [role="tab"], [role="menuitem"], [role="option"], [role="slider"], [role="combobox"], [tabindex]:not([tabindex="-1"])'

// When several things happen in one go (a click that closes a window), only the first in this
// list is heard.
const ORDER = ['open', 'close', 'tab', 'toggle', 'click', 'move', 'hover']

/** How long after a key / pad press a focus change still counts as moved by the player. */
const MOVE_WINDOW_MS = 250

let pending: string | null = null
let lastKeyAt = -Infinity
let lastPointerAt = -Infinity
let hovered: Element | null = null

function rank(name: string) {
  const index = ORDER.indexOf(name)
  // Custom names (data-sound="buy") were asked for by the element: they beat the defaults.
  return index === -1 ? -1 : index
}

/** Plays a UI sound by name. Safe to call often: one sound per moment. */
export function uiSound(name: string): void {
  const sounds: Record<string, LookSound | undefined> = look.sounds ?? {}
  if (!sounds[name]) return
  if (pending === null) {
    setTimeout(() => {
      const sound = pending ? sounds[pending] : undefined
      pending = null
      if (!sound) return
      if (typeof sound === 'string') audio.sfx(sound)
      else audio.sfx(sound.id, { volume: sound.volume })
    }, 0)
    pending = name
  } else if (rank(name) < rank(pending)) pending = name
}

function control(target: EventTarget | null): Element | null {
  return target instanceof Element ? target.closest(CONTROL) : null
}

/** The sound an element asks for, or the default for what it is. null = silent. */
function soundOf(element: Element, fallback: string): string | null {
  const own = element.closest('[data-sound]')?.getAttribute('data-sound')
  if (own === 'none') return null
  if (own) return own
  if (element.matches('.Mui-disabled, :disabled, [aria-disabled="true"]')) return null
  return fallback
}

function onClick(e: MouseEvent) {
  const element = control(e.target)
  if (!element) return
  const kind = element.matches('[role="tab"]')
    ? 'tab'
    : element.matches('input[type="checkbox"], input[type="radio"]')
      ? 'toggle'
      : 'click'
  const name = soundOf(element, kind)
  if (name) uiSound(name)
}

function onFocusIn(e: FocusEvent) {
  // Only when the player moved it: not a click, and not a window focusing its first button.
  const now = performance.now()
  if (now - lastKeyAt > MOVE_WINDOW_MS || now - lastPointerAt < MOVE_WINDOW_MS) return
  const element = control(e.target)
  // A custom data-sound is for clicking the element, not for passing over it.
  if (element && soundOf(element, 'move') !== null) uiSound('move')
}

function onPointerOver(e: PointerEvent) {
  if (e.pointerType !== 'mouse') return
  const element = control(e.target)
  if (element === hovered) return
  hovered = element
  if (element && soundOf(element, 'hover') !== null) uiSound('hover')
}

const MOVES = new Set<string>(['up', 'down', 'left', 'right'])

/** data-voice="<cue>": the system voice says it (a disabled control says nothing). */
function onVoiceClick(e: MouseEvent) {
  const element = control(e.target)
  const cue = element?.closest('[data-voice]')?.getAttribute('data-voice')
  if (!element || !cue) return
  if (element.matches('.Mui-disabled, :disabled, [aria-disabled="true"]')) return
  void systemVoice.play(cue)
}

export function startUiSounds(): void {
  document.addEventListener('click', onVoiceClick, true)
  if (!look.sounds) return
  document.addEventListener('click', onClick, true)
  document.addEventListener('focusin', onFocusIn, true)
  document.addEventListener('pointerover', onPointerOver, true)
  // Focus moved by the player: a direction (keys, d-pad, stick) or the Tab key.
  input.onAction((event) => {
    if (MOVES.has(event.action)) lastKeyAt = performance.now()
  })
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Tab') lastKeyAt = performance.now()
    },
    true,
  )
  document.addEventListener(
    'pointerdown',
    () => {
      lastPointerAt = performance.now()
    },
    true,
  )
  useSystemStore.subscribe((state, before) => {
    if (state.windows.length > before.windows.length) uiSound('open')
    else if (state.windows.length < before.windows.length) uiSound('close')
  })
}
