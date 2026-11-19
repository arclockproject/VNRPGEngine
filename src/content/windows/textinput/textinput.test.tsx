// @vitest-environment happy-dom
// The on-screen keys (controller only): Japanese kana with the ゛゜小 key, and capitals first.
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useSettingsStore } from '@/core/stores/settings'
import { useSystemStore } from '@/core/stores/system'
import textInput from './index'

function open() {
  const TextInput = textInput.component
  const params = { id: 1, message: 'Name?', answer: () => {} }
  render(<TextInput params={params as never} close={() => {}} />)
  const press = (label: string) => fireEvent.click(screen.getByRole('button', { name: label }))
  const value = () => (screen.getByRole('textbox') as HTMLInputElement).value
  return { press, value }
}

afterEach(() => {
  document.body.innerHTML = ''
  useSettingsStore.setState({ language: 'source' })
})

describe('text input keys', () => {
  it('Japanese: ゛゜小 cycles the last kana, gaps are not keys, no capital-first switch', () => {
    act(() => {
      useSystemStore.setState({ device: 'gamepad' })
      useSettingsStore.setState({ language: 'ja' })
    })
    const { press, value } = open()
    expect(screen.getByRole('button', { name: 'は' })).toBeTruthy() // hiragana first, not katakana
    press('は')
    const mark = screen.getByText('゛゜小')
    fireEvent.click(mark)
    expect(value()).toBe('ば')
    fireEvent.click(mark)
    expect(value()).toBe('ぱ')
    fireEvent.click(mark)
    expect(value()).toBe('は')
    press('つ')
    fireEvent.click(mark)
    expect(value()).toBe('はっ')
    // The full-width gaps in the rows are empty cells, never a key that types a space.
    expect(screen.queryByRole('button', { name: '　' })).toBeNull()
  })

  it('other languages start with a capital, then small letters', () => {
    act(() => {
      useSystemStore.setState({ device: 'gamepad' })
    })
    const { press, value } = open()
    press('A')
    press('b')
    expect(value()).toBe('Ab')
  })
})
