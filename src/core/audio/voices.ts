// Which characters have a voice, for the Voices tab in Settings.

import { type AudioId, audioFiles, type CharacterId, characters, registry } from '../registry'
import { parseVoiceClip } from '../scene/lineCode'
import { useSettingsStore } from '../stores/settings'

interface VoicedInfo {
  name: string
  voiced?: boolean
}

/**
 * Characters with voice clips: the ones with a clip of their own in any language
 * (src/content/audio/voice/<language>/<event id>/<character id>_<number>), or with
 * `voiced: true` in their definition (`voiced: false` leaves one out).
 */
export function voicedCharacters(): { id: CharacterId; name: string }[] {
  const speakers = new Set<string>()
  for (const audio of Object.keys(audioFiles) as AudioId[]) {
    if (!audio.startsWith('voice/')) continue
    const clip = parseVoiceClip(audio)
    if (clip) speakers.add(clip.speaker)
  }
  const all = characters as Record<string, VoicedInfo>
  return (registry.characters as readonly CharacterId[])
    .filter((id) => all[id]?.voiced ?? speakers.has(id))
    .map((id) => ({ id, name: all[id]?.name ?? id }))
}

/** How loud a character's voice plays (Settings → Voices: their slider, or 0 when muted). */
export function characterVoiceVolume(speaker: string | null | undefined): number {
  if (!speaker) return 1
  const { voiceVolumes, voiceMuted } = useSettingsStore.getState()
  return voiceMuted[speaker] ? 0 : (voiceVolumes[speaker] ?? 1)
}
