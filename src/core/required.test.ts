// Content the engine opens by itself: a missing piece is named, with what needs it.
// (pnpm gen's check of the always-needed windows: vite/registry.test.ts.)
import { describe, expect, it } from 'vitest'
import { missingContentMessage } from './required'

describe('missing content messages', () => {
  it('names the window and what needs it', () => {
    expect(missingContentMessage('windows', 'menu')).toContain('the engine always opens it')
    expect(missingContentMessage('windows', 'shop')).toContain('game.shops.open() needs it')
    expect(missingContentMessage('minigames', 'battle')).toContain('battles')
    expect(missingContentMessage('windows', 'whatever')).toBe('Unknown windows entry "whatever"')
  })
})
