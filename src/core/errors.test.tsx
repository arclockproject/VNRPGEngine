// @vitest-environment happy-dom
// Crashes must be seen: reported, counted, and shown instead of a blank layer.
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import content from '@/content/config/screen'
import { recentErrors, reportError, resetErrors } from './errors'
import { ErrorBoundary } from './layers/ErrorBoundary'
import { useToastStore } from './ui/toast'

const toasts = () => useToastStore.getState().toasts.map((toast) => toast.text)

beforeEach(() => {
  resetErrors()
  useToastStore.setState({ toasts: [] })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('reportError', () => {
  it('logs, remembers the error and tells the player', () => {
    reportError('event "town/sign"', new Error('boom'))
    expect(console.error).toHaveBeenCalled()
    expect(recentErrors().at(-1)).toMatchObject({ where: 'event "town/sign"', message: 'boom' })
    // Tests run as a dev build: the toast carries the real message.
    expect(toasts()).toEqual(['event "town/sign": boom'])
  })

  it('accepts anything that was thrown, not only Error objects', () => {
    reportError('game', 'just text')
    reportError('game', { code: 7 })
    expect(recentErrors().map((error) => error.message)).toEqual(['just text', '[object Object]'])
  })

  it('shows one toast for a burst of errors, then another one later', () => {
    vi.useFakeTimers()
    for (let i = 0; i < 50; i++) reportError('map', new Error(`frame ${i}`))
    expect(toasts()).toHaveLength(1)
    vi.advanceTimersByTime(content.errors.toastEveryMs + 1)
    reportError('map', new Error('later'))
    expect(useToastStore.getState().toasts.some((toast) => toast.text === 'map: later')).toBe(true)
  })

  it('keeps only the last few errors', () => {
    for (let i = 0; i < 60; i++) reportError('map', new Error(String(i)))
    expect(recentErrors().length).toBeLessThanOrEqual(20)
    expect(recentErrors().at(-1)?.message).toBe('59')
  })
})

let broken = true
function Layer() {
  if (broken) throw new Error('layer broke')
  return <div>all good</div>
}

describe('ErrorBoundary', () => {
  it('shows a message instead of the broken layer, and "Try again" draws it again', () => {
    broken = true
    render(
      <ErrorBoundary label="map layer" retry>
        <Layer />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert').textContent).toContain('map layer crashed: layer broke')
    expect(recentErrors().at(-1)).toMatchObject({ where: 'map layer', message: 'layer broke' })
    broken = false
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByText('all good')).toBeTruthy()
  })

  it('a window gets a Close button that calls its dismiss', () => {
    broken = true
    const dismiss = vi.fn(() => {
      broken = false
    })
    render(
      <ErrorBoundary label={'window "shop"'} onDismiss={dismiss}>
        <Layer />
      </ErrorBoundary>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(dismiss).toHaveBeenCalledTimes(1)
    expect(screen.getByText('all good')).toBeTruthy()
  })

  it('without a way out it still shows the message (no button)', () => {
    broken = true
    render(
      <ErrorBoundary label="title">
        <Layer />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
