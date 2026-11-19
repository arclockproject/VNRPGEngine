// Achievements (kept across saves) and the codex/journal (per save).
import { beforeEach, describe, expect, it, vi } from 'vitest'

// What the codex versions below read (stands in for game.relationships).
const love = vi.hoisted(() => ({ anna: 0 }))
vi.mock('../gameRef', () => ({ getGame: () => ({ love }) }))

vi.mock('../registry', () => ({
  achievements: {
    win: { title: 'Win', description: 'd' },
    hush: { title: 'H', description: 'd', secret: true },
  },
  codex: {
    anna: {
      title: 'Anna',
      category: 'People',
      text: 't',
      versions: [
        {
          when: (g: { love: { anna: number } }) => g.love.anna >= 10,
          title: 'Anna ♥',
          text: 'friend',
        },
        { when: (g: { love: { anna: number } }) => g.love.anna >= 5, text: 'liked' },
        {
          when: () => {
            throw new Error('broken')
          },
          text: 'never',
        },
      ],
    },
    town: { title: 'Town', category: 'Places', text: 't' },
    jack: { title: 'Jack', category: 'People', text: 't' },
  },
  registry: { achievements: ['win', 'hush'], codex: ['anna', 'town', 'jack'] },
}))

const { achievements } = await import('./achievements')
const { codex } = await import('./codex')
const { resetPersistent } = await import('../stores/persistent')
const { useGameStore, emptyEngineState } = await import('../stores/game')
const { useToastStore } = await import('../ui/toast')

beforeEach(() => {
  resetPersistent()
  useGameStore.setState(emptyEngineState())
  useToastStore.setState({ toasts: [] })
})

describe('achievements', () => {
  it('unlock once, with a toast, and list in folder order', () => {
    expect(achievements.unlock('win' as never)).toBe(true)
    expect(achievements.unlock('win' as never)).toBe(false)
    expect(useToastStore.getState().toasts).toHaveLength(1)
    expect(achievements.list().map((a) => [a.id, a.unlockedAt !== null])).toEqual([
      ['win', true],
      ['hush', false],
    ])
  })

  it('survive a new game (they are not part of the save)', () => {
    achievements.unlock('win' as never, { notify: false })
    useGameStore.setState(emptyEngineState())
    expect(achievements.has('win' as never)).toBe(true)
  })
})

describe('codex', () => {
  it('shows only found entries, grouped by category', () => {
    codex.unlock('jack' as never)
    codex.unlock('town' as never, { notify: false })
    codex.unlock('anna' as never)
    expect(codex.byCategory().map((g) => [g.category, g.entries.map((e) => e.id)])).toEqual([
      ['People', ['anna', 'jack']],
      ['Places', ['town']],
    ])
    expect(useToastStore.getState().toasts).toHaveLength(2)
  })

  it('shows the first version whose `when` matches, else the entry itself', () => {
    love.anna = 0
    codex.unlock('anna' as never, { notify: false })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(codex.get('anna' as never)).toMatchObject({ version: null, entry: { text: 't' } })
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
    love.anna = 7
    expect(codex.get('anna' as never)).toMatchObject({
      version: 1,
      entry: { title: 'Anna', text: 'liked', category: 'People' },
    })
    love.anna = 12
    expect(codex.byCategory()[0]?.entries[0]).toMatchObject({
      version: 0,
      entry: { title: 'Anna ♥', text: 'friend' },
    })
  })

  it('belongs to the playthrough', () => {
    codex.unlock('anna' as never)
    useGameStore.setState(emptyEngineState())
    expect(codex.has('anna' as never)).toBe(false)
  })
})
