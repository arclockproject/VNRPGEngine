// Every action can be pressed on a keyboard AND a controller, and no key or button does two things
// unless that is on purpose. Edit the lists below when you change the bindings on purpose.
import { describe, expect, it } from 'vitest'
import { type ActionBinding, GamepadButton as GP } from '@/core/input/define'
import input from './input'

const actions = input.actions as Record<string, ActionBinding>

/** Keyboard only: the controller / phone has its own (screenshot), or it's off on purpose. */
const KEYBOARD_ONLY = ['screenshot', 'fullscreen', 'quickSave', 'quickLoad']

/** Keys and buttons that do two things on purpose (never in the same place at once). */
const SHARED_ON_PURPOSE: Record<string, string[]> = {
  // Escape closes a window (cancel) and opens the pause menu on the map (menu).
  'key Escape': ['cancel', 'menu'],
  // LB / RB: back / auto in scenes, tabs in windows and title screens.
  [`button ${GP.LB}`]: ['back', 'tabPrev'],
  [`button ${GP.RB}`]: ['auto', 'tabNext'],
}

/** The actions the engine reacts to by itself (core/input/define.ts EngineAction). */
const ENGINE_ACTIONS = [
  'up',
  'down',
  'left',
  'right',
  'confirm',
  'cancel',
  'menu',
  'inventory',
  'skip',
  'back',
  'hide',
  'log',
  'auto',
  'tabPrev',
  'tabNext',
  'quickSave',
  'quickLoad',
  'screenshot',
  'fullscreen',
]

describe('input bindings', () => {
  it('every engine action has a binding', () => {
    for (const name of ENGINE_ACTIONS) expect(actions[name], name).toBeDefined()
  })

  it('every action has a key, and a controller button unless keyboard-only', () => {
    for (const [name, binding] of Object.entries(actions)) {
      expect(binding.keys?.length ?? 0, `${name}: no key`).toBeGreaterThan(0)
      if (KEYBOARD_ONLY.includes(name)) continue
      const onPad = (binding.buttons?.length ?? 0) > 0 || binding.stick !== undefined
      expect(onPad, `${name}: no controller button`).toBe(true)
    }
  })

  it('no key or button does two things, except on purpose', () => {
    const users = new Map<string, string[]>()
    for (const [name, binding] of Object.entries(actions)) {
      for (const key of binding.keys ?? [])
        users.set(`key ${key}`, [...(users.get(`key ${key}`) ?? []), name])
      for (const button of binding.buttons ?? [])
        users.set(`button ${button}`, [...(users.get(`button ${button}`) ?? []), name])
    }
    const shared = Object.fromEntries([...users].filter(([, names]) => names.length > 1))
    expect(shared).toEqual(SHARED_ON_PURPOSE)
  })
})
