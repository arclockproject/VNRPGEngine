// @vitest-environment happy-dom
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineAtlas, defineLayeredPortrait, portraitUrls, resolveParts } from './define'
import { LayeredPortraitView } from './LayeredPortraitView'
import { partCss } from './style'
import { setTalking, setVoiceLevelSource } from './talking'

const sheet = defineAtlas({
  src: 'face.png',
  width: 200,
  height: 100,
  frames: {
    open: { x: 0, y: 0, w: 100, h: 50 },
    closed: { x: 100, y: 0, w: 100, h: 50 },
    smile: { x: 0, y: 50, w: 100, h: 50 },
    talk: { x: 100, y: 50, w: 100, h: 50 },
  },
})
const portrait = defineLayeredPortrait({
  width: 400,
  height: 800,
  base: sheet.open,
  layers: {
    eyes: { x: 100, y: 200, options: { open: sheet.open, closed: sheet.closed } },
    mouth: { x: 150, y: 300, options: { smile: sheet.smile, talk: sheet.talk } },
    hat: { x: 0, y: 0, options: { on: sheet.open }, default: null },
  },
  expressions: { calm: { eyes: 'open' }, sleepy: { eyes: 'closed', hat: 'on' } },
  blink: { layer: 'eyes', closed: 'closed', everyMs: [1000, 1000], closedMs: 100 },
  talk: { layer: 'mouth', open: 'talk', frameMs: 50 },
})

describe('resolveParts', () => {
  it('uses the expression, then layer defaults, then overrides', () => {
    expect(resolveParts(portrait, 'calm')).toEqual({ eyes: 'open', mouth: 'smile', hat: null })
    expect(resolveParts(portrait, 'sleepy')).toEqual({ eyes: 'closed', mouth: 'smile', hat: 'on' })
    expect(resolveParts(portrait, 'calm', { mouth: 'talk', eyes: null })).toEqual({
      eyes: null,
      mouth: 'talk',
      hat: null,
    })
  })

  it('lists every image to preload (an atlas counts once)', () => {
    expect(portraitUrls(portrait)).toEqual(['face.png'])
  })
})

describe('partCss', () => {
  it('places an atlas frame in % of the base and shows the right part of the sheet', () => {
    expect(partCss(sheet.closed, 100, 200, 400, 800)).toMatchObject({
      left: '25%',
      top: '25%',
      width: '25%',
      height: '6.25%',
      backgroundImage: 'url("face.png")',
      backgroundSize: '200% 200%',
      backgroundPosition: '100% 0%',
    })
  })

  it('hides plain files until their size is known', () => {
    expect(partCss('eyes.png', 0, 0, 400, 800).display).toBe('none')
    expect(partCss('eyes.png', 40, 80, 400, 800, { w: 40, h: 16 })).toMatchObject({
      display: 'block',
      left: '10%',
      width: '10%',
      height: '2%',
    })
  })
})

describe('LayeredPortraitView', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const eyes = () => document.querySelector<HTMLElement>('[data-layer-part="eyes"]')
  const mouth = () => document.querySelector<HTMLElement>('[data-layer-part="mouth"]')

  it('blinks by itself and flaps the mouth while talking', async () => {
    render(<LayeredPortraitView id="kim" portrait={portrait} expression="calm" height="500px" />)
    const openPosition = eyes()?.style.backgroundPosition
    expect(openPosition).toBe('0% 0%')

    await act(async () => vi.advanceTimersByTime(1010))
    expect(eyes()?.style.backgroundPosition).toBe('100% 0%') // closed
    await act(async () => vi.advanceTimersByTime(110))
    expect(eyes()?.style.backgroundPosition).toBe(openPosition) // open again

    const positions = new Set<string>()
    await act(async () => setTalking('kim'))
    for (let i = 0; i < 4; i++) {
      await act(async () => vi.advanceTimersByTime(50))
      positions.add(mouth()?.style.backgroundPosition ?? '')
    }
    expect(positions.size).toBe(2) // flipped between smile and talk
    await act(async () => setTalking(null))
    expect(mouth()?.style.backgroundPosition).toBe('0% 100%') // back to smile
  })

  it('follows the voice clip: open while it is loud, shut in its pauses and after it', async () => {
    render(<LayeredPortraitView id="kim" portrait={portrait} expression="calm" height="500px" />)
    const smile = mouth()?.style.backgroundPosition
    let level = 0
    setVoiceLevelSource(() => level)
    await act(async () => setTalking('kim', 'voice'))
    // Silence at the start of the clip: the mouth stays shut (typing would have flapped it).
    await act(async () => vi.advanceTimersByTime(200))
    expect(mouth()?.style.backgroundPosition).toBe(smile)
    level = 0.3
    await act(async () => vi.advanceTimersByTime(50))
    const open = mouth()?.style.backgroundPosition
    expect(open).not.toBe(smile)
    // Still loud: it stays open instead of flipping.
    await act(async () => vi.advanceTimersByTime(300))
    expect(mouth()?.style.backgroundPosition).toBe(open)
    // A pause in the speech: shut after the short hold.
    level = 0
    await act(async () => vi.advanceTimersByTime(200))
    expect(mouth()?.style.backgroundPosition).toBe(smile)
    level = 0.3
    await act(async () => vi.advanceTimersByTime(50))
    expect(mouth()?.style.backgroundPosition).toBe(open)
    await act(async () => setTalking(null))
    expect(mouth()?.style.backgroundPosition).toBe(smile)
    // No way to measure (no Web Audio): it flaps like a typed line.
    setVoiceLevelSource(() => null)
    const positions = new Set<string>()
    await act(async () => setTalking('kim', 'voice'))
    for (let i = 0; i < 4; i++) {
      await act(async () => vi.advanceTimersByTime(50))
      positions.add(mouth()?.style.backgroundPosition ?? '')
    }
    expect(positions.size).toBe(2)
    await act(async () => setTalking(null))
  })

  it('with several voices, each mouth follows its own clip', async () => {
    const views = ['kim', 'lee'].map(
      (id) =>
        render(<LayeredPortraitView id={id} portrait={portrait} expression="calm" height="500px" />)
          .container,
    )
    const mouths = () =>
      views.map(
        (view) =>
          view.querySelector<HTMLElement>('[data-layer-part="mouth"]')?.style.backgroundPosition,
      )
    const [smile] = mouths()
    const levels: Record<string, number> = { kim: 0.3, lee: 0 }
    setVoiceLevelSource((who) => (who ? (levels[who] ?? 0) : 0.3))
    await act(async () => setTalking(['kim', 'lee'], 'voice'))
    await act(async () => vi.advanceTimersByTime(50))
    // Kim's clip is loud, Lee's is silent (or over): only Kim's mouth is open.
    expect(mouths()[0]).not.toBe(smile)
    expect(mouths()[1]).toBe(smile)
    levels.kim = 0
    levels.lee = 0.3
    await act(async () => vi.advanceTimersByTime(200))
    expect(mouths()[0]).toBe(smile)
    expect(mouths()[1]).not.toBe(smile)
    await act(async () => setTalking(null))
    setVoiceLevelSource(() => null)
  })

  it('hides a layer whose option is null', () => {
    render(<LayeredPortraitView id="kim" portrait={portrait} expression="calm" height="500px" />)
    expect(document.querySelector<HTMLElement>('[data-layer-part="hat"]')?.style.display).toBe(
      'none',
    )
  })
})
