// Turns keyboard, gamepad and touch into named actions (see src/content/config/input.ts)
// and routes each action to the top screen layer only.

import inputConfig from '@/content/config/input'
import modeConfig from '@/content/config/mode'
import { windows } from '../managers/windows'
import { onBackButton } from '../platform'
import type { WindowId } from '../registry'
import { useSettingsStore } from '../stores/settings'
import {
  type GamepadKind,
  type InputDevice,
  type LayerName,
  titleBusy,
  topLayer,
  useSystemStore,
} from '../stores/system'
import { startCursorIdle } from './cursorIdle'
import { type ActionBinding, DIRECTIONS, type Direction, type EngineAction } from './define'
import { swapFace } from './faceSwap'
import { navigate } from './navigation'

/** An action of src/content/config/input.ts, or one the engine reacts to (EngineAction). */
export type ActionName = (keyof (typeof inputConfig)['actions'] & string) | EngineAction

export interface ActionEvent {
  action: ActionName
  /** True for auto-repeat while held (keyboard repeat, held d-pad/stick). */
  repeat: boolean
  device: InputDevice
  /** What triggered it, e.g. 'key:KeyW', 'pad:0:12', 'stick:up', 'touch:confirm'. */
  source: string
}

/** Return false to let the next handler (or the engine default) have the action. */
export type ActionHandler = (event: ActionEvent) => boolean | undefined | void

export interface ActionScope {
  /** Layers in which the handler is active. Default: ['map']. */
  layers?: LayerName[]
  /** Inside the windows layer: only while this window is the front one. */
  windowId?: WindowId
}

export interface Vec2 {
  x: number
  y: number
}

const defaultBindings = inputConfig.actions as Record<ActionName, ActionBinding>
// VN-only mode leaves out the actions marked vnMode: false (they never fire and aren't listed).
const actionNames = (Object.keys(defaultBindings) as ActionName[]).filter(
  (name) => !(modeConfig.vnOnly && defaultBindings[name]?.vnMode === false),
)

/** Buttons of the padLocked actions (src/content/config/input.ts): never moved, never taken. */
const lockedButtons = new Set(
  actionNames.flatMap((name) =>
    defaultBindings[name]?.padLocked ? (defaultBindings[name].buttons ?? []) : [],
  ),
)

/**
 * Defaults from src/content/config/input.ts with the player's own bindings (settings) on top. A
 * padLocked action keeps its default buttons, and no other action gets one of those, so a controller
 * player can always move, confirm, cancel and open the menu (even with old or edited settings).
 */
function effectiveBindings(): Record<ActionName, ActionBinding> {
  const custom = useSettingsStore.getState().bindings
  const result = {} as Record<ActionName, ActionBinding>
  for (const name of actionNames) {
    const own = custom[name]
    const base = defaultBindings[name]
    if (!own) {
      result[name] = base
      continue
    }
    const buttons = base.padLocked
      ? base.buttons
      : (own.buttons ?? []).filter((button) => !lockedButtons.has(button))
    result[name] = { ...base, keys: own.keys, buttons }
  }
  return result
}

/** Whether a button belongs to an action whose buttons can't change (padLocked). */
export function isLockedButton(button: number): boolean {
  return lockedButtons.has(button)
}

let actions = effectiveBindings()

function index<K>(
  pick: (b: ActionBinding) => K[] | undefined,
  from: Record<ActionName, ActionBinding> = actions,
) {
  const map = new Map<K, ActionName[]>()
  for (const name of actionNames) {
    for (const key of pick(from[name]) ?? []) map.set(key, [...(map.get(key) ?? []), name])
  }
  return map
}
let byKey = index((b) => b.keys)
let byButton = index((b) => b.buttons)
let byStick = index((b) => (b.stick ? [b.stick] : undefined))

/**
 * The bindings while a menu window (input.ts menuWindows) is open: padResetInMenus actions have
 * their default buttons again, and no other action keeps one of those.
 */
function menuBindings(): Record<ActionName, ActionBinding> {
  const reset = new Set(
    actionNames.flatMap((name) =>
      defaultBindings[name]?.padResetInMenus ? (defaultBindings[name].buttons ?? []) : [],
    ),
  )
  const result = {} as Record<ActionName, ActionBinding>
  for (const name of actionNames) {
    const binding = actions[name]
    result[name] = defaultBindings[name]?.padResetInMenus
      ? { ...binding, buttons: defaultBindings[name].buttons }
      : { ...binding, buttons: (binding.buttons ?? []).filter((button) => !reset.has(button)) }
  }
  return result
}
let actionsInMenus = menuBindings()
let byButtonInMenus = index((b) => b.buttons, actionsInMenus)

const MENU_WINDOWS = new Set((inputConfig as { menuWindows?: string[] }).menuWindows ?? [])
/** Whether a menu window (input.ts menuWindows) is open anywhere in the window stack. */
const inMenus = () => useSystemStore.getState().windows.some((w) => MENU_WINDOWS.has(w.id))

function rebuildBindings() {
  actions = effectiveBindings()
  byKey = index((b) => b.keys)
  byButton = index((b) => b.buttons)
  actionsInMenus = menuBindings()
  byButtonInMenus = index((b) => b.buttons, actionsInMenus)
  byStick = index((b) => (b.stick ? [b.stick] : undefined))
  releaseAll()
}
useSettingsStore.subscribe((s, previous) => {
  if (s.bindings !== previous.bindings) rebuildBindings()
})

/** A key or button the player pressed while rebinding (see input.capture). */
export type CapturedInput = { kind: 'key'; code: string } | { kind: 'button'; index: number }
let capturing: ((captured: CapturedInput) => void) | null = null

/** Guesses the button labels from the gamepad's id (vendor ids / names). */
export function gamepadKind(id: string): GamepadKind {
  if (/054c|playstation|dualshock|dualsense|sony/i.test(id)) return 'playstation'
  if (/28de|steam deck|valve/i.test(id)) return 'steamdeck'
  if (/057e|nintendo|switch|pro controller|joy-con/i.test(id)) return 'nintendo'
  return 'xbox'
}

/** The part of the Gamepad API that rumbles (not in every browser's types). */
interface RumbleActuator {
  playEffect?: (
    type: 'dual-rumble',
    params: { duration: number; strongMagnitude: number; weakMagnitude: number },
  ) => Promise<unknown>
}

const STICK_DEADZONE = inputConfig.feel.stick.deadzone
const STICK_PRESS = inputConfig.feel.stick.press
const STICK_RELEASE = inputConfig.feel.stick.release
const REPEAT_DELAY = inputConfig.feel.repeat.delayMs
const REPEAT_RATE = inputConfig.feel.repeat.rateMs

// ------------------------------------------------------------------ state

const held = new Map<ActionName, Set<string>>()
const listeners: {
  action: ActionName
  scope: Required<Pick<ActionScope, 'layers'>> & ActionScope
  handler: ActionHandler
}[] = []
const analog: Record<'stick' | 'touch', Vec2> = { stick: { x: 0, y: 0 }, touch: { x: 0, y: 0 } }
const stickDirs = new Set<string>()
/** Auto-repeat timers for directions held on gamepad/touch (the keyboard repeats by itself). */
const repeatAt = new Map<string, number>()
let started = false
/** Called for any key, gamepad button or pointer press, bound or not (title screen). */
const anyInputListeners = new Set<(device: InputDevice) => void>()

const actionListeners = new Set<(event: ActionEvent) => void>()
/** Called when confirm is pressed (or the screen clicked / tapped) while the title layer is busy (see titleBusy). */
const titleSkipListeners = new Set<() => void>()

function notifyAnyInput(device: InputDevice) {
  for (const listener of [...anyInputListeners]) listener(device)
}
let pollHandle = 0
const previousButtons = new Map<number, boolean[]>()

/** Hides the mouse cursor while a gamepad is in use (not touch); moving the mouse shows it again. */
function setCursorHidden(hidden: boolean) {
  const root = document.documentElement
  if (hidden !== root.hasAttribute('data-hide-cursor'))
    root.toggleAttribute('data-hide-cursor', hidden)
}

function setDevice(device: InputDevice) {
  if (typeof document !== 'undefined') setCursorHidden(device === 'gamepad')
  if (useSystemStore.getState().device !== device) {
    useSystemStore.setState((s) => {
      s.device = device
    })
  }
}

function heldSet(action: ActionName) {
  let set = held.get(action)
  if (!set) {
    set = new Set()
    held.set(action, set)
  }
  return set
}

function press(action: ActionName, source: string, device: InputDevice, repeat = false): boolean {
  const set = heldSet(action)
  const alreadyDown = set.size > 0
  set.add(source)
  if (alreadyDown && !repeat) return false
  if (!repeat && device !== 'keyboard' && DIRECTIONS.includes(action as Direction)) {
    repeatAt.set(`${action}|${source}`, performance.now() + REPEAT_DELAY)
  }
  return dispatch({ action, repeat, device, source })
}

function release(action: ActionName, source: string) {
  held.get(action)?.delete(source)
  repeatAt.delete(`${action}|${source}`)
}

/** Android's Back button: one press, given to the first of its actions that takes it. */
function backButton() {
  const source = 'system:back'
  setDevice('touch')
  for (const action of (inputConfig.backButton ?? ['cancel', 'menu']) as ActionName[]) {
    const handled = press(action, source, 'touch')
    release(action, source)
    if (handled) break
  }
  notifyAnyInput('touch')
}

function releaseAll() {
  held.clear()
  repeatAt.clear()
  stickDirs.clear()
  analog.touch = { x: 0, y: 0 }
}

// ------------------------------------------------------------------ routing

function dispatch(event: ActionEvent): boolean {
  for (const listener of [...actionListeners]) listener(event)
  const state = useSystemStore.getState()
  const layer = topLayer(state)
  // "Press any key": no action at all. Otherwise Enter focuses the first title button and the
  // browser clicks it during the same key press. Returning true also stops the key's default.
  if (layer === 'title' && state.title === 'waiting') return true
  // Boot screens, the title entrance, the menu fading in: nothing is usable yet. Confirm skips
  // what may be skipped; every other action is swallowed.
  if (layer === 'title' && titleBusy(state)) {
    if (event.action === 'confirm' && !event.repeat)
      for (const listener of [...titleSkipListeners]) listener()
    return true
  }
  // An open dropdown owns every press: Escape must close just the list, never also open the
  // menu (Escape is cancel AND menu) or reach any game handler. Keyboard goes to MUI untouched.
  const popup = activePopup()
  if (popup) return popupDefault(event, popup)
  const frontWindow = state.windows.at(-1)?.id
  // A finished minigame fading out takes no more input.
  if (layer === 'minigame' && state.minigame?.leaving) return true
  for (let i = listeners.length - 1; i >= 0; i--) {
    const listener = listeners[i]
    if (!listener || listener.action !== event.action || !listener.scope.layers.includes(layer))
      continue
    if (layer === 'windows' && listener.scope.windowId && listener.scope.windowId !== frontWindow)
      continue
    if (listener.handler(event) !== false) return true
  }
  return engineDefault(event, layer, frontWindow)
}

/** An open MUI dropdown/menu that has focus (its list is in a portal, outside the window). */
function activePopup(): HTMLElement | null {
  const el = document.activeElement
  if (!(el instanceof HTMLElement)) return null
  return el.closest<HTMLElement>(
    '.MuiPopover-root, .MuiPopper-root, .MuiMenu-root, [role="listbox"]',
  )
}

/**
 * Pads and touch drive an open dropdown: up/down move through the options, confirm picks,
 * cancel closes just the dropdown (the window stays open). Keyboard is left to MUI.
 */
function popupDefault(event: ActionEvent, popup: HTMLElement): boolean {
  if (event.device === 'keyboard') return false
  const options = [...popup.querySelectorAll<HTMLElement>('[role="option"], [role="menuitem"]')]
  const current = options.indexOf(document.activeElement as HTMLElement)
  if (event.action === 'up' || event.action === 'down') {
    const step = event.action === 'down' ? 1 : -1
    const next = options[Math.min(options.length - 1, Math.max(0, current + step))]
    next?.focus({ focusVisible: true } as FocusOptions)
    return true
  }
  if (event.action === 'confirm') {
    ;(document.activeElement as HTMLElement).click()
    return true
  }
  if (event.action === 'cancel') {
    // MUI closes its menus on Escape.
    document.activeElement?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )
    return true
  }
  return false
}

const DIRECTIONS_LIST = ['up', 'down', 'left', 'right']

/** What the engine does with an action nobody handled. */
function engineDefault(event: ActionEvent, layer: LayerName, frontWindow: WindowId | undefined) {
  if (typeof document === 'undefined') return false
  if (layer === 'windows' && frontWindow) {
    const el = document.querySelector(`[data-window-id="${frontWindow}"]`)
    // Menu closes the front window too, so the button that opened the menu (pad Start) also backs
    // out of it, the way Escape does on a keyboard.
    if (event.action === 'cancel' || event.action === 'menu') {
      if (el instanceof HTMLElement && el.dataset.closable === 'false') return false
      windows.close(frontWindow)
      return true
    }
    // Navigate the content only: the title bar ✕ is covered by cancel.
    const content = el?.querySelector('[data-window-content]')
    if (!content) return false
    const handled = navigate(content, event)
    // Even with nothing to focus, arrows must not scroll the page behind the window.
    // Keyboard arrows still go to the browser (sliders use them); pads and touch never scroll.
    if (handled) return true
    return event.device !== 'keyboard' && DIRECTIONS_LIST.includes(event.action)
  }
  if (layer === 'title') {
    const el = document.querySelector('[data-layer="title"]')
    return el ? navigate(el, event) : false
  }
  if (layer === 'minigame') {
    const minigame = useSystemStore.getState().minigame
    if (event.action === 'cancel' && minigame?.quit) {
      minigame.finish(minigame.quit.result)
      return true
    }
    const el = document.querySelector('[data-layer="minigame"]')
    return el ? navigate(el, event) : false
  }
  return false
}

// ------------------------------------------------------------------ sticks (gamepad + touch)

function applyDeadzone(v: Vec2): Vec2 {
  const length = Math.hypot(v.x, v.y)
  if (length < STICK_DEADZONE) return { x: 0, y: 0 }
  const scaled = Math.min(1, (length - STICK_DEADZONE) / (1 - STICK_DEADZONE))
  return { x: (v.x / length) * scaled, y: (v.y / length) * scaled }
}

/** Presses/releases direction actions as a stick crosses thresholds (with hysteresis). */
function updateStickActions(kind: 'stick' | 'touch', v: Vec2, device: InputDevice) {
  const amount: Record<Direction, number> = { up: -v.y, down: v.y, left: -v.x, right: v.x }
  for (const dir of DIRECTIONS) {
    const id = `${kind}:${dir}`
    const active = stickDirs.has(id)
    if (!active && amount[dir] > STICK_PRESS) {
      stickDirs.add(id)
      for (const action of byStick.get(dir) ?? []) press(action, id, device)
    } else if (active && amount[dir] < STICK_RELEASE) {
      stickDirs.delete(id)
      for (const action of byStick.get(dir) ?? []) release(action, id)
    }
  }
}

// ------------------------------------------------------------------ keyboard / pointer

function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable || target instanceof HTMLTextAreaElement) return true
  return target instanceof HTMLInputElement && !['range', 'checkbox', 'radio'].includes(target.type)
}

function onKeyDown(e: KeyboardEvent) {
  if (capturing && !e.repeat) {
    e.preventDefault()
    e.stopPropagation()
    const done = capturing
    capturing = null
    done({ kind: 'key', code: e.code })
    return
  }
  // No code = sent by script (a pad closing a dropdown sends Escape), not the player's keyboard.
  if (!e.code || isTyping(e.target)) return
  setDevice('keyboard')
  let handled = false
  for (const action of byKey.get(e.code) ?? []) {
    // One press goes to one action: the first that takes it. Escape is both cancel and menu,
    // so it closes the front window and does not also reopen the menu. The others still count
    // as held (for isDown) but are not dispatched.
    if (handled) heldSet(action).add(`key:${e.code}`)
    else handled = press(action, `key:${e.code}`, 'keyboard', e.repeat)
  }
  // After dispatch, so the key that leaves the title screen does not also act on the map.
  if (!e.repeat) notifyAnyInput('keyboard')
  if (handled) {
    // The game used this key: stop it here so focused UI (e.g. an MUI slider on up/down)
    // doesn't also act on it. Keys the game doesn't use still reach the UI as normal.
    e.preventDefault()
    e.stopPropagation()
  }
}

function onKeyUp(e: KeyboardEvent) {
  for (const action of byKey.get(e.code) ?? []) release(action, `key:${e.code}`)
}

function onPointerDown(e: PointerEvent) {
  const device = e.pointerType === 'touch' ? 'touch' : 'keyboard'
  setDevice(device)
  // A click or tap skips what confirm would on a busy title layer. Checked BEFORE the any-input
  // listeners: the press that leaves "press any key" must not also skip the entrance it starts.
  const state = useSystemStore.getState()
  if (topLayer(state) === 'title' && titleBusy(state))
    for (const listener of [...titleSkipListeners]) listener()
  notifyAnyInput(device)
}

function onPointerMove(e: PointerEvent) {
  if (e.pointerType === 'mouse') setCursorHidden(false)
}

// ------------------------------------------------------------------ gamepad polling

function poll() {
  pollHandle = 0
  const pads = navigator.getGamepads?.() ?? []
  let strongest: Vec2 = { x: 0, y: 0 }
  let connected = false
  for (const pad of pads) {
    if (!pad) continue
    connected = true
    const previous = previousButtons.get(pad.index) ?? []
    const padKind = gamepadKind(pad.id)
    pad.buttons.forEach((button, i) => {
      if (button.pressed === Boolean(previous[i])) return
      previous[i] = button.pressed
      const source = `pad:${pad.index}:${i}`
      // The button as the bindings mean it (Settings → Controls "Confirm with": faceSwap.ts).
      const logical = swapFace(i, padKind)
      if (button.pressed && capturing) {
        const done = capturing
        capturing = null
        done({ kind: 'button', index: logical })
        return
      }
      if (button.pressed) {
        setDevice('gamepad')
        if (useSystemStore.getState().gamepad !== padKind)
          useSystemStore.setState((s) => {
            s.gamepad = padKind
          })
      }
      // One press goes to one action, as with keys: LB is back AND tabPrev, so the LB that switches a
      // window's tab must not also step the scene under it back a line.
      // In the pause menu / Settings the moving, confirm and cancel buttons are the defaults.
      const table = inMenus() ? byButtonInMenus : byButton
      let handled = false
      if (!button.pressed) {
        // Released: from both tables, in case a menu opened or closed while it was held.
        const held = new Set([
          ...(byButton.get(logical) ?? []),
          ...(byButtonInMenus.get(logical) ?? []),
        ])
        for (const action of held) release(action, source)
      } else {
        for (const action of table.get(logical) ?? []) {
          if (handled) heldSet(action).add(source)
          else handled = press(action, source, 'gamepad')
        }
      }
      if (button.pressed) notifyAnyInput('gamepad')
    })
    previousButtons.set(pad.index, previous)
    const stick = { x: pad.axes[0] ?? 0, y: pad.axes[1] ?? 0 }
    if (Math.hypot(stick.x, stick.y) > Math.hypot(strongest.x, strongest.y)) strongest = stick
  }
  analog.stick = applyDeadzone(strongest)
  if (Math.hypot(analog.stick.x, analog.stick.y) > STICK_PRESS) setDevice('gamepad')
  updateStickActions('stick', analog.stick, 'gamepad')
  fireRepeats()
  if (connected || repeatAt.size > 0) pollHandle = requestAnimationFrame(poll)
}

function fireRepeats() {
  const now = performance.now()
  for (const [key, at] of repeatAt) {
    if (now < at) continue
    repeatAt.set(key, at + REPEAT_RATE)
    const [action, source = ''] = key.split('|') as [ActionName, string]
    dispatch({
      action,
      repeat: true,
      device: source.startsWith('touch') ? 'touch' : 'gamepad',
      source,
    })
  }
}

function startPolling() {
  if (!pollHandle) pollHandle = requestAnimationFrame(poll)
}

// ------------------------------------------------------------------ public API

export const input = {
  /** Calls `handler` when `action` is pressed while one of `scope.layers` is on top. */
  on(action: ActionName, handler: ActionHandler, scope: ActionScope = {}): () => void {
    const listener = { action, handler, scope: { ...scope, layers: scope.layers ?? ['map'] } }
    listeners.push(listener)
    return () => {
      const i = listeners.indexOf(listener)
      if (i !== -1) listeners.splice(i, 1)
    }
  },

  /** Whether the action is held right now (any device). Use in game loops. */
  isDown(action: ActionName): boolean {
    return (held.get(action)?.size ?? 0) > 0
  },

  /**
   * Movement as a vector of length 0..1 (analog stick/joystick, or keys/d-pad).
   * Pass a layer to get zero unless that layer is on top (e.g. 'map').
   */
  move(layer?: LayerName): Vec2 {
    if (layer && topLayer(useSystemStore.getState()) !== layer) return { x: 0, y: 0 }
    const { stick, touch } = analog
    const a = Math.hypot(touch.x, touch.y) > Math.hypot(stick.x, stick.y) ? touch : stick
    if (a.x !== 0 || a.y !== 0) return { ...a }
    const x = Number(input.isDown('right')) - Number(input.isDown('left'))
    const y = Number(input.isDown('down')) - Number(input.isDown('up'))
    const length = Math.hypot(x, y)
    return length === 0 ? { x: 0, y: 0 } : { x: x / length, y: y / length }
  },

  /** Calls `listener` on any key, gamepad button, click or tap. Returns an unsubscribe. */
  onAnyInput(listener: (device: InputDevice) => void): () => void {
    anyInputListeners.add(listener)
    return () => anyInputListeners.delete(listener)
  },

  /** Calls `listener` for every action press (and repeat), before it is handled. Returns an unsubscribe. */
  onAction(listener: (event: ActionEvent) => void): () => void {
    actionListeners.add(listener)
    return () => actionListeners.delete(listener)
  },

  /**
   * Calls `listener` when confirm is pressed, or the screen is clicked or tapped, while the title
   * layer plays something (boot screens, entrance, menu appearing). A key or button press goes
   * nowhere else. Returns an unsubscribe.
   */
  onTitleSkip(listener: () => void): () => void {
    titleSkipListeners.add(listener)
    return () => titleSkipListeners.delete(listener)
  },

  /**
   * Shakes the controller (strength 0..1 for `duration` ms). Without a controller in use a
   * touch device buzzes instead. Does nothing when the player turned vibration off, or where the
   * device can't.
   */
  rumble(options: { strength?: number; duration?: number } = {}): void {
    if (!useSettingsStore.getState().vibration || typeof navigator === 'undefined') return
    const strength = Math.min(1, Math.max(0, options.strength ?? 0.6))
    const duration = Math.max(0, options.duration ?? 200)
    if (strength === 0 || duration === 0) return
    const device = useSystemStore.getState().device
    if (device === 'touch') {
      navigator.vibrate?.(Math.min(duration, 400))
      return
    }
    if (device !== 'gamepad') return
    for (const pad of navigator.getGamepads?.() ?? []) {
      const actuator = (pad as (Gamepad & { vibrationActuator?: RumbleActuator }) | null)
        ?.vibrationActuator
      if (!actuator?.playEffect) continue
      actuator
        .playEffect('dual-rumble', {
          duration,
          strongMagnitude: strength,
          weakMagnitude: Math.min(1, strength * 1.2),
        })
        .catch(() => {})
    }
  },

  /** Current keys/buttons of an action (the player's own, or the defaults). */
  bindings(action: ActionName): ActionBinding {
    return actions[action] ?? {}
  },

  /**
   * The controller buttons that work for an action right now: in the pause menu / Settings
   * (input.ts menuWindows) the padResetInMenus actions use their defaults (for button prompts).
   */
  liveButtons(action: ActionName): number[] {
    return ((inMenus() ? actionsInMenus : actions)[action]?.buttons ?? []) as number[]
  },

  /** The defaults from src/content/config/input.ts. */
  defaultBindings(action: ActionName): ActionBinding {
    return defaultBindings[action] ?? {}
  },

  /** Every action, in the order of src/content/config/input.ts. */
  actions(): ActionName[] {
    return [...actionNames]
  },

  /** Sets the player's own keys/buttons for an action (saved in the settings). */
  setBinding(action: ActionName, binding: { keys: string[]; buttons: number[] }): void {
    useSettingsStore.setState((s) => {
      s.bindings = { ...s.bindings, [action]: binding }
    })
  },

  /** Back to the defaults: one action, or all of them. */
  resetBindings(action?: ActionName): void {
    useSettingsStore.setState((s) => {
      if (!action) s.bindings = {}
      else {
        const { [action]: _removed, ...rest } = s.bindings
        s.bindings = rest
      }
    })
  },

  /**
   * Waits for the next key or gamepad button (for a "press a key" rebinding prompt). The press is
   * not passed on to the game. Call the returned cancel() to stop waiting (resolves null).
   */
  capture(): { result: Promise<CapturedInput | null>; cancel: () => void } {
    let resolve: (value: CapturedInput | null) => void = () => {}
    const result = new Promise<CapturedInput | null>((r) => {
      resolve = r
    })
    capturing?.({ kind: 'key', code: '' }) // a previous capture loses
    capturing = (captured) => resolve(captured.kind === 'key' && !captured.code ? null : captured)
    startPolling()
    return {
      result,
      cancel: () => {
        capturing = null
        resolve(null)
      },
    }
  },

  /** The device used last: drives touch controls and button prompts. */
  device(): InputDevice {
    return useSystemStore.getState().device
  },

  /** Used by the on-screen touch controls. */
  touch: {
    press(action: ActionName) {
      setDevice('touch')
      press(action, `touch:${action}`, 'touch')
      startPolling() // drives auto-repeat
    },
    release(action: ActionName) {
      release(action, `touch:${action}`)
    },
    setStick(x: number, y: number) {
      if (x !== 0 || y !== 0) setDevice('touch')
      analog.touch = applyDeadzone({ x, y })
      updateStickActions('touch', analog.touch, 'touch')
      startPolling()
    },
  },

  /** Installs the browser listeners. Called once from boot.tsx. */
  start() {
    if (started || typeof window === 'undefined') return
    started = true
    // Capture phase: the game sees keys before page elements (and React) do.
    window.addEventListener('keydown', onKeyDown, { capture: true })
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('pointerdown', onPointerDown, { capture: true })
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('blur', releaseAll)
    onBackButton(backButton)
    if (!document.getElementById('hide-cursor-style')) {
      const style = document.createElement('style')
      style.id = 'hide-cursor-style'
      style.textContent =
        'html[data-hide-cursor], html[data-hide-cursor] * { cursor: none !important; }'
      document.head.append(style)
    }
    startCursorIdle()
    window.addEventListener('gamepadconnected', startPolling)
    if (window.matchMedia?.('(pointer: coarse)').matches) setDevice('touch')
    startPolling()
  },

  /** Removes listeners and clears state (tests, hot reload). */
  stop() {
    started = false
    window.removeEventListener('keydown', onKeyDown, { capture: true })
    window.removeEventListener('keyup', onKeyUp)
    window.removeEventListener('pointerdown', onPointerDown, { capture: true })
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('blur', releaseAll)
    window.removeEventListener('gamepadconnected', startPolling)
    if (pollHandle) cancelAnimationFrame(pollHandle)
    pollHandle = 0
    releaseAll()
    listeners.length = 0
  },
}
