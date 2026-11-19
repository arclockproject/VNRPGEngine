// The system voice (VN style): short clips a character says for the menus ("Saved!", the title
// call). Files: src/content/audio/system_voice/<character id>/<cue>.<ext>. The player picks who
// speaks in Settings -> Voices (a character, Random or Off). A cue with no clip for that character
// plays nothing: no error, no warning.
//   - Any button or row: data-voice="<cue>" (core/ui/sounds.ts plays it with the click sound).
//   - Engine cues: title_call (the title screen appears), quick_saved, quick_loaded, the title menu's
//     keys (new, continue, load, extras, settings, quit…: start.ts). Quitting waits for the clip.
//   - From code: game.systemVoice.play('saved').
// Volume: the voice slider x that character's own volume and mute (Settings -> Voices).
import scenes from '@/content/scenes'
import { type AudioId, audioFiles, type CharacterId, characters } from '../registry'
import { isFastForward, onReplayChange } from '../scene/replay'
import { useSettingsStore } from '../stores/settings'
import { audio } from './manager'
import { characterVoiceVolume } from './voices'

const FOLDER = 'system_voice/'
/** Quitting waits at most this long for the clip. */
const QUIT_WAIT_MS = scenes.voice.system?.quitWaitMs ?? 2500

/** A cue name: the file names in src/content/audio/system_voice/<character>/ (typed). */
export type SystemVoiceCue = AudioId extends infer A
  ? A extends `system_voice/${string}/${infer Cue}`
    ? Cue
    : never
  : never

/** character id -> its cues. */
function table(): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  for (const id of Object.keys(audioFiles)) {
    if (!id.startsWith(FOLDER)) continue
    const [who, cue] = id.slice(FOLDER.length).split('/')
    if (!who || !cue) continue
    const cues = out.get(who) ?? new Set<string>()
    cues.add(cue)
    out.set(who, cues)
  }
  return out
}

let current: Promise<void> | null = null

let cached: Map<string, Set<string>> | null = null
const cues = () => {
  cached ??= table()
  return cached
}

/** Characters with at least one system voice clip, for the picker in Settings -> Voices. */
export function systemVoiceCharacters(): { id: CharacterId; name: string }[] {
  const all = characters as Record<string, { name?: string }>
  return [...cues().keys()]
    .filter((id) => id in all)
    .map((id) => ({ id: id as CharacterId, name: all[id]?.name ?? id }))
}

/** Who would say this cue now (null = nobody: off, or no clip). */
export function systemVoiceSpeaker(cue: string): string | null {
  const choice = useSettingsStore.getState().systemVoice
  if (choice === 'off') return null
  const table = cues()
  if (choice !== 'random') return table.get(choice)?.has(cue) ? choice : null
  const able = [...table].filter(([, has]) => has.has(cue)).map(([who]) => who)
  return able.length ? (able[Math.floor(Math.random() * able.length)] as string) : null
}

export const systemVoice = {
  /**
   * Says a cue in the picked character's voice. Nothing happens (no error) when the cue has no
   * clip, the system voice is off, a scene is replaying, or sound can't play yet (a browser before
   * the first key press). Resolves when the clip has ended.
   */
  play(cue: SystemVoiceCue | (string & {})): Promise<void> {
    // Sound not allowed yet (a browser before the first key press): skipped, never kept for later.
    if (isFastForward() || !audio.isUnlocked()) return Promise.resolve()
    const who = systemVoiceSpeaker(cue)
    if (!who) return Promise.resolve()
    const playing = audio.systemVoice(
      `${FOLDER}${who}/${cue}` as AudioId,
      characterVoiceVolume(who),
    )
    current = playing
    void playing.then(() => {
      if (current === playing) current = null
    })
    return playing
  },

  /** Like play(), but after a replay that is running now (a loaded mid-scene save) has finished. */
  playAfterReplay(cue: SystemVoiceCue | (string & {})): void {
    if (!isFastForward()) {
      void systemVoice.play(cue)
      return
    }
    const stop = onReplayChange(() => {
      if (isFastForward()) return
      stop()
      void systemVoice.play(cue)
    })
  },

  /**
   * Waits for the system clip playing now to end (at most `maxMs`; at once when none plays). The
   * app waits for it before it closes, so "Goodbye!" (a Quit button with data-voice="quit") is heard.
   */
  async finish(maxMs = QUIT_WAIT_MS): Promise<void> {
    if (!current) return
    await Promise.race([current, new Promise<void>((resolve) => setTimeout(resolve, maxMs))])
  },
}
