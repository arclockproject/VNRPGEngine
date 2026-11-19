// Mid-scene saves: record an event, stop it, resume it, and arrive at the same line.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSystemStore } from '../stores/system'

const sideEffects: string[] = []
const scripts: Record<string, { run: (ctx: never) => unknown }> = {
  story: {
    run: async (ctx: {
      say: (who: string, text: string) => Promise<void>
      choice: (o: string[]) => Promise<number>
      random: () => number
      wait: (ms: number) => Promise<void>
    }) => {
      sideEffects.push('start')
      await ctx.say('anna', 'one')
      const picked = await ctx.choice(['x', 'y'])
      await ctx.wait(5000) // skipped while fast-forwarding
      const roll = ctx.random()
      await ctx.say('anna', `${picked === 1 ? 'Y' : 'X'} ${roll}`)
      await ctx.say('anna', 'last')
    },
  },
}
vi.mock('../registry', () => ({
  audioFiles: {},
  loadEvent: async (id: string) => scripts[id],
  characters: { anna: { name: 'Anna' } },
}))
vi.mock('../gameRef', () => ({ getGame: () => ({}) }))

const { events } = await import('./events')
const { advance, pick } = await import('../scene/director')
const { currentRecording, isFastForward, isWaitingForPlayer, resetReplay } = await import(
  '../scene/replay'
)
const flush = () => new Promise((r) => setTimeout(r, 0))
const line = () => useSystemStore.getState().scene.line?.text

beforeEach(() => {
  resetReplay()
  sideEffects.length = 0
})

describe('mid-scene save and resume', () => {
  it('records lines, choices and random numbers, then replays to the same line', async () => {
    void events.start('story' as never)
    await flush()
    expect(line()).toBe('one')
    advance()
    await flush()
    pick(1)
    await vi.waitFor(() => expect(line()).toMatch(/^Y /), { timeout: 6000 })
    const shown = line()
    expect(isWaitingForPlayer()).toBe(true)

    // "Save": the record so far. Then stop the scene (as loading does) and resume it.
    const saved = currentRecording()?.record
    expect(saved?.steps.map((s) => s.k)).toEqual(['l', 'c', 'r'])
    events.abort()
    expect(useSystemStore.getState().event).toBeNull()

    const started = Date.now()
    await events.resume(saved as never)
    await flush()
    expect(isFastForward()).toBe(false)
    expect(line()).toBe(shown) // same choice, same random number
    expect(Date.now() - started).toBeLessThan(1000) // the 5 s wait was skipped
    expect(sideEffects).toEqual(['start', 'start'])
    expect(currentRecording()?.record.steps).toEqual(saved?.steps)

    advance()
    await flush()
    expect(line()).toBe('last')
    advance()
    await flush()
    expect(useSystemStore.getState().event).toBeNull()
  }, 10000)
})
