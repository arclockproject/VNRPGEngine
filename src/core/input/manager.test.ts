// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import inputConfig from '@/content/config/input'
import type { WindowId } from '../registry'
import { useSettingsStore } from '../stores/settings'
import { useSystemStore } from '../stores/system'
import { GamepadButton } from './define'
import { input } from './manager'

const initial = useSystemStore.getState()
const keyFor = (action: 'confirm' | 'cancel' | 'up' | 'right') => {
  const key = inputConfig.actions[action].keys?.[0]
  if (!key) throw new Error(`no key bound to ${action}`)
  return key
}
const keydown = (code: string, repeat = false) => {
  const e = new KeyboardEvent('keydown', { code, repeat, bubbles: true, cancelable: true })
  window.dispatchEvent(e)
  return e
}
const keyup = (code: string) => window.dispatchEvent(new KeyboardEvent('keyup', { code }))
const openWindow = (id: string, closable = true) => {
  useSystemStore.setState((s) => {
    s.windows.push({ id: id as WindowId, params: undefined })
  })
  const el = document.createElement('div')
  el.dataset.windowId = id
  el.dataset.closable = String(closable)
  document.body.append(el)
}

beforeEach(() => {
  useSystemStore.setState(initial, true)
  document.body.innerHTML = ''
  input.start()
})
afterEach(() => input.stop())

describe('routing', () => {
  it('only the top layer receives actions', () => {
    const onMap = vi.fn()
    const onWindows = vi.fn()
    input.on('confirm', onMap)
    input.on('confirm', onWindows, { layers: ['windows'] })

    keydown(keyFor('confirm'))
    keyup(keyFor('confirm'))
    expect(onMap).toHaveBeenCalledOnce()
    expect(onWindows).not.toHaveBeenCalled()

    openWindow('a')
    keydown(keyFor('confirm'))
    expect(onMap).toHaveBeenCalledOnce()
    expect(onWindows).toHaveBeenCalledOnce()
  })

  it('window-scoped handlers only fire for the front window', () => {
    const onA = vi.fn()
    input.on('confirm', onA, { layers: ['windows'], windowId: 'a' as WindowId })
    openWindow('a')
    openWindow('b')
    keydown(keyFor('confirm'))
    expect(onA).not.toHaveBeenCalled()
  })

  it('newest handler wins; returning false passes it on', () => {
    const calls: string[] = []
    input.on('confirm', () => {
      calls.push('old')
    })
    input.on('confirm', () => {
      calls.push('new')
      return false
    })
    const e = keydown(keyFor('confirm'))
    expect(calls).toEqual(['new', 'old'])
    expect(e.defaultPrevented).toBe(true)
  })

  it('unhandled keys are not prevented', () => {
    expect(keydown(keyFor('confirm')).defaultPrevented).toBe(false)
  })
})

describe('engine defaults', () => {
  it('cancel closes the front window unless it is not closable', () => {
    openWindow('a')
    openWindow('b', false)
    keydown(keyFor('cancel'))
    expect(useSystemStore.getState().windows.map((w) => w.id)).toEqual(['a', 'b'])

    useSystemStore.setState((s) => {
      s.windows.reverse()
    })
    keyup(keyFor('cancel'))
    keydown(keyFor('cancel'))
    expect(useSystemStore.getState().windows.map((w) => w.id)).toEqual(['b'])
  })
})

describe('held state and movement', () => {
  it('tracks held keys and gives a normalised move vector', () => {
    keydown(keyFor('up'))
    keydown(keyFor('right'))
    expect(input.isDown('up')).toBe(true)
    const v = input.move()
    expect(v.x).toBeCloseTo(Math.SQRT1_2)
    expect(v.y).toBeCloseTo(-Math.SQRT1_2)
    keyup(keyFor('up'))
    keyup(keyFor('right'))
    expect(input.move()).toEqual({ x: 0, y: 0 })
  })

  it('move(layer) is zero when that layer is not on top', () => {
    keydown(keyFor('right'))
    expect(input.move('map').x).toBe(1)
    openWindow('a')
    expect(input.move('map')).toEqual({ x: 0, y: 0 })
  })

  it('touch joystick drives movement and direction actions', () => {
    input.touch.setStick(0, 1)
    expect(input.isDown('down')).toBe(true)
    expect(input.move().y).toBeCloseTo(1)
    input.touch.setStick(0, 0)
    expect(input.isDown('down')).toBe(false)
    expect(useSystemStore.getState().device).toBe('touch')
  })
})

describe('gamepad', () => {
  it('maps buttons to actions and switches the device', () => {
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0, touched: false }))
    const pad = { index: 0, buttons, axes: [0, 0, 0, 0] }
    vi.stubGlobal('navigator', { ...navigator, getGamepads: () => [pad] })
    let frame: FrameRequestCallback | undefined
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frame = cb
      return 1
    })
    const onConfirm = vi.fn()
    input.stop()
    input.start()
    input.on('confirm', onConfirm)

    const confirmButton = inputConfig.actions.confirm.buttons?.[0] ?? GamepadButton.A
    const target = buttons[confirmButton]
    if (target) target.pressed = true
    frame?.(0)
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(useSystemStore.getState().device).toBe('gamepad')

    pad.axes[0] = 1 // stick right
    frame?.(0)
    expect(input.isDown('right')).toBe(true)
    expect(input.move().x).toBeCloseTo(1)
    vi.unstubAllGlobals()
  })
})

describe('one pad button, one action', () => {
  const setup = () => {
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0, touched: false }))
    const pad = { index: 0, buttons, axes: [0, 0, 0, 0] }
    vi.stubGlobal('navigator', { ...navigator, getGamepads: () => [pad] })
    let frame: FrameRequestCallback | undefined
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      frame = cb
      return 1
    })
    input.stop()
    input.start()
    const tap = (index: number) => {
      const button = buttons[index]
      if (!button) throw new Error(`no button ${index}`)
      button.pressed = true
      frame?.(0)
      button.pressed = false
      frame?.(0)
    }
    return tap
  }
  afterEach(() => vi.unstubAllGlobals())

  // The buttons as bound in src/content/config/input.ts (so a moved binding moves the test too).
  const button = (action: 'menu' | 'cancel' | 'back' | 'tabPrev') =>
    (inputConfig.actions[action].buttons ?? [])[0] as number

  it('a button bound twice does one thing: LB switches the tab, not also the scene under it', () => {
    expect(button('back')).toBe(button('tabPrev'))
    const tap = setup()
    useSystemStore.setState((s) => {
      s.event = { id: 'x' } as never
    })
    const onBack = vi.fn()
    const onTab = vi.fn()
    input.on('back', onBack, { layers: ['event'] })
    input.on('tabPrev', onTab, { layers: ['windows'] })
    openWindow('settings')
    tap(button('tabPrev'))
    expect(onTab).toHaveBeenCalledOnce()
    expect(onBack).not.toHaveBeenCalled()
    tap(button('cancel'))
    expect(useSystemStore.getState().windows).toEqual([])
    tap(button('back'))
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('the menu button closes the front window, one per press', () => {
    const tap = setup()
    openWindow('menu')
    openWindow('settings')
    tap(button('menu'))
    expect(useSystemStore.getState().windows.map((w) => w.id)).toEqual(['menu'])
    tap(button('menu'))
    expect(useSystemStore.getState().windows).toEqual([])
  })

  it('the menu button leaves a window that is not closable', () => {
    const tap = setup()
    openWindow('settings', false)
    tap(button('menu'))
    expect(useSystemStore.getState().windows).toHaveLength(1)
  })

  it('the menu button (padLocked) can be neither moved nor taken by another action', () => {
    const tap = setup()
    input.setBinding('menu', { keys: ['Escape'], buttons: [GamepadButton.X] })
    input.setBinding('hide', { keys: ['KeyH'], buttons: [button('menu')] })
    expect(input.bindings('menu').buttons).toEqual([button('menu')])
    expect(input.bindings('hide').buttons).toEqual([])
    openWindow('menu')
    openWindow('settings')
    tap(button('menu'))
    expect(useSystemStore.getState().windows.map((w) => w.id)).toEqual(['menu'])
    useSettingsStore.setState({ bindings: {} })
  })

  it('in the pause menu / Settings, confirm uses its normal button whatever the player set', () => {
    const tap = setup()
    input.setBinding('confirm', { keys: ['Enter'], buttons: [GamepadButton.X] })
    const onConfirm = vi.fn()
    input.on('confirm', onConfirm, { layers: ['windows'] })
    // Another window: the player's own button.
    openWindow('shop')
    tap(GamepadButton.A)
    expect(onConfirm).not.toHaveBeenCalled()
    tap(GamepadButton.X)
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(input.liveButtons('confirm')).toEqual([GamepadButton.X])
    // With Settings open (anywhere in the stack): the normal one, and X no longer confirms.
    openWindow('settings')
    expect(input.liveButtons('confirm')).toEqual([GamepadButton.A])
    tap(GamepadButton.A)
    expect(onConfirm).toHaveBeenCalledTimes(2)
    tap(GamepadButton.X)
    expect(onConfirm).toHaveBeenCalledTimes(2)
    useSettingsStore.setState({ bindings: {} })
  })

  it('Confirm with: on a Nintendo pad the right button confirms, the bottom one cancels', () => {
    const tap = setup()
    const pads = navigator.getGamepads() as unknown as { id: string }[]
    ;(pads[0] as { id: string }).id = 'Nintendo Switch Pro Controller'
    const onConfirm = vi.fn()
    input.on('confirm', onConfirm, { layers: ['windows'] })
    openWindow('settings')
    tap(GamepadButton.B) // the right button
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(useSystemStore.getState().windows).toHaveLength(1)
    tap(GamepadButton.A) // the bottom button: cancel
    expect(useSystemStore.getState().windows).toEqual([])
  })
})

describe('press any key screen', () => {
  it('takes no actions and keeps the key from reaching the page', () => {
    useSystemStore.setState((s) => {
      s.title = 'waiting'
    })
    const onConfirm = vi.fn()
    input.on('confirm', onConfirm, { layers: ['title'] })
    const e = keydown(keyFor('confirm'))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(e.defaultPrevented).toBe(true)
  })

  it('a key still reports "any input" so the screen can move on', () => {
    useSystemStore.setState((s) => {
      s.title = 'waiting'
    })
    const listener = vi.fn()
    const stop = input.onAnyInput(listener)
    keydown('KeyQ')
    expect(listener).toHaveBeenCalledWith('keyboard')
    stop()
  })
})

describe('one key, one action', () => {
  it('Escape closes the front window and does not also open the menu', () => {
    const onMenu = vi.fn()
    input.on('menu', onMenu, { layers: ['map', 'windows'] })
    openWindow('inventory')
    keydown('Escape')
    keyup('Escape')
    expect(useSystemStore.getState().windows).toEqual([])
    expect(onMenu).not.toHaveBeenCalled()
  })

  it('Escape on the map opens the menu', () => {
    const onMenu = vi.fn()
    input.on('menu', onMenu, { layers: ['map', 'windows'] })
    keydown('Escape')
    keyup('Escape')
    expect(onMenu).toHaveBeenCalledOnce()
  })

  it('Escape in an open dropdown is left to the dropdown: no menu, window stays', () => {
    const onMenu = vi.fn()
    input.on('menu', onMenu, { layers: ['map', 'windows'] })
    openWindow('settings')
    const popup = document.createElement('div')
    popup.className = 'MuiPopover-root'
    const option = document.createElement('li')
    option.tabIndex = 0
    popup.append(option)
    document.body.append(popup)
    option.focus()
    const e = keydown('Escape')
    keyup('Escape')
    expect(e.defaultPrevented).toBe(false)
    expect(onMenu).not.toHaveBeenCalled()
    expect(useSystemStore.getState().windows).toHaveLength(1)
  })

  it('the other actions of the same key are still held', () => {
    keydown('Escape')
    expect(input.isDown('menu')).toBe(true)
    expect(input.isDown('cancel')).toBe(true)
    keyup('Escape')
    expect(input.isDown('menu')).toBe(false)
    expect(input.isDown('cancel')).toBe(false)
  })
})
