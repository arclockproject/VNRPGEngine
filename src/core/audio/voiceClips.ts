// Voice clips: a line names its clip without a language ("<event id>/<speaker>_<number>"); the
// sound that plays is src/content/audio/voice/<language>/<clip>.* in the player's voice language,
// or else in the first other language that has it (in the order of src/content/scenes.ts
// voice.languages; the first there is the default).
import voiceLangFiles from 'virtual:voice-lang-files'
import scenes from '@/content/scenes'
import { type AudioId, audioFiles } from '../registry'
import { useSettingsStore } from '../stores/settings'

/** One voice of a line: the clip (no language), and the character whose volume / mouth it uses. */
export interface LineVoice {
  clip: string
  speaker?: string
}

/** The voice languages of the game (folders in src/content/audio/voice). The first is the default. */
export const voiceLanguages = (): readonly string[] => scenes.voice.languages

/** The language voices play in: the player's pick when the game has it, else the default. */
export function voiceLanguage(): string {
  const all = voiceLanguages()
  const picked = useSettingsStore.getState().voiceLanguage
  return all.includes(picked) ? picked : (all[0] ?? '')
}

/** The languages to look in, best first: the player's voice language, then the others in order. */
export function languageOrder(): string[] {
  const first = voiceLanguage()
  return [first, ...voiceLanguages().filter((lang) => lang !== first)]
}

/** The first `<prefix><language>/<rest>` sound that exists, in languageOrder(). */
export function soundInLanguages(prefix: string, rest: string): AudioId | null {
  for (const lang of languageOrder()) {
    const id = `${prefix}${lang}/${rest}`
    if (id in audioFiles) return id as AudioId
  }
  return null
}

/** The sound a clip plays now (see the top of this file), or null when no language has it. */
export const voiceSound = (clip: string): AudioId | null => soundInLanguages('voice/', clip)

/** The voices of a line that have a sound to play. */
export const recorded = (voices: readonly LineVoice[] | undefined): LineVoice[] =>
  (voices ?? []).filter((voice) => voiceSound(voice.clip) !== null)

/** A stable name for a line's set of clips (favourite voices, list keys). */
export const voicesKey = (voices: readonly LineVoice[]): string =>
  voices.map((voice) => voice.clip).join('+')

/** Each video URL in a voice-language folder -> all its versions. */
const videoVersions = new Map<string, Record<string, string>>()
for (const group of voiceLangFiles)
  for (const url of Object.values(group)) videoVersions.set(url, group)

/**
 * A movie file in the voice language set now: src/content/movies/<id>/<language>/<file>, in
 * languageOrder() (the picked language, then the next that has it). Any other URL as it is.
 */
export function voiceLangFile(url: string): string {
  const versions = videoVersions.get(url)
  if (!versions) return url
  for (const lang of languageOrder()) {
    const found = versions[lang]
    if (found) return found
  }
  return url
}
