import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettingsStore } from '../stores/settings'
import { languageOrder, recorded, voiceLanguage, voiceSound } from './voiceClips'

vi.mock('@/content/scenes', async (original) => {
  const real = ((await original()) as { default: { voice: object } }).default
  return {
    default: { ...real, voice: { ...real.voice, languages: ['ja', 'en', 'pl'] } },
  }
})
vi.mock('../registry', () => ({
  audioFiles: {
    'voice/ja/ev/anna_0001': '/ja1.ogg',
    'voice/en/ev/anna_0001': '/en1.ogg',
    'voice/en/ev/anna_0002': '/en2.ogg',
    'voice/pl/ev/jack_0001': '/pl1.ogg',
  },
}))

const pick = (voiceLanguage: string) => useSettingsStore.setState({ voiceLanguage })

describe('voice languages', () => {
  beforeEach(() => pick('ja'))

  it('a new player gets the first language, not the text language', () => {
    expect(useSettingsStore.getInitialState().voiceLanguage).toBe('ja')
  })

  it('a pick the game does not have plays the default', () => {
    pick('de')
    expect(voiceLanguage()).toBe('ja')
  })

  it('looks in the picked language first, then the others in order', () => {
    pick('pl')
    expect(languageOrder()).toEqual(['pl', 'ja', 'en'])
    expect(voiceSound('ev/anna_0001')).toBe('voice/ja/ev/anna_0001')
    pick('en')
    expect(voiceSound('ev/anna_0001')).toBe('voice/en/ev/anna_0001')
  })

  it('falls back to any language that has the clip (not only the default)', () => {
    expect(voiceSound('ev/anna_0002')).toBe('voice/en/ev/anna_0002')
    expect(voiceSound('ev/jack_0001')).toBe('voice/pl/ev/jack_0001')
    expect(voiceSound('ev/anna_0009')).toBeNull()
  })

  it('keeps only the voices some language has', () => {
    expect(recorded([{ clip: 'ev/anna_0002' }, { clip: 'ev/anna_0009' }])).toEqual([
      { clip: 'ev/anna_0002' },
    ])
  })
})
