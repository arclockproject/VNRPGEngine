// @vitest-environment happy-dom
// content/ui/CrashNotice.tsx crashing too must still leave a notice and a working button.
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './layers/ErrorBoundary'

vi.mock('@/content/ui/CrashNotice', () => ({
  CrashNotice: () => {
    throw new Error('notice broke')
  },
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

let broken = true
function Layer() {
  if (broken) throw new Error('layer broke')
  return <p>all good</p>
}

it('falls back to a plain notice when the content notice crashes', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  render(
    <ErrorBoundary label="map layer" retry>
      <Layer />
    </ErrorBoundary>,
  )
  expect(screen.getByRole('alert').textContent).toContain('map layer crashed: layer broke')
  broken = false
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(screen.getByText('all good')).toBeTruthy()
})
