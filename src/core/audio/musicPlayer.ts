// The music room's player (Extras -> Music, VN style): play / pause, stop, previous / next,
// seek, repeat (off, one, all) and shuffle, on the music volume. Separate from the game's music:
// starting it stops the normal music; Extras puts the music that played before back when it closes.
// Plays only tracks the player may hear (game.extras.music(): unlocked, or "Show all" revealed).
import { useEffect, useState } from 'react'
import { create } from 'zustand'
import type { AudioId } from '../registry'
import { audio, type Sound } from './manager'

/** 'off' = stop after the track, 'one' = repeat it (with its loop points), 'all' = go on to the next. */
export type RepeatMode = 'off' | 'one' | 'all'

export interface MusicPlayerState {
  /** The track loaded in the player (playing or paused), or null. */
  track: AudioId | null
  playing: boolean
  repeat: RepeatMode
  shuffle: boolean
  /** The track's length, ms (0 until it has loaded). */
  durationMs: number
  /** Loop points, ms, of a track with an intro (repeat 'one' plays the loop part again and again). */
  loopMs: { start: number; end: number } | null
  /** Where a paused track stands, ms (while playing, ask musicPlayer.positionMs()). */
  pausedAtMs: number
}

const initial = (): MusicPlayerState => ({
  track: null,
  playing: false,
  repeat: 'all',
  shuffle: false,
  durationMs: 0,
  loopMs: null,
  pausedAtMs: 0,
})

export const useMusicPlayer = create<MusicPlayerState>(() => initial())

let sound: Sound | null = null
/** Increases with every start / stop: a late load or an old track's end never acts. */
let request = 0
/** The tracks next / previous / repeat 'all' go through (the music room sets it). */
let list: AudioId[] = []

const set = useMusicPlayer.setState

function halt(fadeMs = 150) {
  request++
  sound?.stop(fadeMs)
  sound = null
}

async function start(id: AudioId, fromMs = 0): Promise<void> {
  halt()
  const mine = request
  const { repeat } = useMusicPlayer.getState()
  set({ track: id, playing: true, pausedAtMs: fromMs })
  const started = await audio.musicTrack(id, { offset: fromMs / 1000, loop: repeat === 'one' })
  if (mine !== request) {
    started?.stop()
    return
  }
  if (!started) {
    set({ playing: false })
    return
  }
  sound = started
  set({ durationMs: started.durationMs, loopMs: started.loopMs ?? null })
  void started.ended.then(() => {
    // Stopped by us (pause, another track) = a newer request; else the track came to its end.
    if (mine !== request) return
    sound = null
    finished()
  })
}

/** The track played to its end: what comes next depends on repeat and shuffle. */
function finished() {
  const { repeat, track } = useMusicPlayer.getState()
  if (repeat === 'all' && list.length > 0) {
    void start(neighbour(track, 1))
    return
  }
  set({ playing: false, pausedAtMs: 0 })
}

function neighbour(track: AudioId | null, step: 1 | -1): AudioId {
  const { shuffle } = useMusicPlayer.getState()
  if (shuffle && list.length > 1) {
    const others = list.filter((id) => id !== track)
    return others[Math.floor(Math.random() * others.length)] as AudioId
  }
  const at = track ? list.indexOf(track) : -1
  const next = at === -1 ? 0 : (at + step + list.length) % list.length
  return list[next] as AudioId
}

export const musicPlayer = {
  /** The tracks the player goes through (in this order), e.g. the unlocked music room tracks. */
  setList(tracks: readonly AudioId[]): void {
    list = [...tracks]
  },

  /** Plays a track from its start (or from `fromMs`). */
  play(id: AudioId, fromMs = 0): void {
    void start(id, fromMs)
  },

  /** Pauses, or goes on from where it was paused (with no track: plays the first of the list). */
  toggle(): void {
    const state = useMusicPlayer.getState()
    if (state.playing) {
      const at = musicPlayer.positionMs()
      halt(80)
      set({ playing: false, pausedAtMs: at })
    } else if (state.track) void start(state.track, state.pausedAtMs)
    else if (list.length > 0) void start(list[0] as AudioId)
  },

  /** Stops and unloads the track. */
  stop(): void {
    halt(300)
    set({ track: null, playing: false, pausedAtMs: 0, durationMs: 0, loopMs: null })
  },

  /** The next track (shuffle: a random other one). */
  next(): void {
    if (list.length > 0) void start(neighbour(useMusicPlayer.getState().track, 1))
  },

  /**
   * Back: to the start of this track when more than 3 s in (like most players), else the one
   * before it.
   */
  previous(): void {
    const { track } = useMusicPlayer.getState()
    if (track && musicPlayer.positionMs() > 3000) void start(track)
    else if (list.length > 0) void start(neighbour(track, -1))
  },

  /** Jumps to a point of the track, ms. Paused stays paused. */
  seek(ms: number): void {
    const { track, playing, durationMs } = useMusicPlayer.getState()
    if (!track) return
    const at = Math.max(0, Math.min(ms, Math.max(0, durationMs - 50)))
    if (playing) void start(track, at)
    else set({ pausedAtMs: at })
  },

  /** Off -> all -> one -> off. A playing track picks the new mode up at once. */
  cycleRepeat(): void {
    const order: RepeatMode[] = ['off', 'all', 'one']
    const { repeat } = useMusicPlayer.getState()
    musicPlayer.setRepeat(order[(order.indexOf(repeat) + 1) % order.length] as RepeatMode)
  },

  setRepeat(repeat: RepeatMode): void {
    const before = useMusicPlayer.getState()
    set({ repeat })
    // Looping is set when a sound starts: restart from the same spot if it changed.
    if (before.playing && before.track && (before.repeat === 'one') !== (repeat === 'one'))
      void start(before.track, musicPlayer.positionMs())
  },

  toggleShuffle(): void {
    set((s) => ({ shuffle: !s.shuffle }))
  },

  /** Where the track is now, ms. */
  positionMs(): number {
    const { playing, pausedAtMs } = useMusicPlayer.getState()
    return playing && sound ? sound.positionMs() : pausedAtMs
  },

  /** Back to nothing loaded, keeping repeat and shuffle (Extras closing). */
  reset(): void {
    halt(300)
    const { repeat, shuffle } = useMusicPlayer.getState()
    set({ ...initial(), repeat, shuffle })
  },
}

/** Where the player's track is, ms, redrawn a few times a second while it plays (for a seek bar). */
export function useMusicPosition(everyMs = 250): number {
  const playing = useMusicPlayer((s) => s.playing)
  const pausedAt = useMusicPlayer((s) => s.pausedAtMs)
  const [now, setNow] = useState(() => musicPlayer.positionMs())
  useEffect(() => {
    setNow(musicPlayer.positionMs())
    if (!playing) return
    const timer = setInterval(() => setNow(musicPlayer.positionMs()), everyMs)
    return () => clearInterval(timer)
  }, [playing, everyMs])
  return playing ? now : pausedAt
}
