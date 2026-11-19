// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CharacterId } from '../registry'
import { backgroundStyle } from './background'
import {
  animate,
  fade,
  flash,
  frameFx,
  getActorFx,
  moveCamera,
  placeActor,
  registerActor,
  registerCameraTarget,
  registerVeil,
  resetEffects,
  shake,
  stagePx,
  startShake,
  stopShake,
} from './effects'
import { usePlaybackStore } from './playback'

const kim = 'kim' as CharacterId

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'setTimeout'],
  })
})
afterEach(() => {
  resetEffects()
  vi.useRealTimers()
})

describe('reduce shaking and flashes', () => {
  it('shake does nothing and a flash is soft', async () => {
    const { useSettingsStore } = await import('../stores/settings')
    useSettingsStore.setState({ reduceMotion: true })
    const target = document.createElement('div')
    const unregister = registerCameraTarget(target)
    const veil = document.createElement('div')
    registerVeil(veil)
    void shake({ strength: 20, duration: 300 })
    startShake(10)
    vi.advanceTimersByTime(50)
    expect(target.style.transform).toBe('')
    void flash('#ffffff', 200)
    vi.advanceTimersByTime(210)
    // Never brighter than scenes.comfort.reducedFlash (0.25).
    expect(Number(veil.style.opacity)).toBeLessThanOrEqual(0.25)
    expect(Number(veil.style.opacity)).toBeGreaterThan(0)
    unregister()
    useSettingsStore.setState({ reduceMotion: false })
  })
})

describe('backgroundStyle', () => {
  it.each([
    ['rgba(0, 0, 0, 0.5)', { backgroundColor: 'rgba(0, 0, 0, 0.5)' }],
    ['#00000080', { backgroundColor: '#00000080' }],
    ['transparent', { backgroundColor: 'transparent' }],
    ['black', { backgroundColor: 'black' }],
    ['hsl(200 50% 20% / 40%)', { backgroundColor: 'hsl(200 50% 20% / 40%)' }],
    [
      'linear-gradient(#000, transparent)',
      { backgroundImage: 'linear-gradient(#000, transparent)' },
    ],
  ])('%s is a colour/gradient', (value, style) => {
    expect(backgroundStyle(value)).toEqual(style)
  })

  it.each([
    './assets/forest-x1.png',
    '/assets/bg.jpg',
    'data:image/png;base64,AAA',
    'https://x.y/bg.webp',
  ])('%s is an image', (value) => {
    expect(backgroundStyle(value)).toMatchObject({ backgroundImage: `url("${value}")` })
  })
})

describe('portraits', () => {
  it('fade in when shown, then animate on the element', async () => {
    const el = document.createElement('div')
    placeActor(kim, 'right', true)
    registerActor(kim, el)
    expect(getActorFx(kim)).toMatchObject({ x: 75, opacity: 0 })
    await vi.advanceTimersByTimeAsync(400)
    expect(getActorFx(kim)?.opacity).toBe(1)

    const moving = animate(
      kim,
      { x: 'left', rotate: 90, scale: 2 },
      { duration: 200, ease: 'backOut' },
    )
    await vi.advanceTimersByTimeAsync(250)
    await moving
    expect(getActorFx(kim)).toMatchObject({ x: 25, rotate: 90, scale: 2 })
    expect(el.style.transform).toContain('rotate(90deg)')
    expect(el.style.transform).toContain('scale(2)')
  })
})

describe('shake', () => {
  it('a timed shake still stops by itself', async () => {
    const stage = document.createElement('div')
    const unregister = registerCameraTarget(stage)
    const quake = shake({ strength: 5, duration: 200 })
    await vi.advanceTimersByTimeAsync(100)
    expect(stage.style.transform).not.toBe('')
    await vi.advanceTimersByTimeAsync(300)
    await quake
    expect(stage.style.transform).toBe('')
    unregister()
  })

  it('startShake goes on past any duration until stopShake eases it out', async () => {
    const stage = document.createElement('div')
    const unregister = registerCameraTarget(stage)
    startShake(8)
    await vi.advanceTimersByTimeAsync(2000)
    expect(stage.style.transform).not.toBe('')
    const stopping = stopShake(200)
    await vi.advanceTimersByTimeAsync(300)
    await stopping
    expect(stage.style.transform).toBe('')
    unregister()
  })

  it('a timed shake during an ongoing one does not end the ongoing one', async () => {
    const stage = document.createElement('div')
    const unregister = registerCameraTarget(stage)
    startShake(4)
    const burst = shake({ strength: 12, duration: 100 })
    await vi.advanceTimersByTimeAsync(200)
    await burst
    expect(stage.style.transform).not.toBe('')
    const stopping = stopShake(50)
    await vi.advanceTimersByTimeAsync(100)
    await stopping
    expect(stage.style.transform).toBe('')
    unregister()
  })

  it('resetEffects ends an ongoing shake', async () => {
    const stage = document.createElement('div')
    const unregister = registerCameraTarget(stage)
    startShake()
    await vi.advanceTimersByTimeAsync(100)
    resetEffects()
    expect(stage.style.transform).toBe('')
    unregister()
  })
})

describe('camera, flash, fade', () => {
  it('zooms the registered layers and resets after the event', async () => {
    const stage = document.createElement('div')
    const unregister = registerCameraTarget(stage)
    const zoom = moveCamera({ zoom: 2, focus: { x: 25, y: 50 } }, { duration: 100 })
    await vi.advanceTimersByTimeAsync(150)
    await zoom
    expect(stage.style.transform).toBe('translate(calc(0cqw + 0cqh), calc(-50cqh + 0cqh)) scale(2)')
    resetEffects()
    expect(stage.style.transform).toBe('')
    unregister()
  })

  it('flash goes up and back down; fade stays until fade(null)', async () => {
    const veil = document.createElement('div')
    registerVeil(veil)
    const flashing = flash('#ff0000', 200)
    await vi.advanceTimersByTimeAsync(60)
    expect(Number(veil.style.opacity)).toBeGreaterThan(0.5)
    await vi.advanceTimersByTimeAsync(300)
    await flashing
    expect(veil.style.opacity).toBe('0')

    const black = fade('#000000', 100)
    await vi.advanceTimersByTimeAsync(150)
    await black
    expect(veil.style.opacity).toBe('1')
    const back = fade(null, 100)
    await vi.advanceTimersByTimeAsync(150)
    await back
    expect(veil.style.opacity).toBe('0')
    registerVeil(null)
  })
})

describe('show with scale (far away → close)', () => {
  it('starts small and high, then animate() brings them closer', async () => {
    const el = document.createElement('div')
    placeActor(kim, 'center', true, { scale: 0.4, y: -120 })
    registerActor(kim, el)
    expect(getActorFx(kim)).toMatchObject({ scale: 0.4, y: -120 })
    const walk = animate(kim, { scale: 1, y: 0 }, { duration: 1000, ease: 'linear' })
    await vi.advanceTimersByTimeAsync(500)
    const halfway = getActorFx(kim)?.scale ?? 0
    expect(halfway).toBeGreaterThan(0.6)
    expect(halfway).toBeLessThan(0.8)
    await vi.advanceTimersByTimeAsync(600)
    await walk
    expect(getActorFx(kim)).toMatchObject({ scale: 1, y: 0 })
    expect(el.style.transform).toContain('scale(1)')
  })

  it('show({ scale }) on someone already shown jumps to that size', async () => {
    placeActor(kim, 'center', true)
    placeActor(kim, 'center', false, { scale: 0.5 })
    expect(getActorFx(kim)?.scale).toBe(0.5)
  })
})

describe('show with a named distance', () => {
  it('a new character starts there; one on stage steps there; scale / y given win', async () => {
    placeActor(kim, 'center', true, {}, { scale: 1.3, y: 110 })
    expect(getActorFx(kim)).toMatchObject({ scale: 1.3, y: 110 })
    placeActor(kim, 'center', false, {}, { scale: 0.75, y: -40 })
    await vi.advanceTimersByTimeAsync(1000)
    expect(getActorFx(kim)).toMatchObject({ scale: 0.75, y: -40 })
    placeActor(kim, 'center', false, { scale: 2 }, { scale: 1, y: 0 })
    await vi.advanceTimersByTimeAsync(1000)
    expect(getActorFx(kim)).toMatchObject({ scale: 2, y: 0 })
  })
})

describe('offsetX', () => {
  it('show({ at, offsetX, y }) places them in stage pixels relative to the stage spot; animate() moves the offset', async () => {
    const el = document.createElement('div')
    placeActor(kim, 'center', true, { offsetX: -100, y: 100 }) // 100px left of centre, 100px lower
    registerActor(kim, el)
    expect(getActorFx(kim)).toMatchObject({ x: 50, offsetX: -100, y: 100 })
    // Stage pixels: 100 on a 720-tall design screen = 13.89% of the screen height.
    expect(el.style.transform).toContain(`calc(50cqw - 50% + ${stagePx(-100)})`)
    expect(el.style.transform).toContain(`translateY(${stagePx(100)})`)
    expect(stagePx(720)).toBe('100cqh')
    const back = animate(kim, { offsetX: 0, y: 0 }, { duration: 100 })
    await vi.advanceTimersByTimeAsync(150)
    await back
    expect(getActorFx(kim)).toMatchObject({ offsetX: 0, y: 0 })
  })
})

describe('fade colours', () => {
  it('crossfades from one colour to another', async () => {
    const el = document.createElement('div')
    registerVeil(el)
    await fade('#000000', 0)
    const done = fade('#ffffff', 1000)
    await vi.advanceTimersByTimeAsync(500)
    const red = Number.parseInt(el.style.backgroundColor.match(/\d+/)?.[0] ?? '0', 10)
    expect(red).toBeGreaterThan(100)
    expect(red).toBeLessThan(160)
    await vi.advanceTimersByTimeAsync(600)
    await done
    expect(el.style.backgroundColor).toBe('rgb(255, 255, 255)')
    registerVeil(null)
  })
})

describe('skipping effects', () => {
  it('finishes a running fade as soon as skipping starts', async () => {
    const el = document.createElement('div')
    registerVeil(el)
    const done = fade('#000000', 2000)
    usePlaybackStore.setState({ active: true })
    await done
    expect(el.style.opacity).toBe('1')
    usePlaybackStore.setState({ active: false })
    registerVeil(null)
  })
})

describe('portrait framing (show / animate `frame`)', () => {
  // A character without its own `stage`, nothing drawn: the picture is portraitHeight (78% of a
  // 720 design screen = 561.6 stage px) tall, the whole of it shown ([0, 1]).
  const id = 'nobody' as CharacterId
  const height = (78 * 720) / 100

  it('the legs only: the bottom 35% fills the height, nothing moves (it already stands there)', () => {
    const fx = frameFx(id, [0.65, 1])
    expect(fx.scale).toBeCloseTo(1 / 0.35)
    expect(fx.y).toBeCloseTo(0)
  })

  it('the face: the top 35%, the same size, so going from legs to face is a pan down', () => {
    const fx = frameFx(id, [0, 0.35])
    expect(fx.scale).toBeCloseTo(1 / 0.35)
    // The 35% line goes to the screen's bottom edge: the picture moves down by the rest.
    expect(fx.y).toBeCloseTo(0.65 * height * (1 / 0.35))
  })

  it('the whole picture is the normal framing; bad values are made sane', () => {
    expect(frameFx(id, [0, 1])).toEqual({ scale: 1, y: 0 })
    expect(frameFx(id, [0.5, 0.2]).scale).toBeCloseTo(1 / 0.05)
  })
})
