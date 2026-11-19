import { describe, expect, it } from 'vitest'
import saveConfig from '@/content/save'
import { browserBoxes, manualSlotCount, SPECIAL_BOXES } from './slots'

describe('save slots in the browser', () => {
  const browser = { storage: 2_600_000, reserved: 1_000_000, perSave: 130_000 }

  it('offers as many boxes as fit in the storage', () => {
    expect(browserBoxes(browser)).toBe(12)
    expect(manualSlotCount(198, browser, false)).toBe(10) // minus autosave and quick save
    expect(manualSlotCount(5, browser, false)).toBe(5) // never more than the game has
  })

  it('offers every slot with files, or when no browser sizes are set', () => {
    expect(manualSlotCount(198, browser, true)).toBe(198)
    expect(manualSlotCount(198, undefined, false)).toBe(198)
  })

  it('always leaves one manual slot', () => {
    expect(manualSlotCount(198, { storage: 10, reserved: 100, perSave: 50 }, false)).toBe(1)
  })

  it('the game itself fits its saves in the smallest browser', () => {
    const b = saveConfig.browser
    if (!b) return
    const manual = manualSlotCount(saveConfig.slots, b, false)
    expect((manual + SPECIAL_BOXES) * b.perSave + b.reserved).toBeLessThanOrEqual(b.storage)
  })
})
