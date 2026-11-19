import { expect, it } from 'vitest'
import { loadBootScreens, stepList } from './boot'

it('one number is one step', () => {
  expect(stepList(5000)).toEqual([5000])
  expect(stepList([1000, 2000])).toEqual([1000, 2000])
  expect(stepList(undefined)).toEqual([])
})

// Uses the real content: src/content/boot/*.tsx.
it('finds every boot screen, sorted by order, each with what it needs to play', async () => {
  const screens = await loadBootScreens()
  expect(screens.length).toBeGreaterThan(0)
  const orders = screens.map((s) => s.order ?? 0)
  expect(orders).toEqual([...orders].sort((a, b) => a - b))
  for (const screen of screens) {
    expect(typeof screen.skippable).toBe('boolean')
    expect(typeof screen.screen).toBe('function')
    expect(stepList(screen.steps).every((ms) => ms > 0)).toBe(true)
  }
})
