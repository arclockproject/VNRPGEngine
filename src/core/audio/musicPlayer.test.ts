import { beforeEach, describe, expect, it, vi } from 'vitest'
import { audio, type Sound } from './manager'
import { musicPlayer, useMusicPlayer } from './musicPlayer'

vi.mock('../registry', () => ({ audioFiles: {} }))

type Fake = Sound & { end: () => void; at: number; loop: boolean }
const sounds: Fake[] = []
vi.spyOn(audio, 'musicTrack').mockImplementation(async (id, options = {}) => {
  let end = () => {}
  const ended = new Promise<void>((resolve) => {
    end = resolve
  })
  const sound: Fake = {
    id,
    ended,
    durationMs: 60_000,
    at: (options.offset ?? 0) * 1000,
    loop: options.loop ?? false,
    positionMs: () => sound.at,
    stop: () => end(),
    end: () => end(),
  }
  sounds.push(sound)
  return sound
})
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))
const state = () => useMusicPlayer.getState()
const A = 'music/a' as never
const B = 'music/b' as never
const C = 'music/c' as never

describe('music room player', () => {
  beforeEach(async () => {
    musicPlayer.reset()
    musicPlayer.setRepeat('all')
    useMusicPlayer.setState({ shuffle: false })
    musicPlayer.setList([A, B, C])
    sounds.length = 0
    await flush()
  })

  it('plays, pauses where it was, and goes on from there', async () => {
    musicPlayer.play(A)
    await flush()
    expect(state()).toMatchObject({ track: A, playing: true, durationMs: 60_000 })
    ;(sounds.at(-1) as Fake).at = 12_000
    musicPlayer.toggle()
    expect(state()).toMatchObject({ playing: false, pausedAtMs: 12_000 })
    musicPlayer.toggle()
    await flush()
    expect(sounds.at(-1)?.positionMs()).toBe(12_000)
    expect(state().playing).toBe(true)
  })

  it('repeat all goes on to the next track at the end (and wraps); off stops', async () => {
    musicPlayer.play(C)
    await flush()
    sounds.at(-1)?.end()
    await flush()
    await flush()
    expect(state().track).toBe(A)
    musicPlayer.setRepeat('off')
    sounds.at(-1)?.end()
    await flush()
    expect(state()).toMatchObject({ track: A, playing: false })
  })

  it('repeat one loops the track; changing the mode while playing restarts at the same spot', async () => {
    musicPlayer.play(B)
    await flush()
    ;(sounds.at(-1) as Fake).at = 5_000
    musicPlayer.setRepeat('one')
    await flush()
    expect(sounds.at(-1)).toMatchObject({ loop: true, at: 5_000 })
  })

  it('previous: back to the start after 3 s, else the track before', async () => {
    musicPlayer.play(B)
    await flush()
    ;(sounds.at(-1) as Fake).at = 10_000
    musicPlayer.previous()
    await flush()
    expect(state().track).toBe(B)
    musicPlayer.previous()
    await flush()
    expect(state().track).toBe(A)
    musicPlayer.next()
    await flush()
    expect(state().track).toBe(B)
  })

  it('seek while paused only moves the spot; stop unloads', async () => {
    musicPlayer.play(A)
    await flush()
    musicPlayer.toggle()
    musicPlayer.seek(30_000)
    expect(state()).toMatchObject({ playing: false, pausedAtMs: 30_000 })
    musicPlayer.stop()
    expect(state()).toMatchObject({ track: null, playing: false })
  })
})
