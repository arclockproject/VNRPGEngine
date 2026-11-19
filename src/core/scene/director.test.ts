import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSystemStore } from '../stores/system'

vi.mock('../registry', () => ({
  audioFiles: {},
  movies: {},
  characters: {
    kim: { name: 'Kim', color: '#abcdef', portraits: { calm: 'calm.png', mad: 'mad.png' } },
    lee: { name: 'Lee', portraits: { calm: 'calm.png' } },
  },
}))

const { advance, endMovie, pick, resetScene, sceneApi, voiceVolume } = await import('./director')
const { audio } = await import('../audio/manager')
const { useSettingsStore } = await import('../stores/settings')
const { startReplay, resetReplay, beginRecording, currentRecording } = await import('./replay')
const { LOG_LIMIT } = await import('./state')
const scene = () => useSystemStore.getState().scene
// Fake character ids for the mocked registry.
const api = sceneApi as unknown as {
  say: (who: string | string[], text: string, style?: object) => Promise<void>
  narrate: (text: string, options?: Record<string, unknown>) => Promise<void>
  choice: (options: unknown, settings?: object) => Promise<unknown>
  show: (who: string, options?: object) => void
  hide: (who?: string) => void
  filter: (f: unknown) => void
  background: (b: string | null, options?: object) => void
  movie: (src: string, options?: object) => Promise<void>
  input: (prompt: string, options?: object) => Promise<string>
}

beforeEach(() => resetScene())

describe('say / narrate', () => {
  it('shows a line until the player continues, and logs it', async () => {
    let done = false
    const said = api.say('kim', 'Hello', { as: '???' }).then(() => {
      done = true
    })
    expect(scene().line).toMatchObject({
      speaker: 'kim',
      name: '???',
      text: 'Hello',
      advanced: false,
    })
    await Promise.resolve()
    expect(done).toBe(false)
    advance()
    await said
    expect(scene().line?.advanced).toBe(true)
    expect(scene().log.at(-1)).toEqual({
      name: '???',
      color: '#abcdef',
      text: 'Hello',
      speaker: 'kim',
    })
  })

  it('fills {name} holes from the options, keeping style and markup apart', () => {
    void api.say('kim', '{shake}You{/shake} got {count} apples, {who}.', {
      count: 5,
      who: 'Bo',
      shake: true,
      speed: 2,
    })
    expect(scene().line).toMatchObject({
      text: '{shake}You{/shake} got 5 apples, Bo.',
      style: { shake: true, speed: 2 },
    })
    expect(scene().line?.style).not.toHaveProperty('count')
    expect(scene().log.at(-1)?.text).toBe('You got 5 apples, Bo.')
  })

  it('narration has no speaker', () => {
    void api.narrate('The wind howls.')
    expect(scene().line).toMatchObject({ speaker: null, name: null })
  })

  it('keeps the log across events but limits its length', () => {
    for (let i = 0; i < LOG_LIMIT + 5; i++) void api.narrate(`line ${i}`)
    resetScene()
    expect(scene().line).toBeNull()
    expect(scene().log).toHaveLength(LOG_LIMIT)
    expect(scene().log.at(-1)?.text).toBe(`line ${LOG_LIMIT + 4}`)
  })
})

describe('read tracking', () => {
  it('marks lines read when continued; later runs see them as read', async () => {
    const { resetPersistent } = await import('../stores/persistent')
    resetPersistent()
    const first = api.say('anna', 'A brand new line')
    expect(scene().line?.read).toBe(false)
    advance()
    await first
    const again = api.say('anna', 'A brand new line')
    expect(scene().line?.read).toBe(true)
    advance()
    await again
  })
})

describe('choice', () => {
  it('returns the index for a list', async () => {
    const chosen = api.choice(['a', 'b', 'c'])
    expect(scene().choices?.map((c) => c.label)).toEqual(['a', 'b', 'c'])
    pick(2)
    expect(await chosen).toBe(2)
    expect(scene().choices).toBeNull()
  })

  it('returns the key for an object', async () => {
    const chosen = api.choice({ yes: 'Yes!', no: 'No.' })
    expect(scene().choices?.map((c) => c.label)).toEqual(['Yes!', 'No.'])
    pick(1)
    expect(await chosen).toBe('no')
  })

  it('hides and disables options; disabled ones cannot be picked', async () => {
    const chosen = api.choice({
      a: 'A',
      secret: { label: 'S', hidden: true },
      buy: { label: 'Buy', disabled: 'Needs gold' },
      c: { label: 'C', disabled: false },
    })
    expect(scene().choices).toEqual([
      { label: 'A', disabled: null },
      { label: 'Buy', disabled: 'Needs gold' },
      { label: 'C', disabled: null },
    ])
    pick(1) // disabled: ignored
    expect(scene().choices).not.toBeNull()
    pick(2)
    expect(await chosen).toBe('c')
  })

  it('picks the default when time runs out', async () => {
    vi.useFakeTimers()
    const chosen = api.choice(['a', 'b'], { timeout: 1000, default: 1 })
    expect(scene().choiceTimer?.ms).toBe(1000)
    vi.advanceTimersByTime(1000)
    expect(await chosen).toBe(1)
    expect(scene().choiceTimer).toBeNull()
    vi.useRealTimers()
  })
})

describe('stage', () => {
  it('show adds with the default pose, then updates in place', () => {
    api.show('kim')
    expect(scene().actors).toEqual([
      { id: 'kim', pose: 'calm', parts: {}, at: 'center', flip: false },
    ])
    api.show('kim', { pose: 'mad', at: 'left' })
    expect(scene().actors).toEqual([{ id: 'kim', pose: 'mad', parts: {}, at: 'left', flip: false }])
    api.hide()
    expect(scene().actors).toEqual([])
  })

  it('background and filter are cleared by reset', () => {
    api.background('#123456')
    api.filter('night')
    expect(scene()).toMatchObject({ background: '#123456', filter: 'night' })
    resetScene()
    expect(scene()).toMatchObject({ background: null, filter: null })
  })
})

describe('voices', () => {
  it('a muted character plays at 0 and keeps their slider value for later', () => {
    useSettingsStore.setState({ voiceVolumes: { kim: 0.5 }, voiceMuted: { kim: true } })
    expect(voiceVolume('kim')).toBe(0)
    useSettingsStore.setState({ voiceMuted: {} })
    expect(voiceVolume('kim')).toBe(0.5)
    useSettingsStore.setState({ voiceVolumes: {} })
  })

  const event = (id: string) =>
    useSystemStore.setState((s) => {
      s.event = { id: id as never, stack: [id as never] }
    })

  it("a line with a voice number plays this event's clip of its speaker, at their volume", async () => {
    const { audioFiles } = await import('../registry')
    const files = audioFiles as Record<string, string>
    files['voice/en/town/sign/kim_0012'] = '/v.ogg'
    files['voice/en/town/sign/student_a_0003'] = '/v3.ogg'
    files['voice/en/other/place/kim_0001'] = '/v1.ogg'
    const voice = vi.spyOn(audio, 'voices').mockImplementation(() => {})
    useSettingsStore.setState({ voiceVolumes: { kim: 0.5 } })
    event('town/sign')
    void api.say('kim', 'Hello', { voice: 12 })
    expect(voice).toHaveBeenCalledWith([
      { id: 'voice/en/town/sign/kim_0012', volume: 0.5, who: 'kim' },
    ])
    expect(scene().line?.voices).toEqual([{ clip: 'town/sign/kim_0012', speaker: 'kim' }])
    expect(scene().log.at(-1)).toMatchObject({
      voices: [{ clip: 'town/sign/kim_0012', speaker: 'kim' }],
      speaker: 'kim',
    })
    // No voice number = no voice (the text alone never finds a clip).
    voice.mockClear()
    advance()
    void api.say('kim', 'Hello')
    expect(voice).not.toHaveBeenCalled()
    expect(scene().line?.voices).toEqual([])
    expect(scene().log.at(-1)?.voices).toBeUndefined()
    // A number whose clip is not recorded yet plays nothing.
    advance()
    void api.say('kim', 'Hello', { voice: 13 })
    expect(voice).not.toHaveBeenCalled()
    expect(scene().line?.voices).toEqual([])
    // A speaker without a character is named after what the line shows.
    advance()
    void api.narrate('Hello', { as: 'Student A', voice: 3 })
    expect(scene().line?.voices).toEqual([
      { clip: 'town/sign/student_a_0003', speaker: 'student_a' },
    ])
    // A clip of another event, by name.
    advance()
    void api.say('kim', 'Hello', { voice: 'other/place/kim_0001' })
    expect(voice).toHaveBeenLastCalledWith([
      { id: 'voice/en/other/place/kim_0001', volume: 0.5, who: 'kim' },
    ])
    voice.mockRestore()
    useSettingsStore.setState({ voiceVolumes: {} })
    useSystemStore.setState((s) => {
      s.event = null
    })
  })

  it('a line said together: a voice per speaker, all at once; the group name tag', async () => {
    const files = (await import('../registry')).audioFiles as Record<string, string>
    files['voice/en/ev/kim_0003'] = '/k3.ogg'
    files['voice/en/ev/lee_0007'] = '/l7.ogg'
    const voices = vi.spyOn(audio, 'voices').mockImplementation(() => {})
    useSettingsStore.setState({ voiceVolumes: { lee: 0.25 } })
    event('ev')
    void api.say(['kim', 'lee'], 'Bye!', { voice: { kim: 3, lee: 7 } })
    expect(voices).toHaveBeenCalledWith([
      { id: 'voice/en/ev/kim_0003', volume: 1, who: 'kim' },
      { id: 'voice/en/ev/lee_0007', volume: 0.25, who: 'lee' },
    ])
    expect(scene().line).toMatchObject({ speaker: null, group: ['kim', 'lee'] })
    expect(scene().line?.name).toBe('Kim & Lee')
    // Someone else's voice under a line: Lee is heard while Kim's line shows.
    advance()
    void api.say('kim', 'Hm.', { voice: { kim: 3, lee: 7 } })
    expect(scene().line).toMatchObject({ speaker: 'kim' })
    expect(scene().line?.group).toBeUndefined()
    expect(scene().line?.voices.map((v) => v.speaker)).toEqual(['kim', 'lee'])
    advance()
    voices.mockRestore()
    useSettingsStore.setState({ voiceVolumes: {} })
    useSystemStore.setState((s) => {
      s.event = null
    })
  })

  it('stops the clip on continue, unless "Voices play to the end" is on', async () => {
    vi.spyOn(audio, 'voices').mockImplementation(() => {})
    const stop = vi.spyOn(audio, 'stopVoice').mockImplementation(() => {})
    const files = (await import('../registry')).audioFiles as Record<string, string>
    files['voice/en/ev/kim_0001'] = '/1.ogg'
    files['voice/en/ev/kim_0002'] = '/2.ogg'
    void api.say('kim', 'One', { voice: 'ev/kim_0001' })
    advance()
    expect(stop).toHaveBeenCalledTimes(1)
    useSettingsStore.setState({ voiceKeep: true })
    void api.say('kim', 'Two', { voice: 'ev/kim_0002' })
    advance()
    expect(stop).toHaveBeenCalledTimes(1)
    useSettingsStore.setState({ voiceKeep: false })
    vi.restoreAllMocks()
  })
})

describe('movie / input / transitions', () => {
  it('a movie holds the script until it ends, and quiets the music meanwhile', async () => {
    const release = vi.fn()
    const duck = vi.spyOn(audio, 'duck').mockReturnValue(release)
    let done = false
    void api.movie('/op.mp4', { fit: 'cover' }).then(() => {
      done = true
    })
    const movie = scene().movie
    expect(movie).toMatchObject({ src: '/op.mp4', fit: 'cover' })
    expect(duck).toHaveBeenCalledWith(0, 400)
    await Promise.resolve()
    expect(done).toBe(false)
    endMovie(-1) // another movie's id: ignored
    expect(scene().movie).not.toBeNull()
    endMovie(movie?.id ?? 0)
    await Promise.resolve()
    expect(done).toBe(true)
    expect(scene().movie).toBeNull()
    expect(release).toHaveBeenCalled()
    duck.mockRestore()
  })

  it('a movie is not shown again while a save catches up', async () => {
    resetReplay()
    void startReplay([{ k: 'l' }])
    await api.movie('/op.mp4')
    expect(scene().movie).toBeNull()
    resetReplay()
  })

  it('typed text is recorded and replayed like a choice', async () => {
    resetReplay()
    void startReplay([{ k: 'i', v: 'Robin' }])
    beginRecording('story', undefined)
    expect(await api.input('Your name?')).toBe('Robin')
    expect(currentRecording()?.record.steps).toEqual([{ k: 'i', v: 'Robin' }])
    resetReplay()
  })

  it("a background keeps its mask transition and the mask's own length", () => {
    api.background('/room.png', { transition: 'wipeLeft', duration: 900 })
    expect(scene()).toMatchObject({ backgroundTransition: 'wipeLeft', backgroundFade: 900 })
    api.background('/room2.png')
    expect(scene()).toMatchObject({ backgroundTransition: null, backgroundFade: 400 })
    // To the map (null) there is nothing to paint through a mask.
    api.background(null, { transition: 'wipeLeft' })
    expect(scene().backgroundTransition).toBeNull()
  })
})

describe('layered portraits: pose vs parts', () => {
  it('a new pose only replaces the parts its expression sets', async () => {
    const { characters } = await import('../registry')
    ;(characters as Record<string, unknown>).doll = {
      name: 'Doll',
      layered: {
        kind: 'layered',
        width: 1,
        height: 1,
        layers: {},
        expressions: { calm: { eyes: 'open' }, happy: { eyes: 'happy', mouth: 'open' } },
      },
    }
    api.show('doll', { pose: 'calm', parts: { outfit: 'jacket', mouth: 'frown' } })
    api.show('doll', { pose: 'happy' })
    // mouth is set by "happy" so the frown goes; the outfit stays.
    expect(scene().actors.find((a) => (a.id as string) === 'doll')?.parts).toEqual({
      outfit: 'jacket',
    })
  })
})

// The newer scene commands. Durations are 0 so nothing waits on a real clock.
const more = sceneApi as unknown as {
  image: (name: string, src: string | null, options?: object) => Promise<void>
  clearImages: (duration?: number) => Promise<void>
  weather: (kind: string | null, options?: object) => void
  move: (who: string, name: string) => Promise<void>
  nvl: (on?: boolean) => void
  clearPage: () => void
}

describe('image()', () => {
  it('adds a picture with defaults, changes it by name, and removes it', async () => {
    await more.image('letter', '/letter.png', { duration: 0 })
    expect(scene().images).toHaveLength(1)
    expect(scene().images[0]).toMatchObject({
      name: 'letter',
      src: '/letter.png',
      x: 50,
      y: 50,
      width: 40,
      opacity: 1,
      layer: 'front',
    })
    // The same name again changes that picture instead of adding another.
    await more.image('letter', '/letter_open.png', { x: 20, duration: 0 })
    expect(scene().images).toHaveLength(1)
    expect(scene().images[0]).toMatchObject({ src: '/letter_open.png', x: 20, y: 50 })
    await more.image('letter', null, { duration: 0 })
    expect(scene().images).toEqual([])
  })

  it('a height without a width keeps the picture shape (no default width)', async () => {
    await more.image('map', '/map.png', { height: 30, duration: 0 })
    expect(scene().images[0]).toMatchObject({ height: 30 })
    expect(scene().images[0]?.width).toBeUndefined()
  })

  it('clearImages() takes every picture away', async () => {
    await more.image('a', '/a.png', { duration: 0 })
    await more.image('b', '/b.png', { duration: 0, layer: 'back' })
    expect(scene().images.map((i) => i.name)).toEqual(['a', 'b'])
    await more.clearImages(0)
    expect(scene().images).toEqual([])
  })
})

describe('weather()', () => {
  it('sets the particles over the stage and clears them with null', () => {
    more.weather('snow', { intensity: 0.3 })
    expect(scene().weather).toEqual({ kind: 'snow', intensity: 0.3 })
    more.weather('rain')
    expect(scene().weather?.kind).toBe('rain')
    expect(scene().weather?.intensity).toBeGreaterThan(0)
    more.weather(null)
    expect(scene().weather).toBeNull()
  })
})

describe('nvl(): full-page text', () => {
  it('collects read lines on the page until clearPage()', async () => {
    more.nvl()
    expect(scene().nvl).toBe(true)
    const first = api.narrate('One.')
    expect(scene().page).toEqual([])
    advance()
    await first
    const second = api.say('kim', 'Two.')
    // The line before joined the page; the new one is the current line.
    expect(scene().page.map((line) => line.text)).toEqual(['One.'])
    expect(scene().line?.text).toBe('Two.')
    advance()
    await second
    void api.narrate('Three.')
    expect(scene().page.map((line) => [line.name, line.text])).toEqual([
      [null, 'One.'],
      ['Kim', 'Two.'],
    ])
    advance()
    more.clearPage()
    expect(scene().page).toEqual([])
    expect(scene().line).toBeNull()
  })

  it('switching it off empties the page and goes back to the box', async () => {
    more.nvl()
    const said = api.narrate('On a page.')
    advance()
    await said
    more.nvl(false)
    expect(scene()).toMatchObject({ nvl: false, page: [], line: null })
    void api.narrate('In the box.')
    expect(scene().page).toEqual([])
    expect(scene().line?.text).toBe('In the box.')
  })
})

describe('move()', () => {
  it('plays a named move and brings the character back to where they stood', async () => {
    const { getActorFx } = await import('./effects')
    api.show('kim')
    const before = { ...getActorFx('kim' as never) }
    await more.move('kim', 'hop')
    expect(getActorFx('kim' as never)).toMatchObject({ y: before.y, offsetX: before.offsetX })
  })

  it('warns about a move that is not in content/scenes.ts, and about someone not on stage', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    api.show('kim')
    await more.move('kim', 'moonwalk')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no such move'))
    api.hide('kim')
    await more.move('kim', 'hop')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('show() them first'))
    warn.mockRestore()
  })
})

describe('choices picked before', () => {
  it('are marked the next time the same choice shows', async () => {
    const { resetPersistent } = await import('../stores/persistent')
    resetPersistent()
    const first = api.choice(['Tea', 'Coffee'])
    expect(scene().choices?.map((c) => c.chosen ?? false)).toEqual([false, false])
    pick(1)
    await first
    void api.choice(['Tea', 'Coffee', 'Water'])
    expect(scene().choices?.map((c) => [c.label, c.chosen ?? false])).toEqual([
      ['Tea', false],
      ['Coffee', true],
      ['Water', false],
    ])
  })
})
