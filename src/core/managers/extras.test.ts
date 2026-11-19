// Relationships (limits, defaults) and extras (gallery/scene unlocks, replay restores the game).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSystemStore } from '../stores/system'

const scripts: Record<
  string,
  { replay?: string | { title: string; preview?: string }; run: (ctx: never) => unknown }
> = {
  memory: {
    replay: 'A memory',
    run: async (ctx: {
      cg: (id: string | null) => void
      say: (who: string, text: string) => Promise<void>
    }) => {
      ctx.cg('pond')
      relationships.change('anna' as never, 20)
      await ctx.say('anna', 'hello')
    },
  },
  plain: { run: async () => {} },
  moonlight: {
    run: async (ctx: { cg: (id: string, variant?: string) => void }) => {
      ctx.cg('moon') // has variants and no base: {}: shows, unlocks nothing
      ctx.cg('moon', 'full')
    },
  },
  framed: { replay: { title: 'Framed', preview: '/framed.png' }, run: async () => {} },
  parent: {
    run: async (ctx: { event: (id: string) => Promise<void> }) => {
      await ctx.event('memory')
    },
  },
  watch: {
    run: async (ctx: { movie: (id: string, o?: object) => Promise<void> }) => {
      await ctx.movie('intro')
    },
  },
  'extras/movie': {
    run: async (ctx: {
      movie: (id: string, o?: object) => Promise<void>
      params: { movie: string }
    }) => {
      await ctx.movie(ctx.params.movie, { unlock: false })
    },
  },
}
vi.mock('../registry', () => ({
  audioFiles: {
    'voice/en/ev/anna_0001': '/a.ogg',
    'voice/en/ev/anna_0002': '/b.ogg',
    'voice/ja/ev/anna_0001': '/a-ja.ogg',
    'voice/en/ev/bob_0001': '/bob.ogg',
  },
  loadEvent: async (id: string) => scripts[id],
  loadEventMedia: async (id: string) => (id === 'memory' ? [{ kind: 'cg', id: 'pond' }] : []),
  characters: { anna: { name: 'Anna', relationship: { start: 5, min: -10, max: 30 } }, bob: {} },
  gallery: {
    pond: { title: 'Pond', image: '/pond.png' },
    hill: { title: 'Hill', image: '/h.png' },
    moon: {
      title: 'Moon',
      image: {
        width: 1,
        height: 1,
        image: '/m.png',
        parts: [
          { toggle: null, src: '/m.png', x: 0, y: 0, w: 1, h: 1 },
          { toggle: 'full', src: '/full.png', x: 0, y: 0, w: 1, h: 1 },
        ],
      },
      variants: { full: { full: true } },
    },
  },
  endings: {
    good: { title: 'Good end', description: 'Everyone lives.', order: 2 },
    bad: { title: 'Bad end', hint: 'Trust no one.', order: 1 },
    hidden: { title: 'Secret end', secret: true },
  },
  movies: { intro: { title: 'Intro', video: '/intro.webm', fit: 'cover' } },
  registry: {
    endings: ['good', 'bad', 'hidden'],
    achievements: [],
    gallery: ['pond', 'hill', 'moon'],
    movies: ['intro'],
    events: ['memory', 'plain', 'parent', 'framed'],
  },
}))
const unlockNewGamePlus = vi.hoisted(() => vi.fn())
vi.mock('../gameRef', () => ({ getGame: () => ({ save: { unlockNewGamePlus } }) }))

const { relationships } = await import('./relationships')
const { extras } = await import('./extras')
const { advance, endMovie } = await import('../scene/director')
const { resetPersistent, usePersistentStore } = await import('../stores/persistent')
const usePersistent = () => usePersistentStore.getState().unlocked
const { useGameStore, emptyEngineState } = await import('../stores/game')
const flush = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  resetPersistent()
  useGameStore.setState(emptyEngineState())
})

describe('relationships', () => {
  it('start at the character value (default 0) and stay within limits', () => {
    expect(relationships.get('anna' as never)).toBe(5)
    expect(relationships.get('bob' as never)).toBe(0)
    expect(relationships.change('anna' as never, 100)).toBe(30)
    expect(relationships.change('anna' as never, -100)).toBe(-10)
    relationships.set('bob' as never, 500)
    expect(relationships.all()).toEqual({ anna: -10, bob: 100 })
  })
})

describe('extras', () => {
  it('cg() unlocks the picture; finishing a replay event unlocks the scene', async () => {
    const { events } = await import('./events')
    expect(extras.anyUnlocked()).toBe(false)
    await events.start('plain' as never) // no `replay`: unlocks nothing
    expect(extras.anyUnlocked()).toBe(false)
    const done = events.start('memory' as never)
    await flush()
    expect(extras.images().map((i) => [i.id, i.unlocked])).toEqual([
      ['pond', true],
      ['hill', false],
      ['moon', false],
    ])
    expect(extras.sceneUnlocked('memory' as never)).toBe(false) // not finished yet
    advance()
    await done
    expect(extras.sceneUnlocked('memory' as never)).toBe(true)
    expect(await extras.scenes()).toEqual([
      // No preview of its own: the first CG it shows.
      { id: 'memory', title: 'A memory', preview: '/pond.png', unlocked: true },
      { id: 'framed', title: 'Framed', preview: '/framed.png', unlocked: false },
    ])
    expect(relationships.get('anna' as never)).toBe(25)
  })

  it('replay puts the game back as it was and turns saving off meanwhile', async () => {
    const replay = extras.replay('memory' as never)
    await flush()
    expect(extras.isReplaying()).toBe(true)
    expect(useSystemStore.getState().sceneReplay).toBe(true)
    expect(relationships.get('anna' as never)).toBe(25)
    advance()
    await replay
    expect(extras.isReplaying()).toBe(false)
    expect(useSystemStore.getState().sceneReplay).toBe(false)
    expect(relationships.get('anna' as never)).toBe(5)
  })

  it('each variant unlocks on its own; "show all" shows everything without saving', () => {
    extras.unlockImage('moon' as never, 'full')
    const moon = () => extras.images().find((i) => (i.id as string) === 'moon')
    expect(moon()?.unlocked).toBe(true)
    const full = { x: 0, y: 0, w: 1, h: 1 }
    // Only named variants: moon has no `base: {}`, so its plain picture is not listed.
    expect(moon()?.variants).toEqual([
      {
        variant: 'full',
        picture: {
          aspect: 1,
          layers: [
            { src: '/m.png', ...full },
            { src: '/full.png', ...full },
          ],
        },
        unlocked: true,
      },
    ])
    expect(extras.images(true).every((i) => i.variants.every((v) => v.unlocked))).toBe(true)
    expect(extras.imageUnlocked('hill' as never)).toBe(false) // still locked for real
  })

  it('a replay event run from another event with event() unlocks too', async () => {
    const { events } = await import('./events')
    const done = events.start('parent' as never)
    await flush()
    advance()
    await done
    expect(extras.sceneUnlocked('memory' as never)).toBe(true)
    expect(extras.sceneUnlocked('parent' as never)).toBe(false)
  })
})

describe('replaying a scene not unlocked yet (Extras → Show all)', () => {
  it('earns nothing for good: no scene, picture, read line or achievement', async () => {
    const { usePersistentStore } = await import('../stores/persistent')
    const replay = extras.replay('memory' as never)
    await flush()
    expect(extras.imageUnlocked('pond' as never)).toBe(true) // during the scene, as usual
    advance()
    await replay
    expect(extras.sceneUnlocked('memory' as never)).toBe(false)
    expect(extras.imageUnlocked('pond' as never)).toBe(false)
    expect(usePersistentStore.getState().read).toEqual({})
    expect(relationships.get('anna' as never)).toBe(5)
  })

  it('an unlocked scene replays as before (its pictures stay unlocked)', async () => {
    const done = (await import('./events')).events.start('memory' as never)
    await flush()
    advance()
    await done
    const replay = extras.replay('memory' as never)
    await flush()
    advance()
    await replay
    expect(extras.sceneUnlocked('memory' as never)).toBe(true)
    expect(extras.imageUnlocked('pond' as never)).toBe(true)
  })
})

describe('movies', () => {
  /** Waits for the movie to show, then ends it like the player skipping it. */
  async function finishShownMovie() {
    for (let i = 0; i < 20 && !useSystemStore.getState().scene.movie; i++) await flush()
    const shown = useSystemStore.getState().scene.movie
    if (shown) endMovie(shown.id)
    return shown
  }

  it("movie('id') plays the movie's own file and options and unlocks it", async () => {
    const { events } = await import('./events')
    expect(extras.movies().map((m) => m.unlocked)).toEqual([false])
    const done = events.start('watch' as never)
    const shown = await finishShownMovie()
    await done
    expect(shown).toMatchObject({ src: '/intro.webm', fit: 'cover' })
    expect(extras.movieUnlocked('intro' as never)).toBe(true)
    expect(extras.anyUnlocked()).toBe(true)
  })

  it('playing it from Extras (Show all) unlocks nothing and puts the game back', async () => {
    const played = extras.playMovie('intro' as never)
    const shown = await finishShownMovie()
    await played
    expect(shown?.src).toBe('/intro.webm')
    expect(extras.movieUnlocked('intro' as never)).toBe(false)
    expect(useGameStore.getState().events['extras/movie']).toBeUndefined()
    expect(extras.movies(true).map((m) => m.unlocked)).toEqual([true]) // shown, not saved
  })
})

describe('cg variants', () => {
  it('a CG with variants only unlocks named ones (the unnamed plain picture is never listed)', async () => {
    const { events } = await import('./events')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await events.start('moonlight' as never)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("cg('moon', 'full')"))
    warn.mockRestore()
    expect(Object.keys(usePersistent()).filter((k) => k.startsWith('gallery:moon'))).toEqual([
      'gallery:moon:full',
    ])
  })
})

describe('endings', () => {
  it('are listed in order, locked until reached, secret ones hidden until then', () => {
    expect(extras.endings().map((e) => [e.id, e.unlocked])).toEqual([
      ['bad', false],
      ['good', false],
    ])
    expect(extras.reachEnding('good' as never, { notify: false })).toBe(true)
    // Reaching it again is not news.
    expect(extras.reachEnding('good' as never, { notify: false })).toBe(false)
    expect(extras.endingReached('good' as never)).toBe(true)
    expect(extras.reachEnding('hidden' as never, { notify: false })).toBe(true)
    expect(extras.endings().map((e) => [e.id, e.unlocked])).toEqual([
      ['bad', false],
      ['good', true],
      ['hidden', true],
    ])
    expect(extras.anyUnlocked()).toBe(true)
  })

  it('"show all" reveals every ending without saving that', () => {
    expect(extras.endings(true).map((e) => e.unlocked)).toEqual([true, true, true])
    expect(extras.endingReached('bad' as never)).toBe(false)
    expect(usePersistent()).toEqual({})
  })

  it('an unknown ending is refused with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(extras.reachEnding('nope' as never)).toBe(false)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('unknown ending'))
    warn.mockRestore()
  })

  it('count towards the completion percentage', () => {
    const before = extras.completion()
    expect(before.parts.endings).toEqual({ found: 0, total: 2 })
    extras.reachEnding('bad' as never, { notify: false })
    const after = extras.completion()
    expect(after.parts.endings).toEqual({ found: 1, total: 2 })
    expect(after.found).toBe(before.found + 1)
    expect(after.percent).toBe(Math.floor((after.found / after.total) * 100))
    // A secret ending joins the total only once it is found.
    extras.reachEnding('hidden' as never, { notify: false })
    expect(extras.completion().parts.endings).toEqual({ found: 2, total: 3 })
  })
})

describe('favourite voices', () => {
  const A = 'ev/anna_0001'
  const B = 'ev/anna_0002'
  const clips = (clip: string) => [{ clip, speaker: 'anna' }]
  const line = (clip: string, text = 'Hello') => ({
    voices: clips(clip),
    name: 'Anna',
    color: '#f48fb1',
    text,
  })
  it('a star keeps the line (newest first); a second press takes it away', () => {
    expect(extras.toggleFavouriteVoice(line(A, 'One'))).toBe(true)
    expect(extras.toggleFavouriteVoice(line(B, 'Two'))).toBe(true)
    expect(extras.isFavouriteVoice(clips(A))).toBe(true)
    expect(extras.favouriteVoices().map((v) => v.text)).toEqual(['Two', 'One'])
    expect(extras.toggleFavouriteVoice(line(A))).toBe(false)
    expect(extras.favouriteVoices().map((v) => v.voices[0]?.clip)).toEqual([B])
  })

  it('a clip that is no longer in the game is not listed', () => {
    extras.toggleFavouriteVoice(line('ev/anna_0099'))
    expect(extras.isFavouriteVoice(clips('ev/anna_0099'))).toBe(true)
    expect(extras.favouriteVoices()).toEqual([])
  })

  it('a full list takes no more', async () => {
    const { default: scenes } = await import('@/content/scenes')
    for (let i = 0; i < scenes.voice.favourites.max; i++)
      extras.toggleFavouriteVoice(line(`ev/anna_1${i}`))
    expect(extras.toggleFavouriteVoice(line(A))).toBe(false)
    expect(extras.isFavouriteVoice(clips(A))).toBe(false)
  })

  it('a line with several voices is one favourite; it plays all, in the voice language set now', async () => {
    const { audio } = await import('../audio/manager')
    const { useSettingsStore } = await import('../stores/settings')
    const both = [
      { clip: A, speaker: 'anna' },
      { clip: 'ev/bob_0001', speaker: 'bob' },
    ]
    const together = { voices: both, name: 'Anna & Bob', text: 'Bye!' }
    expect(extras.toggleFavouriteVoice(together)).toBe(true)
    expect(extras.isFavouriteVoice(both)).toBe(true)
    // One of its clips alone is another line.
    expect(extras.isFavouriteVoice(clips(A))).toBe(false)
    const voices = vi.spyOn(audio, 'voices').mockImplementation(() => {})
    useSettingsStore.setState({ voiceLanguage: 'ja' })
    extras.playFavouriteVoice(together)
    // Anna has a Japanese clip; Bob does not, so his plays in the default language.
    expect(voices).toHaveBeenLastCalledWith([
      { id: 'voice/ja/ev/anna_0001', volume: 1, who: 'anna' },
      { id: 'voice/en/ev/bob_0001', volume: 1, who: 'bob' },
    ])
    useSettingsStore.setState({ voiceLanguage: 'en' })
    extras.playFavouriteVoice(together)
    expect(voices).toHaveBeenLastCalledWith([
      { id: 'voice/en/ev/anna_0001', volume: 1, who: 'anna' },
      { id: 'voice/en/ev/bob_0001', volume: 1, who: 'bob' },
    ])
    voices.mockRestore()
  })

  it('stars given while a locked scene plays from Extras (Show all) stay', async () => {
    const playing = extras.replay('memory' as never)
    await flush()
    extras.toggleFavouriteVoice(line(A))
    advance()
    await playing
    expect(extras.sceneUnlocked('memory' as never)).toBe(false)
    expect(extras.isFavouriteVoice(clips(A))).toBe(true)
  })
})
