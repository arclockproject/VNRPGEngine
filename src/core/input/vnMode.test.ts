// VN-only mode: actions marked vnMode: false (the inventory) never fire and aren't listed.
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/content/config/mode', () => ({ default: { vnOnly: true } }))

const { input } = await import('./manager')

describe('vnMode: false', () => {
  it('is left out in VN-only mode, with no key or button', () => {
    expect(input.actions()).not.toContain('inventory')
    expect(input.actions()).toContain('confirm')
    expect(input.bindings('inventory')).toEqual({})
  })
})
