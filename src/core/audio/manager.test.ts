// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../registry', () => ({
  audioFiles: {
    'music/a': 'a.wav',
    'music/b': 'b.wav',
    'voice/x': 'x.wav',
    'voice/y': 'y.wav',
    'sfx/s': 's.wav',
    'music/v': 'v-en.wav',
    'music/w': 'w-ja.wav',
  },
  audioLangs: { 'voice/x': { ja: 'x.ja.wav' } },
  // music/en/v.wav + music/ja/v.wav; music/ja/w.wav only.
  audioVoiceLangs: {
    'music/v': { en: 'v-en.wav', ja: 'v-ja.wav' },
    'music/w': { ja: 'w-ja.wav' },
  },
  loadWindow: async () => ({}),
  characters: {},
}))

// ---- a tiny fake Web Audio API
class FakeParam {
  value = 1
  setValueAtTime(v: number) {
    this.value = v
  }
  linearRampToValueAtTime(v: number) {
    this.value = v
  }
  setTargetAtTime(v: number) {
    this.value = v
  }
  cancelScheduledValues() {}
}
class FakeNode {
  connect() {}
}
class FakeGain extends FakeNode {
  gain = new FakeParam()
}
const sources: FakeSource[] = []
class FakeSource extends FakeNode {
  buffer: { url: string } | null = null
  loop = false
  playbackRate = new FakeParam()
  started = false
  stopped = false
  start() {
    this.started = true
  }
  stop() {
    this.stopped = true
  }
}
class FakeContext {
  static instances: FakeContext[] = []
  state = 'suspended'
  currentTime = 0
  destination = new FakeNode()
  gains: FakeGain[] = []
  constructor() {
    FakeContext.instances.push(this)
  }
  createGain() {
    const g = new FakeGain()
    this.gains.push(g)
    return g
  }
  createBufferSource() {
    const s = new FakeSource()
    sources.push(s)
    return s
  }
  async decodeAudioData(data: { url: string }) {
    return data
  }
  resume = vi.fn(async () => {
    this.state = 'running'
  })
  suspend = vi.fn(async () => {})
}

const flush = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  vi.resetModules()
  sources.length = 0
  FakeContext.instances.length = 0
  vi.stubGlobal('AudioContext', FakeContext)
  vi.stubGlobal('fetch', async (url: string) => ({ arrayBuffer: async () => ({ url }) }))
})
afterEach(() => vi.unstubAllGlobals())

async function load() {
  const { audio, soundUrl } = await import('./manager')
  const { useSettingsStore } = await import('../stores/settings')
  return {
    audio: audio as unknown as Record<string, (...args: unknown[]) => unknown>,
    soundUrl,
    useSettingsStore,
  }
}

describe('audio', () => {
  it('does nothing (and does not throw) without Web Audio support', async () => {
    vi.stubGlobal('AudioContext', undefined)
    const { audio } = await load()
    expect(() => audio.sfx?.('sfx/s')).not.toThrow()
    expect(() => audio.music?.('music/a')).not.toThrow()
    await flush()
    expect(sources).toHaveLength(0)
  })

  it('does not restart the track that is already playing', async () => {
    const { audio } = await load()
    audio.music?.('music/a')
    await flush()
    audio.music?.('music/a')
    await flush()
    expect(sources).toHaveLength(1)
    expect(sources[0]?.loop).toBe(true)
  })

  it('crossfades to a new track', async () => {
    const { audio } = await load()
    audio.music?.('music/a')
    await flush()
    audio.music?.('music/b')
    await flush()
    expect(sources.map((s) => [s.buffer?.url, s.stopped])).toEqual([
      ['a.wav', true],
      ['b.wav', false],
    ])
    expect(audio.currentMusic?.()).toBe('music/b')
  })

  it('a track counts as heard once it starts (not if replaced before it loads, not a preview)', async () => {
    vi.useFakeTimers()
    const { audio } = await load()
    const { isUnlocked } = await import('../stores/persistent')
    audio.music?.('music/a')
    audio.music?.('music/b') // replaced before A could start
    await vi.advanceTimersByTimeAsync(60_000)
    expect(isUnlocked('music:music/a')).toBe(false)
    expect(isUnlocked('music:music/b')).toBe(true)
    audio.music?.('music/a', { heard: false }) // Extras → Music preview
    await vi.advanceTimersByTimeAsync(60_000)
    expect(isUnlocked('music:music/a')).toBe(false)
    vi.useRealTimers()
  })

  it('a quick A → B switch never leaves A playing', async () => {
    const { audio } = await load()
    audio.music?.('music/a')
    audio.music?.('music/b') // before A has loaded
    await flush()
    const a = sources.find((s) => s.buffer?.url === 'a.wav')
    expect(a?.stopped).toBe(true)
    expect(sources.find((s) => s.buffer?.url === 'b.wav')?.stopped).toBe(false)
  })

  it('a new voice line cuts off the previous one', async () => {
    const { audio } = await load()
    audio.voice?.('voice/x')
    await flush()
    audio.voice?.('voice/y')
    await flush()
    expect(sources.map((s) => [s.buffer?.url, s.stopped])).toEqual([
      ['x.wav', true],
      ['y.wav', false],
    ])
  })

  it('follows the volume settings', async () => {
    const { audio, useSettingsStore } = await load()
    audio.start?.()
    audio.sfx?.('sfx/s') // creates the context
    await flush()
    const ctx = FakeContext.instances[0]
    useSettingsStore.setState((s) => {
      s.volume.master = 0.5
      s.volume.music = 0.25
    })
    // gains[0] = master, then music, sfx, voice buses
    expect(ctx?.gains[0]?.gain.value).toBe(0.5)
    expect(ctx?.gains[1]?.gain.value).toBe(0.25)
  })

  it('unlocks on the first input', async () => {
    const { audio } = await load()
    const { input } = await import('../input/manager')
    input.start()
    audio.start?.()
    expect(audio.isUnlocked?.()).toBe(false)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ' }))
    expect(audio.isUnlocked?.()).toBe(true)
    expect(FakeContext.instances[0]?.resume).toHaveBeenCalled()
    input.stop()
  })
})

describe('sounds per language', () => {
  it('plays "<name>.<lang>.<ext>" in that language, the sound itself otherwise', async () => {
    const { audio } = await load()
    const { useLangStore } = await import('../lang')
    audio.voice?.('voice/x')
    await flush()
    useLangStore.setState({ id: 'ja' as never })
    audio.voice?.('voice/x')
    await flush()
    audio.voice?.('voice/y') // no Japanese file: never asked for, the sound itself plays
    await flush()
    useLangStore.setState({ id: 'source' })
    expect(sources.map((s) => s.buffer?.url)).toEqual(['x.wav', 'x.ja.wav', 'y.wav'])
  })
})

describe('music in voice-language folders', () => {
  it('follows the voice language (not the text language), then the next language that has it', async () => {
    const { soundUrl } = await load()
    const { useSettingsStore } = await import('../stores/settings')
    const { useLangStore } = await import('../lang')
    useSettingsStore.setState({ voiceLanguage: 'en' })
    useLangStore.setState({ id: 'ja' as never })
    expect(soundUrl?.('music/v' as never)).toBe('v-en.wav')
    // No English file: the Japanese one.
    expect(soundUrl?.('music/w' as never)).toBe('w-ja.wav')
    useSettingsStore.setState({ voiceLanguage: 'ja' })
    useLangStore.setState({ id: 'source' })
    expect(soundUrl?.('music/v' as never)).toBe('v-ja.wav')
    useSettingsStore.setState({ voiceLanguage: 'en' })
  })
})

describe('sound memory and loop points', () => {
  it('drops idle sounds over the budget, never one that is playing', async () => {
    // Each fake sound "decodes" to 100 MB (the default budgets are far below 2 of those).
    vi.stubGlobal('fetch', async (url: string) => ({
      arrayBuffer: async () => ({ url, length: 25 * 1024 * 1024, numberOfChannels: 1 }),
    }))
    const { audio } = await load()
    audio.music?.('music/a') // keeps playing: in use
    await flush()
    await (audio.preload?.(['voice/x']) as Promise<void>)
    await (audio.preload?.(['voice/y']) as Promise<void>)
    await (audio.preload?.(['sfx/s']) as Promise<void>)
    // Playing a.wav (100) + at most the budget of idle ones: x and y went, the newest idle stays.
    const mb = audio.memoryMB?.() as number
    expect(mb).toBeGreaterThanOrEqual(100)
    expect(mb).toBeLessThanOrEqual(200)
    expect(sources[0]?.stopped).toBe(false)
  })

  it('music repeats between the loop points from content/music.ts', async () => {
    vi.doMock('@/content/music', () => ({
      default: { fadeMs: 0, loops: { 'music/a': { start: 2, end: 10 } } },
    }))
    const { audio } = await load()
    audio.music?.('music/a')
    audio.sfx?.('sfx/s')
    await flush()
    const looped = sources.find((s) => s.buffer?.url === 'a.wav') as unknown as {
      loopStart: number
      loopEnd: number
    }
    expect([looped.loopStart, looped.loopEnd]).toEqual([2, 10])
    vi.doUnmock('@/content/music')
  })
})
