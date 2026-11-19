// scenes.ts text.playerPicksFont: false: no Font row, everyone gets the first font, even one picked before.
import { expect, it, vi } from 'vitest'

vi.mock('@/content/scenes', async (original) => {
  const real = (await original()) as { default: { text: Record<string, unknown> } }
  return { default: { ...real.default, text: { ...real.default.text, playerPicksFont: false } } }
})

const { DEFAULT_FONT } = await import('./fontList')
const { fonts } = await import('./managers/fonts')
const { chosenFont } = await import('./comfort')
const { useSettingsStore } = await import('./stores/settings')

it('ignores a font picked before and hides the choice', () => {
  const other = fonts.choices().find((choice) => choice.id !== DEFAULT_FONT)
  expect(other).toBeDefined()
  useSettingsStore.setState({ font: other?.id as string })
  expect(fonts.playerPicks()).toBe(false)
  expect(fonts.current()).toBe(DEFAULT_FONT)
  // The first font ("game") has no family of its own: the look's font shows (no --game-font).
  expect(chosenFont()).toBeNull()
})
