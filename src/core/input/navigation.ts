// Moves focus between buttons/sliders inside a window or minigame using actions,
// so gamepads (Steam Deck) and touch buttons can use normal MUI UI without a mouse.
import type { Direction } from './define'
import { pickInDirection, type Rect } from './spatial'

export const FOCUSABLE = [
  'button:not([disabled])',
  'a[href]',
  // MUI's hidden native inputs (Select, Autocomplete) are tabindex=-1 + aria-hidden: skip them,
  // or arrows would land on an invisible text input and stop working.
  'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"]):not([aria-hidden="true"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/** Keys the browser already uses to click the focused element. */
const NATIVE_ACTIVATE = new Set(['key:Enter', 'key:Space'])

/** A checkbox, switch or radio: the browser toggles these on Space only, never on Enter. */
function isToggle(el: Element): boolean {
  return el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')
}

export interface NavEvent {
  action: string
  device: 'keyboard' | 'gamepad' | 'touch'
  source: string
  /** True for auto-repeat while the key or button is held. */
  repeat?: boolean
}

function focusables(container: Element): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => {
    const rect = el.getBoundingClientRect()
    return rect.width > 0 || rect.height > 0 || el === document.activeElement
  })
}

/** The first item a window's content would focus. */
export function firstFocusable(container: Element): HTMLElement | undefined {
  return focusables(container)[0]
}

function focus(el: HTMLElement) {
  el.focus({ focusVisible: true } as FocusOptions)
}

function isRange(el: Element | null): el is HTMLInputElement {
  return el instanceof HTMLInputElement && el.type === 'range'
}

/**
 * The box used for navigation. A slider's hidden input is only its knob, so use the whole
 * slider; an element can also name its own box with data-nav-rect.
 */
function navRect(el: HTMLElement): Rect {
  const owner =
    el.closest<HTMLElement>('[data-nav-rect]') ??
    (isRange(el) ? el.closest('.MuiSlider-root') : null)
  return (owner ?? el).getBoundingClientRect()
}

const HINT_ATTR: Record<Direction, string> = {
  up: 'data-nav-up',
  down: 'data-nav-down',
  left: 'data-nav-left',
  right: 'data-nav-right',
}

/**
 * Where an element (or the nearest element around it, inside the container) says this
 * direction goes: `data-nav-down="[data-tile][aria-pressed=true]"`, a CSS selector. Only used
 * when it matches a visible, focusable element; otherwise the position-based pick runs.
 */
function navHint(
  container: Element,
  from: HTMLElement,
  direction: Direction,
  items: HTMLElement[],
): HTMLElement | undefined {
  const attr = HINT_ATTR[direction]
  const owner = from.closest(`[${attr}]`)
  if (!owner || !container.contains(owner)) return undefined
  let target: Element | null = null
  try {
    target = container.querySelector(owner.getAttribute(attr) ?? '')
  } catch {
    return undefined // not a valid selector
  }
  return items.find((el) => el === target && el !== from)
}

/** Changes a range input's value the way React notices (fires onChange). */
function nudgeRange(el: HTMLInputElement, sign: 1 | -1) {
  const step = Number(el.step) || 1
  const min = el.min === '' ? 0 : Number(el.min)
  const max = el.max === '' ? 100 : Number(el.max)
  const next = Math.min(max, Math.max(min, Number(el.value) + sign * step))
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(el, String(next))
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

/** Handles a navigation action inside `container`. Returns true if it did something. */
export function navigate(container: Element, event: NavEvent): boolean {
  const active = document.activeElement
  const inside = active instanceof HTMLElement && container.contains(active) ? active : null
  const items = focusables(container)
  const first = items[0]

  if (event.action === 'confirm') {
    if (!inside) {
      if (first) focus(first)
      return first !== undefined
    }
    if (isToggle(inside)) {
      // Space is the browser's own toggle key. Everything else (Enter, pad A) is clicked here,
      // once per press: a held key must not flick the switch on and off.
      if (event.device === 'keyboard' && event.source === 'key:Space') return false
      if (!event.repeat) inside.click()
      return true
    }
    if (event.device === 'keyboard' && NATIVE_ACTIVATE.has(event.source)) return false
    inside.click()
    return true
  }

  const direction = event.action as Direction
  if (!['up', 'down', 'left', 'right'].includes(direction)) return false
  if (!inside) {
    if (first) focus(first)
    return first !== undefined
  }
  if (isRange(inside) && (direction === 'left' || direction === 'right')) {
    if (event.device === 'keyboard') return false // the browser handles arrows on sliders
    nudgeRange(inside, direction === 'right' ? 1 : -1)
    return true
  }
  const hinted = navHint(container, inside, direction, items)
  if (hinted) {
    focus(hinted)
    return true
  }
  const others = items.filter((el) => el !== inside)
  const index = pickInDirection(navRect(inside), others.map(navRect), direction)
  const target = others[index]
  if (target) focus(target)
  return true // swallow the key even at the edge, so the page doesn't scroll
}
