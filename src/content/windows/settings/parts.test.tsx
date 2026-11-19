// @vitest-environment happy-dom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSettingsStore } from '@/core/stores/settings'
import { put, SettingSelect, SettingSwitch } from './parts'

const initial = useSettingsStore.getState()
afterEach(() => useSettingsStore.setState(initial, true))

describe('settings rows', () => {
  it('a switch shows and stores its setting, then runs `then`', async () => {
    const then = vi.fn()
    put('skipUnread')(false)
    await act(async () => {
      render(<SettingSwitch setting="skipUnread" label="Skip unread" then={then} />)
    })
    const box = screen.getByLabelText('Skip unread') as HTMLInputElement
    expect(box.checked).toBe(false)
    await act(async () => {
      fireEvent.click(box)
    })
    expect(useSettingsStore.getState().skipUnread).toBe(true)
    expect(box.checked).toBe(true)
    expect(then).toHaveBeenCalledWith(true)
  })

  it('a select hands back the option value with its type (numbers stay numbers)', async () => {
    const picked = vi.fn()
    await act(async () => {
      render(
        <SettingSelect
          label="Size"
          value={1}
          options={[
            { value: 1, label: '100%' },
            { value: 1.25, label: '125%' },
          ]}
          onChange={picked}
        />,
      )
    })
    await act(async () => {
      fireEvent.mouseDown(screen.getByRole('combobox'))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('option', { name: '125%' }))
    })
    expect(picked).toHaveBeenCalledWith(1.25)
  })
})
