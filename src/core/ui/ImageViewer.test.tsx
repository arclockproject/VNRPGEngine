// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { input } from '../input/manager'
import { ImageViewer } from './ImageViewer'

beforeEach(() => input.start())
afterEach(() => {
  cleanup()
  input.stop()
})

const press = (key: string) =>
  act(async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: key, key, bubbles: true }))
    window.dispatchEvent(new KeyboardEvent('keyup', { code: key, key, bubbles: true }))
  })

const shown = () => [...document.querySelectorAll('img')].map((img) => img.getAttribute('src'))

it('switches between variants with left/right and the dots, skipping locked ones', async () => {
  render(
    <ImageViewer
      pictures={[
        { picture: 'a.png' },
        { picture: 'b.png', locked: true },
        {
          picture: {
            aspect: 2,
            layers: [
              { src: 'a.png', x: 0, y: 0, w: 1, h: 1 },
              { src: 'c.png', x: 0.5, y: 0.5, w: 0.1, h: 0.1 },
            ],
          },
        },
      ]}
      onClose={() => {}}
    />,
  )
  expect(shown()).toEqual(['a.png'])
  await press('ArrowRight') // b is locked: straight to the layered one
  expect(shown()).toEqual(['a.png', 'c.png'])
  await press('ArrowRight') // wraps around
  expect(shown()).toEqual(['a.png'])
  await press('ArrowLeft')
  expect(shown()).toEqual(['a.png', 'c.png'])

  const dots = document.querySelectorAll<HTMLButtonElement>('[role="tab"]')
  expect(dots).toHaveLength(3)
  expect(dots[1]?.disabled).toBe(true)
  await act(async () => fireEvent.click(dots[0] as HTMLButtonElement))
  expect(shown()).toEqual(['a.png'])
})

it('shows no dots for a single picture', () => {
  render(<ImageViewer pictures={[{ picture: 'a.png' }]} onClose={() => {}} />)
  expect(document.querySelectorAll('[role="tab"]')).toHaveLength(0)
})
