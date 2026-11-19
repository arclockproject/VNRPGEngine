// @vitest-environment happy-dom
// Regression: up/down on a focused MUI slider must only move focus, not change the value.
import { Slider } from '@mui/material'
import { act, render } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { WindowId } from '../registry'
import { useSystemStore } from '../stores/system'
import { input } from './manager'

vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
  this: HTMLElement,
) {
  const top = [...document.querySelectorAll('*')].indexOf(this) * 10
  return {
    left: 0,
    top,
    width: 10,
    height: 10,
    right: 10,
    bottom: top + 10,
    x: 0,
    y: top,
    toJSON() {},
  } as DOMRect
})

const values: number[] = [50, 50]
function TwoSliders() {
  const [a, setA] = useState(50)
  const [b, setB] = useState(50)
  values[0] = a
  values[1] = b
  return (
    <div data-window-id="w" data-closable="true">
      <div data-window-content>
        <Slider value={a} step={10} onChange={(_, v) => setA(v as number)} />
        <Slider value={b} step={10} onChange={(_, v) => setB(v as number)} />
      </div>
    </div>
  )
}

const initial = useSystemStore.getState()
beforeEach(() => {
  useSystemStore.setState((s) => {
    s.windows = [{ id: 'w' as WindowId, params: undefined }]
  })
  input.start()
})
afterEach(() => {
  input.stop()
  useSystemStore.setState(initial, true)
})

const press = (el: Element, key: string) =>
  act(async () => {
    el.dispatchEvent(
      new KeyboardEvent('keydown', { code: key, key, bubbles: true, cancelable: true }),
    )
  })

it('up/down move between sliders without changing them; left/right change the value', async () => {
  render(<TwoSliders />)
  const [first, second] = document.querySelectorAll<HTMLInputElement>('input[type="range"]')
  if (!first || !second) throw new Error('sliders missing')
  await act(async () => first.focus())

  await press(first, 'ArrowDown')
  expect(values).toEqual([50, 50])
  expect(document.activeElement).toBe(second)

  await press(second, 'ArrowUp')
  expect(values).toEqual([50, 50])
  expect(document.activeElement).toBe(first)

  await press(first, 'ArrowRight')
  expect(values).toEqual([60, 50])
  expect(document.activeElement).toBe(first)
})
