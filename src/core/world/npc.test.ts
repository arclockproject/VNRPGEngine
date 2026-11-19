// NPC handles: bark is forwarded only while the NPC is on the map.
import { describe, expect, it, vi } from 'vitest'
import { barkDuration, npcHandle } from './npc'

const actor = { x: 1, y: 2, facing: 'down' } as never

describe('npc.bark', () => {
  it('shows a bubble while the NPC exists, and resolves at once otherwise', async () => {
    const bark = vi.fn(async () => {})
    let present = true
    const handle = npcHandle(
      'jack',
      () => (present ? actor : undefined),
      () => undefined,
      undefined,
      bark,
    )
    await handle.bark('Hi!', { duration: 500 })
    expect(bark).toHaveBeenCalledWith('Hi!', { duration: 500 })
    present = false
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    await handle.bark('Anyone?')
    expect(bark).toHaveBeenCalledTimes(1)
  })

  it('stays longer for longer text, within 1.5–6 s', () => {
    expect(barkDuration('Hi')).toBe(1500)
    expect(barkDuration('x'.repeat(40))).toBe(3100)
    expect(barkDuration('x'.repeat(500))).toBe(6000)
  })
})

describe('npc.emote', () => {
  it('shows a balloon while the NPC is on the map and visible', async () => {
    const emote = vi.fn(async () => {})
    let there: { hidden?: boolean } | undefined = { ...(actor as object) }
    const handle = npcHandle(
      'jack',
      () => there as never,
      () => undefined,
      undefined,
      undefined,
      emote,
    )
    await handle.emote('surprise', { duration: 300 })
    expect(emote).toHaveBeenCalledWith('surprise', { duration: 300 })
    // Hidden or gone: nothing to put a balloon over, and the call still resolves.
    there = { ...(actor as object), hidden: true }
    await handle.emote('question')
    there = undefined
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    await handle.emote('question')
    expect(emote).toHaveBeenCalledTimes(1)
  })
})

describe('emotes in content', () => {
  it('every emote has something short to show', async () => {
    const { default: emotes } = await import('@/content/emotes')
    const list = Object.entries(emotes.list as Record<string, string | { text: string }>)
    expect(list.length).toBeGreaterThan(0)
    for (const [name, look] of list) {
      const text = typeof look === 'string' ? look : look.text
      expect(text.length, name).toBeGreaterThan(0)
      // A balloon holds a symbol, not a sentence.
      expect([...text].length, name).toBeLessThanOrEqual(4)
    }
    expect(emotes.durationMs).toBeGreaterThan(0)
  })
})
