// @vitest-environment happy-dom
// A background change: the old picture stays solid under the new one (no dip to black halfway);
// only going to no picture fades it out.
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { Backgrounds } from './Backgrounds'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

/** Each background layer's CSS animation, bottom first. */
const animations = (root: HTMLElement) =>
  [...root.children].map(
    (el) => getComputedStyle(el).animation || (el as HTMLElement).style.animation,
  )

it('crossfades with the old picture solid underneath, then drops it', () => {
  vi.useFakeTimers()
  const { container, rerender } = render(
    <Backgrounds value="#102030" fadeMs={400} transition={null} />,
  )
  rerender(<Backgrounds value="#304050" fadeMs={400} transition={null} />)
  const [old, next] = animations(container)
  expect(container.children).toHaveLength(2)
  // The old one does not fade out ("none"); the new one fades in on top.
  expect(old).not.toMatch(/400ms/)
  expect(next).toMatch(/400ms/)
  act(() => {
    vi.advanceTimersByTime(500)
  })
  expect(container.children).toHaveLength(1)
})

it('fades the old picture out when there is no new one (back to the map)', () => {
  const { container, rerender } = render(
    <Backgrounds value="#102030" fadeMs={400} transition={null} />,
  )
  rerender(<Backgrounds value={null} fadeMs={400} transition={null} />)
  expect(container.children).toHaveLength(1)
  expect(animations(container)[0]).toMatch(/400ms/)
})
