// A character's own chat box looks (CharacterConfig.chatBox -> looks from content/look/parts.ts).
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/content/look', () => ({
  default: {
    parts: {
      annaBox: { background: 'rgb(1, 2, 3)' },
      annaName: { color: 'rgb(4, 5, 6)' },
      annaText: { color: 'rgb(7, 8, 9)' },
    },
  },
}))
vi.mock('../../registry', () => ({
  characters: {
    anna: { name: 'Anna', chatBox: { box: 'annaBox', name: 'annaName', text: 'annaText' } },
    jack: { name: 'Jack' },
    typo: { name: 'Typo', chatBox: { box: 'noSuchLook' } },
  },
}))
vi.mock('../../scene/effects', () => ({ registerCameraTarget: () => () => {} }))

const { chatBoxLooks } = await import('./shared')

describe('chatBoxLooks', () => {
  it("gives the speaker's own box, name and text looks", () => {
    const own = chatBoxLooks('anna')
    expect(own.box).toMatchObject({ background: 'rgb(1, 2, 3)' })
    expect(own.name).toMatchObject({ color: 'rgb(4, 5, 6)' })
    expect(own.text).toMatchObject({ color: 'rgb(7, 8, 9)' })
  })

  it('is empty for narration, a character without one, an ad hoc speaker and full-page text', () => {
    const empty = { box: {}, name: {}, text: {} }
    expect(chatBoxLooks(null)).toEqual(empty)
    expect(chatBoxLooks('jack')).toEqual(empty)
    expect(chatBoxLooks('Student A')).toEqual(empty)
    expect(chatBoxLooks('anna', true)).toEqual(empty)
  })

  it('a name that is not a look is left out (and warned about once)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(chatBoxLooks('typo').box).toEqual({})
    chatBoxLooks('typo')
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })
})
