// Plays music, sound effects and voice lines with the Web Audio API.
// Sounds come from src/content/audio/ (ids like 'music/town'). Volumes follow the settings store.
import media from '@/content/config/media'
import music from '@/content/music'
import scenes from '@/content/scenes'
import { input } from '../input/manager'
import { useLangStore } from '../lang'
import { isAndroid, isElectron } from '../platform'
import { setVoiceLevelSource } from '../portrait/talking'
import { type AudioId, audioFiles, audioLangs, audioVoiceLangs } from '../registry'
import { isFastForward } from '../scene/replay'
import { unlock } from '../stores/persistent'
import { useSettingsStore } from '../stores/settings'
import { unlockKey } from '../unlocks'
import { languageOrder } from './voiceClips'

export type AudioBus = 'music' | 'sfx' | 'voice'

export interface PlayOptions {
  /** Which volume slider controls it. Default 'sfx'. */
  bus?: AudioBus
  loop?: boolean
  /** 0..1 on top of the bus volume. Default 1. */
  volume?: number
  /** Playback speed (also changes pitch). Default 1. */
  rate?: number
  fadeInMs?: number
  /**
   * For loops: where the repeating part starts and ends, in seconds. The sound plays from its
   * beginning once (the intro), then repeats between the two. Leave out = the whole file.
   */
  loopStart?: number
  loopEnd?: number
  /** Start this many seconds into the sound (the music room's seek bar). Default 0. */
  offset?: number
}

export interface Sound {
  readonly id: AudioId
  stop(fadeMs?: number): void
  /** Resolves when the sound has finished playing or was stopped (never for a loop left running). */
  readonly ended: Promise<void>
  /** How long one play-through lasts, ms (at its rate). */
  readonly durationMs: number
  /** Where it is now, ms into the file (wraps inside the loop points for a loop). */
  positionMs(): number
  /** Loop points in ms, when it has them (a track with an intro). */
  readonly loopMs?: { start: number; end: number }
}

let ctx: AudioContext | null = null
let master: GainNode | null = null
const buses = new Map<AudioBus, GainNode>()
/**
 * Decoded sounds, least recently used first. A decoded sound is big (about 21 MB per minute of
 * stereo music), so ones nothing is playing are dropped once they pass the budget in
 * src/content/config/media.ts (audio.memoryMB).
 */
interface Cached {
  promise: Promise<AudioBuffer>
  bytes: number
  /** Sounds playing from it right now: never dropped while above 0. */
  users: number
}
const buffers = new Map<string, Cached>()

function audioBudget(): number {
  const { memoryMB } = media.audio
  const mb = isElectron ? memoryMB.desktop : isAndroid ? memoryMB.mobile : memoryMB.browser
  return mb * 1024 * 1024
}

/** Drops the least recently used idle sounds until the idle ones fit the budget. */
function trimBuffers(budget = audioBudget()): void {
  let idle = 0
  for (const entry of buffers.values()) if (entry.users === 0) idle += entry.bytes
  for (const [url, entry] of buffers) {
    if (idle <= budget) break
    if (entry.users > 0 || entry.bytes === 0) continue
    buffers.delete(url)
    idle -= entry.bytes
  }
}
let unlocked = false
let started = false

/** The voice clips playing now (a line can have several voices that play together). */
let voiceSounds: Sound[] = []
/** One meter per speaker whose clip is playing (each mouth follows its own clip). */
const speakerMeters = new Map<string, { meter: AnalyserNode; samples: Uint8Array<ArrayBuffer> }>()
/** Measures voice clips (see voiceLevel). */
let voiceMeter: AnalyserNode | null = null
let voiceSamples: Uint8Array<ArrayBuffer> | null = null
/** Increases with every voice() / stopVoice(), so a clip that loads late can't start after a stop. */
let voiceRequest = 0
/** The system voice playing (audio.systemVoice), and a counter so a late load never starts. */
let systemSound: Sound | null = null
let systemRequest = 0
let voiceActive = false
const voiceListeners = new Set<(playing: boolean) => void>()
/** When the line's voice began and when its longest clip ends (performance.now() ms), or null. */
export interface VoiceSpan {
  startedAt: number
  endsAt: number
}
let voiceSpan: VoiceSpan | null = null
const spanListeners = new Set<() => void>()
function setVoiceSpan(span: VoiceSpan | null) {
  voiceSpan = span
  for (const listener of [...spanListeners]) listener()
}
let releaseVoiceDuck: (() => void) | null = null

/** Things holding the music down right now (a voice clip, a movie): the lowest amount wins. */
const ducks = new Set<{ amount: number }>()

type AudioContextClass = typeof AudioContext

function context(): AudioContext | null {
  if (ctx) return ctx
  const Ctor = (globalThis as { AudioContext?: AudioContextClass }).AudioContext
  if (!Ctor) return null
  ctx = new Ctor()
  master = ctx.createGain()
  master.connect(ctx.destination)
  for (const bus of ['music', 'sfx', 'voice'] as const) {
    const gain = ctx.createGain()
    gain.connect(master)
    buses.set(bus, gain)
  }
  // Listens to voice clips only; it plays nothing itself (not connected onwards).
  if (typeof ctx.createAnalyser === 'function') {
    voiceMeter = ctx.createAnalyser()
    voiceMeter.fftSize = 256
    voiceSamples = new Uint8Array(voiceMeter.fftSize)
  }
  applyVolumes()
  return ctx
}

/** Root mean square of what a meter hears now, 0..1. */
function loudness(meter: AnalyserNode, samples: Uint8Array<ArrayBuffer>): number {
  meter.getByteTimeDomainData(samples)
  let sum = 0
  for (const sample of samples) {
    const v = (sample - 128) / 128
    sum += v * v
  }
  return Math.sqrt(sum / samples.length)
}

/**
 * How loud the voice clips are right now (0..1), or null when it can't be measured. With `who`:
 * only that speaker's clip (0 when they have none playing).
 */
function voiceLevelNow(who?: string): number | null {
  if (!voiceMeter || !voiceSamples) return null
  if (!voiceActive) return 0
  if (who === undefined) return loudness(voiceMeter, voiceSamples)
  const own = speakerMeters.get(who)
  return own ? loudness(own.meter, own.samples) : 0
}

function applyVolumes(fadeMs = 60) {
  if (!ctx || !master) return
  const { volume } = useSettingsStore.getState()
  // setTargetAtTime gets most of the way there in about three time constants.
  const time = Math.max(0.005, fadeMs / 3000)
  master.gain.setTargetAtTime(volume.master, ctx.currentTime, 0.02)
  let duck = 1
  for (const d of ducks) duck = Math.min(duck, d.amount)
  for (const [bus, gain] of buses) {
    const level = bus === 'music' ? volume.music * duck : volume[bus]
    gain.gain.setTargetAtTime(level, ctx.currentTime, bus === 'music' ? time : 0.02)
  }
}

/**
 * The file a sound plays. Music in voice-language folders (music/ja/town.ogg): the player's voice
 * language, else the next language in src/content/scenes.ts voice.languages that has it, else a
 * plain music/town.ogg. Other sounds: "<name>.<lang>.<ext>" in the TEXT language when the build
 * found one, else the sound itself.
 */
export function soundUrl(id: AudioId): string | undefined {
  const byVoice = audioVoiceLangs[id]
  if (byVoice)
    for (const lang of languageOrder()) {
      const url = byVoice[lang]
      if (url) return url
    }
  return audioLangs[id]?.[useLangStore.getState().id] ?? audioFiles[id]
}

function setVoiceActive(playing: boolean) {
  if (voiceActive === playing) return
  voiceActive = playing
  if (!playing) setVoiceSpan(null)
  if (playing && useSettingsStore.getState().voiceDuck && scenes.voice.duckMusic < 1) {
    releaseVoiceDuck = audio.duck(scenes.voice.duckMusic, scenes.voice.duckFadeMs)
  } else if (!playing) {
    releaseVoiceDuck?.()
    releaseVoiceDuck = null
  }
  for (const listener of [...voiceListeners]) listener(playing)
}

/** Loads a sound in the player's language (cached per file, so each language's file once). */
function cached(id: AudioId): Cached {
  const url = soundUrl(id)
  const audio = context()
  if (!audio || !url) throw new Error(`Cannot load sound "${id}"`)
  let entry = buffers.get(url)
  if (entry) {
    // Just used: move to the young end.
    buffers.delete(url)
    buffers.set(url, entry)
    return entry
  }
  const made: Cached = {
    promise: fetch(url)
      .then((response) => response.arrayBuffer())
      .then((data) => audio.decodeAudioData(data))
      .then((buffer) => {
        // 32-bit float samples per channel.
        made.bytes = (buffer.length ?? 0) * (buffer.numberOfChannels ?? 1) * 4
        trimBuffers()
        return buffer
      }),
    bytes: 0,
    users: 0,
  }
  entry = made
  made.promise.catch(() => {
    if (buffers.get(url) === made) buffers.delete(url)
  })
  buffers.set(url, made)
  return made
}

function load(id: AudioId): Promise<AudioBuffer> {
  try {
    return cached(id).promise
  } catch (error) {
    return Promise.reject(error)
  }
}

async function play(
  id: AudioId,
  options: PlayOptions = {},
  meter?: AnalyserNode,
): Promise<Sound | null> {
  const audio = context()
  if (!audio) return null
  const entry = cached(id)
  // Counted before the wait, so a sound that is still loading cannot be dropped under it.
  entry.users++
  let buffer: AudioBuffer
  try {
    buffer = await entry.promise
  } catch (error) {
    entry.users--
    throw error
  }
  const source = audio.createBufferSource()
  source.buffer = buffer
  source.loop = options.loop ?? false
  if (source.loop && options.loopEnd !== undefined && options.loopEnd > (options.loopStart ?? 0)) {
    source.loopStart = options.loopStart ?? 0
    source.loopEnd = options.loopEnd
  } else if (source.loop && options.loopStart) {
    source.loopStart = options.loopStart
    source.loopEnd = buffer.duration
  }
  source.playbackRate.value = options.rate ?? 1
  const gain = audio.createGain()
  const volume = options.volume ?? 1
  if (options.fadeInMs) {
    gain.gain.setValueAtTime(0, audio.currentTime)
    gain.gain.linearRampToValueAtTime(volume, audio.currentTime + options.fadeInMs / 1000)
  } else {
    gain.gain.value = volume
  }
  source.connect(gain)
  gain.connect(buses.get(options.bus ?? 'sfx') ?? audio.destination)
  // Voices are also measured (before any volume), so mouths can move with them.
  if (options.bus === 'voice' && voiceMeter) source.connect(voiceMeter)
  if (meter) source.connect(meter)
  const ended = new Promise<void>((resolve) => {
    source.onended = () => {
      entry.users--
      trimBuffers()
      resolve()
    }
  })
  const offset = Math.min(Math.max(0, options.offset ?? 0), Math.max(0, buffer.duration - 0.01))
  source.start(0, offset)
  const startedAt = audio.currentTime
  const rate = options.rate ?? 1
  const loopMs =
    source.loop && source.loopEnd > source.loopStart
      ? { start: source.loopStart * 1000, end: source.loopEnd * 1000 }
      : undefined
  let stopped = false
  return {
    id,
    ended,
    durationMs: (buffer.duration / rate) * 1000,
    ...(loopMs ? { loopMs } : {}),
    positionMs() {
      let at = (offset + (audio.currentTime - startedAt) * rate) * 1000
      const end = loopMs?.end ?? (source.loop ? buffer.duration * 1000 : Number.POSITIVE_INFINITY)
      const start = loopMs?.start ?? 0
      if (source.loop && at > end && end > start) at = start + ((at - start) % (end - start))
      return Math.min(at, buffer.duration * 1000)
    },
    stop(fadeMs = 0) {
      if (stopped) return
      stopped = true
      const end = audio.currentTime + fadeMs / 1000
      gain.gain.cancelScheduledValues(audio.currentTime)
      gain.gain.setValueAtTime(gain.gain.value, audio.currentTime)
      gain.gain.linearRampToValueAtTime(0, end)
      source.stop(end + 0.01)
    },
  }
}

const report = (error: unknown) => console.warn('[audio]', error)

// Mouths of layered portraits follow the voice clip (portrait/talking.ts).
setVoiceLevelSource(voiceLevelNow)

/** One looping track at a time with crossfades: the music, and the ambient sound. */
function loopChannel(bus: AudioBus) {
  let sound: Sound | null = null
  let current: AudioId | null = null
  /** Increases on every change, so a slow load can't start an outdated track. */
  let request = 0
  return {
    /**
     * Plays `id` on repeat. `onStart` runs once it really plays (loaded, not replaced meanwhile).
     */
    set(
      id: AudioId,
      { fadeMs = music.fadeMs, volume = 1 }: { fadeMs?: number; volume?: number } = {},
      onStart?: () => void,
    ) {
      if (current === id) return
      current = id
      const mine = ++request
      sound?.stop(fadeMs)
      sound = null
      const loop = music.loops[id]
      play(id, {
        bus,
        loop: true,
        volume: volume * (loop?.volume ?? 1),
        fadeInMs: fadeMs,
        loopStart: loop?.start,
        loopEnd: loop?.end,
      })
        .then((started) => {
          if (mine !== request) return started?.stop()
          sound = started
          if (started) onStart?.()
        })
        .catch(report)
    },
    stop(fadeMs = music.fadeMs) {
      request++
      current = null
      sound?.stop(fadeMs)
      sound = null
    },
    current: () => current,
  }
}

const musicChannel = loopChannel('music')
const ambientChannel = loopChannel('sfx')

export const audio = {
  /** Plays a sound effect once (fire and forget). */
  sfx(id: AudioId, options: Omit<PlayOptions, 'bus' | 'loop'> = {}): void {
    // A scene replaying to where it was (a loaded save, Back): its sounds were heard already.
    if (isFastForward()) return
    play(id, { ...options, bus: 'sfx' }).catch(report)
  },

  /**
   * Switches the background music with a crossfade. Asking for the track that is already
   * playing does nothing, so maps can call this on every enter.
   */
  music(
    id: AudioId,
    { heard = true, ...options }: { fadeMs?: number; volume?: number; heard?: boolean } = {},
  ) {
    musicChannel.set(id, options, () => {
      // Started playing = listed in Extras → Music from then on (src/content/scenes.ts
      // musicRoom). A music room preview (heard: false) does not count.
      if (heard) unlock(unlockKey.music(id))
    })
  },

  stopMusic(fadeMs = music.fadeMs): void {
    musicChannel.stop(fadeMs)
  },

  /**
   * One music track on the music volume, outside the normal music (core/audio/musicPlayer.ts, the
   * music room): stops the normal music, can start part way in, loops (with its loop points) or
   * plays once. Never unlocks the track. Resolves with the sound (null when it can't play).
   */
  async musicTrack(
    id: AudioId,
    {
      offset = 0,
      loop = false,
      fadeMs = 300,
    }: { offset?: number; loop?: boolean; fadeMs?: number } = {},
  ): Promise<Sound | null> {
    musicChannel.stop(fadeMs)
    const points = music.loops[id]
    try {
      return await play(id, {
        bus: 'music',
        loop,
        offset,
        volume: points?.volume ?? 1,
        fadeInMs: offset > 0 ? 120 : 0,
        ...(loop ? { loopStart: points?.start, loopEnd: points?.end } : {}),
      })
    } catch (error) {
      report(error)
      return null
    }
  },

  /** Loop points of a track (src/content/music.ts loops), in seconds, if it has them. */
  loopPoints(id: AudioId): { start?: number; end?: number } | undefined {
    return music.loops[id]
  },

  /** The music id that is playing (or about to), for save files. */
  currentMusic(): AudioId | null {
    return musicChannel.current()
  },

  /**
   * A looping background sound under the music (rain, wind, a crackling fire), on the sound
   * effects volume. Crossfades like music(); null stops it.
   */
  ambient(id: AudioId | null, options: { fadeMs?: number; volume?: number } = {}): void {
    if (id) ambientChannel.set(id, options)
    else ambientChannel.stop(options.fadeMs)
  },

  /**
   * Plays a voice line, cutting off the previous one. While it plays the music goes quieter (the
   * "Lower music under voices" setting; how much is in src/content/scenes.ts).
   */
  voice(id: AudioId, options: Omit<PlayOptions, 'bus' | 'loop'> = {}): void {
    audio.voices([{ id, ...options }])
  },

  /**
   * Plays several voice clips that start together (one line said by several characters), cutting
   * off the clips before. The voice counts as playing until the longest has ended. `who` = the
   * speaker of a clip: voiceLevel(who) then follows only that clip.
   */
  voices(
    clips: readonly (Omit<PlayOptions, 'bus' | 'loop'> & { id: AudioId; who?: string })[],
  ): void {
    const mine = ++voiceRequest
    for (const sound of voiceSounds) sound.stop(60)
    setVoiceSpan(null)
    voiceSounds = []
    speakerMeters.clear()
    if (clips.length === 0) {
      setVoiceActive(false)
      return
    }
    setVoiceActive(true)
    let left = clips.length
    const done = () => {
      left--
      if (left === 0 && mine === voiceRequest) {
        voiceSounds = []
        setVoiceActive(false)
      }
    }
    const audioContext = context()
    for (const { id, who, ...options } of clips) {
      let own: { meter: AnalyserNode; samples: Uint8Array<ArrayBuffer> } | undefined
      if (who && audioContext && typeof audioContext.createAnalyser === 'function') {
        const meter = audioContext.createAnalyser()
        meter.fftSize = 256
        own = { meter, samples: new Uint8Array(meter.fftSize) }
        speakerMeters.set(who, own)
      }
      play(id, { ...options, bus: 'voice' }, own?.meter)
        .then((sound) => {
          if (mine !== voiceRequest) {
            sound?.stop()
            return
          }
          if (!sound) return done()
          voiceSounds.push(sound)
          // The bar of src/content/ui/VoiceBar.tsx: until the longest clip ends.
          const now = performance.now()
          setVoiceSpan({
            startedAt: voiceSpan?.startedAt ?? now,
            endsAt: Math.max(voiceSpan?.endsAt ?? 0, now + sound.durationMs),
          })
          void sound.ended.then(() => {
            if (mine !== voiceRequest) return
            voiceSounds = voiceSounds.filter((s) => s !== sound)
            if (who && speakerMeters.get(who) === own) speakerMeters.delete(who)
            done()
          })
        })
        .catch((error: unknown) => {
          if (mine === voiceRequest) done()
          report(error)
        })
    }
  },

  /**
   * A system voice clip (core/audio/systemVoice.ts): on the voice volume, cutting off the system
   * clip before it but never a line's voice (no lip sync, no ducking). Resolves when it has ended
   * (at once when it could not play).
   */
  systemVoice(id: AudioId, volume = 1): Promise<void> {
    const mine = ++systemRequest
    systemSound?.stop(60)
    systemSound = null
    if (volume <= 0) return Promise.resolve()
    return play(id, { bus: 'voice', volume })
      .then((sound) => {
        if (!sound) return
        if (mine !== systemRequest) return sound.stop()
        systemSound = sound
        return sound.ended
      })
      .catch(report)
  },

  stopVoice(fadeMs = 120): void {
    voiceRequest++
    for (const sound of voiceSounds) sound.stop(fadeMs)
    voiceSounds = []
    speakerMeters.clear()
    setVoiceActive(false)
  },

  /** When the voice playing now began and when its longest clip ends, or null (none playing). */
  voiceSpan(): VoiceSpan | null {
    return voiceSpan
  },

  /** Calls `listener` whenever voiceSpan() changes. Returns the unsubscribe. */
  onVoiceSpan(listener: () => void): () => void {
    spanListeners.add(listener)
    return () => spanListeners.delete(listener)
  },

  /** True from voice() / voices() until every clip has ended or was stopped. */
  voicePlaying(): boolean {
    return voiceActive
  },

  /**
   * How loud the playing voice clips are right now, 0..1 (0 = silence); null = can't be measured.
   * With a speaker: only their clip.
   */
  voiceLevel: voiceLevelNow,

  /** Calls `listener` when a voice clip starts (true) or ends (false). Returns an unsubscribe. */
  onVoice(listener: (playing: boolean) => void): () => void {
    voiceListeners.add(listener)
    return () => voiceListeners.delete(listener)
  },

  /**
   * Holds the music at `amount` of its volume (0 = silent, 0.4 = 40%) until the returned function
   * is called. Voices and movies use it; several at once = the lowest wins.
   */
  duck(amount: number, fadeMs = 250): () => void {
    const entry = { amount: Math.min(1, Math.max(0, amount)) }
    ducks.add(entry)
    applyVolumes(fadeMs)
    return () => {
      if (ducks.delete(entry)) applyVolumes(fadeMs)
    }
  },

  /** Whether a sound file with this id exists (for ids built at runtime). */
  has(id: string): id is AudioId {
    return id in audioFiles
  },

  /** Starts general-purpose playback with full control. Resolves with a handle (null without audio). */
  play,

  /** Downloads and decodes sounds ahead of time (e.g. while a map loads). */
  preload(ids: AudioId[]): Promise<void> {
    if (!context()) return Promise.resolve()
    return Promise.all(ids.map((id) => load(id))).then(() => undefined)
  },

  /** Megabytes of decoded sound held right now (dev panel). */
  memoryMB(): number {
    let bytes = 0
    for (const entry of buffers.values()) bytes += entry.bytes
    return bytes / (1024 * 1024)
  },

  /** True once the browser allows sound (after the first key press, click or tap). */
  isUnlocked(): boolean {
    return unlocked
  },

  /** Wires up volume settings, the first-input unlock and pausing in background tabs. */
  start(): void {
    if (started || typeof window === 'undefined') return
    started = true
    useSettingsStore.subscribe(() => applyVolumes())
    // The desktop and Android apps may play sound at once (electron/main.ts autoplayPolicy, Android
    // MainActivity): start now, so boot screens and the title call are heard. Not in a browser: there
    // an AudioContext made before any input stays silent (and the browser warns about it).
    if (isElectron || isAndroid) {
      const early = context()
      if (early?.state === 'running') unlocked = true
      else
        void early
          ?.resume()
          .then(() => {
            if (early.state === 'running') unlocked = true
          })
          .catch(() => {})
    }
    // Browsers only allow sound after the player interacts (the title screen key press).
    input.onAnyInput(() => {
      const audioCtx = context()
      if (!audioCtx) return
      unlocked = true
      if (audioCtx.state === 'suspended') void audioCtx.resume()
    })
    document.addEventListener('visibilitychange', () => {
      if (!ctx || !unlocked) return
      if (document.hidden) void ctx.suspend()
      else void ctx.resume()
    })
  },
}
