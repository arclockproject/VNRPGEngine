import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettingsStore } from '../stores/settings'
import { audio } from './manager'
import { systemVoice, systemVoiceCharacters, systemVoiceSpeaker } from './systemVoice'

vi.mock('../registry', () => ({
  audioFiles: {
    'system_voice/anna/saved': '/a-saved.ogg',
    'system_voice/anna/title_call': '/a-title.ogg',
    'system_voice/jack/title_call': '/j-title.ogg',
    'voice/en/ev/anna_0001': '/en1.ogg',
  },
  characters: { anna: { name: 'Anna' }, jack: { name: 'Jack' } },
  registry: { characters: ['anna', 'jack'] },
}))

const played = vi.spyOn(audio, 'systemVoice').mockResolvedValue()
// Sound is allowed (after the first key press, or in the desktop / Android app).
vi.spyOn(audio, 'isUnlocked').mockReturnValue(true)

describe('system voice', () => {
  beforeEach(() => {
    played.mockClear()
    useSettingsStore.setState({ systemVoice: 'random', voiceVolumes: {}, voiceMuted: {} })
  })

  it('lists the characters who have clips', () => {
    expect(systemVoiceCharacters().map((c) => c.id)).toEqual(['anna', 'jack'])
  })

  it('a missing cue, or a character without it, plays nothing and throws nothing', async () => {
    await expect(systemVoice.play('no_such_cue')).resolves.toBeUndefined()
    useSettingsStore.setState({ systemVoice: 'jack' })
    await systemVoice.play('saved')
    useSettingsStore.setState({ systemVoice: 'nobody' })
    await systemVoice.play('saved')
    expect(played).not.toHaveBeenCalled()
  })

  it('off says nothing; random picks only characters who have that cue', async () => {
    useSettingsStore.setState({ systemVoice: 'off' })
    expect(systemVoiceSpeaker('title_call')).toBeNull()
    useSettingsStore.setState({ systemVoice: 'random' })
    for (let i = 0; i < 10; i++) expect(systemVoiceSpeaker('saved')).toBe('anna')
    await systemVoice.play('saved')
    expect(played).toHaveBeenCalledWith('system_voice/anna/saved', 1)
  })

  it("plays at the character's own volume and mute (Settings -> Voices)", async () => {
    useSettingsStore.setState({ systemVoice: 'anna', voiceVolumes: { anna: 0.5 } })
    await systemVoice.play('saved')
    expect(played).toHaveBeenLastCalledWith('system_voice/anna/saved', 0.5)
    useSettingsStore.setState({ voiceMuted: { anna: true } })
    await systemVoice.play('saved')
    expect(played).toHaveBeenLastCalledWith('system_voice/anna/saved', 0)
  })

  it('finish() returns at once when nothing plays', async () => {
    await expect(systemVoice.finish(10)).resolves.toBeUndefined()
  })
})

describe('system voice before sound is allowed', () => {
  it('a cue that cannot play yet is skipped, not kept for later', async () => {
    useSettingsStore.setState({ systemVoice: 'anna' })
    vi.mocked(audio.isUnlocked).mockReturnValueOnce(false)
    played.mockClear()
    await systemVoice.play('title_call')
    expect(played).not.toHaveBeenCalled()
    await systemVoice.play('saved')
    expect(played).toHaveBeenCalledTimes(1)
  })
})
