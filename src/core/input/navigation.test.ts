// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { FOCUSABLE, navigate } from './navigation'
import { pickInDirection, type Rect } from './spatial'

// A column like the Settings window: a wide slider whose knob is far right, switch below it.
const button: Rect = { left: 0, top: 0, width: 100, height: 30 }
const slider: Rect = { left: 0, top: 40, width: 400, height: 30 }
const switchBelow: Rect = { left: 0, top: 80, width: 100, height: 30 }

describe('pickInDirection', () => {
  it('goes down into a wide slider and on to the next item', () => {
    expect(pickInDirection(button, [slider, switchBelow], 'down')).toBe(0)
    expect(pickInDirection(slider, [button, switchBelow], 'down')).toBe(1)
  })

  it('goes back up the same way', () => {
    expect(pickInDirection(switchBelow, [button, slider], 'up')).toBe(1)
    expect(pickInDirection(slider, [button, switchBelow], 'up')).toBe(0)
  })

  it('prefers items in line over closer ones that are off to the side', () => {
    const farSide: Rect = { left: 500, top: 45, width: 20, height: 20 }
    expect(pickInDirection(button, [farSide, slider], 'down')).toBe(1)
  })

  it('returns -1 when nothing is in that direction', () => {
    expect(pickInDirection(button, [slider], 'up')).toBe(-1)
  })
})

describe('focusable items', () => {
  it('skips MUI hidden native inputs (tabindex -1, aria-hidden) so arrows keep working', () => {
    const box = document.createElement('div')
    box.innerHTML = `
      <div tabindex="0" role="combobox">English</div>
      <input aria-hidden="true" tabindex="-1" class="MuiSelect-nativeInput" />
      <button>Next</button>`
    document.body.append(box)
    const items = [...box.querySelectorAll<HTMLElement>(FOCUSABLE)]
    expect(items.map((el) => el.textContent)).toEqual(['English', 'Next'])
    box.remove()
  })
})

describe('confirm on a checkbox / switch', () => {
  function setup(html: string) {
    const box = document.createElement('div')
    box.innerHTML = html
    document.body.append(box)
    const el = box.firstElementChild as HTMLElement
    el.focus()
    let clicks = 0
    el.addEventListener('click', () => clicks++)
    return { box, el, clicks: () => clicks }
  }
  const enter = { action: 'confirm', device: 'keyboard', source: 'key:Enter' } as const
  const space = { action: 'confirm', device: 'keyboard', source: 'key:Space' } as const
  const pad = { action: 'confirm', device: 'gamepad', source: 'pad:0:0' } as const

  it('Enter toggles it (the browser only does that for Space)', () => {
    const { box, el } = setup('<input type="checkbox" />')
    expect(navigate(box, enter)).toBe(true)
    expect((el as HTMLInputElement).checked).toBe(true)
    box.remove()
  })

  it('a held Enter does not toggle again', () => {
    const { box, el } = setup('<input type="checkbox" />')
    navigate(box, enter)
    expect(navigate(box, { ...enter, repeat: true })).toBe(true)
    expect((el as HTMLInputElement).checked).toBe(true)
    box.remove()
  })

  it('Space is left to the browser, so it is not toggled twice', () => {
    const { box, clicks } = setup('<input type="checkbox" />')
    expect(navigate(box, space)).toBe(false)
    expect(clicks()).toBe(0)
    box.remove()
  })

  it('the gamepad still toggles it', () => {
    const { box, el } = setup('<input type="checkbox" />')
    expect(navigate(box, pad)).toBe(true)
    expect((el as HTMLInputElement).checked).toBe(true)
    box.remove()
  })

  it('Enter on a button stays a native click (not doubled)', () => {
    const { box, clicks } = setup('<button>Ok</button>')
    expect(navigate(box, enter)).toBe(false)
    expect(clicks()).toBe(0)
    box.remove()
  })
})

describe('data-nav-* hints', () => {
  function setup(html: string) {
    const box = document.createElement('div')
    box.innerHTML = html
    document.body.append(box)
    // happy-dom has no layout: give every item a size so it counts as visible.
    for (const el of box.querySelectorAll<HTMLElement>('*'))
      el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 10, height: 10 }) as DOMRect
    return box
  }
  const down = { action: 'down', device: 'gamepad', source: 'pad:0:13' } as const
  const up = { action: 'up', device: 'gamepad', source: 'pad:0:12' } as const

  it('goes where the element or its container points, before the position-based pick', () => {
    const box = setup(`
      <div data-nav-down="#mute"><button id="tile" aria-pressed="true">Anna</button></div>
      <div data-nav-up="[aria-pressed=true]"><button id="mute">Mute</button><input type="range" id="vol" /></div>`)
    box.querySelector<HTMLElement>('#tile')?.focus()
    navigate(box, down)
    expect(document.activeElement?.id).toBe('mute')
    box.querySelector<HTMLElement>('#vol')?.focus()
    navigate(box, up)
    expect(document.activeElement?.id).toBe('tile')
    box.remove()
  })

  it('a hint that matches nothing (or a bad selector) falls back to the normal pick', () => {
    const box = setup(
      `<button id="a" data-nav-down="#missing">A</button><button id="b" data-nav-up="[[">B</button>`,
    )
    box.querySelector<HTMLElement>('#a')?.focus()
    expect(navigate(box, down)).toBe(true)
    box.querySelector<HTMLElement>('#b')?.focus()
    expect(navigate(box, up)).toBe(true)
    box.remove()
  })
})
