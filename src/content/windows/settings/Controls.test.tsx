// @vitest-environment happy-dom
// Settings → Controls: press a key / button on the picture, then turn actions on or off for it.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { GamepadButton as GP } from '@/core/input/define'
import { input } from '@/core/input/manager'
import { useSettingsStore } from '@/core/stores/settings'
import { useSystemStore } from '@/core/stores/system'
import { Controls } from './Controls'

const settings = useSettingsStore.getState()
const system = useSystemStore.getState()
afterEach(() => {
  cleanup()
  useSettingsStore.setState(settings, true)
  useSystemStore.setState(system, true)
})

const press = async (el: Element) => {
  await act(async () => {
    fireEvent.click(el)
  })
}
const chip = (name: string) => screen.getByRole('button', { name, pressed: undefined })

describe('Controls', () => {
  it('keyboard: a key turns an action on and off; no controller setting shown', async () => {
    useSystemStore.setState({ device: 'keyboard' })
    await act(async () => {
      render(<Controls />)
    })
    expect(screen.queryByText('Confirm with (controller)')).toBeNull()
    await press(document.querySelector('[data-key="KeyF"]') as Element)
    expect(screen.getByText('What the key F does:')).toBeTruthy()
    await press(chip('Log'))
    expect(input.bindings('log').keys).toEqual(['KeyL', 'KeyF'])
    await press(chip('Log'))
    expect(input.bindings('log').keys).toEqual(['KeyL'])
    // Taking the last key off an action says so.
    await press(document.querySelector('[data-key="KeyL"]') as Element)
    await press(chip('Log'))
    expect(screen.getByText('Not set: Log')).toBeTruthy()
  })

  it('controller: the menu button is fixed, and the Menu action stays on it', async () => {
    useSystemStore.setState({ device: 'gamepad', gamepad: 'xbox' })
    await act(async () => {
      render(<Controls />)
    })
    expect(screen.getByText('Confirm with (controller)')).toBeTruthy()
    await press(document.querySelector(`[data-button="${GP.Start}"]`) as Element)
    expect(
      screen.getByText('This button always opens the menu, so Settings can always be reached.'),
    ).toBeTruthy()
    expect(chip('Log').className).toContain('Mui-disabled')
    await press(document.querySelector(`[data-button="${GP.Y}"]`) as Element)
    expect(chip('Menu').className).toContain('Mui-disabled')
    await press(chip('Log'))
    expect(input.bindings('log').buttons).toEqual([GP.Back, GP.Y])
  })
})
