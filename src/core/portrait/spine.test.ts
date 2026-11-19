// fromSpine(): turning the content's options into a portrait (no Spine runtime involved).
import { describe, expect, it } from 'vitest'
import { defineSpineExport, fromSpine, spineParts } from './spine'

const data = defineSpineExport({
  version: '4.3.13',
  skeleton: '/x.skel',
  binary: true,
  atlas: '/x.atlas',
  pages: { 'x.png': '/x.png' },
  animations: ['idle', 'happy', 'wave_in', 'wave', 'talk', 'blink'],
  skins: ['default', 'hat/cap', 'hat/party'],
  box: { x: -100, y: 0, width: 200, height: 400 },
})

describe('fromSpine', () => {
  const portrait = fromSpine(data, {
    expressions: { neutral: 'idle', happy: { animation: 'happy', parts: { hat: 'party' } } },
    parts: { hat: { cap: 'hat/cap', party: 'hat/party', none: null } },
    talk: 'talk',
    blink: 'blink',
  })

  it('makes every pose a looping animation, sized by the generated box', () => {
    expect(portrait.kind).toBe('spine')
    expect(portrait.expressions.neutral).toEqual({ animation: 'idle', loop: true, parts: {} })
    expect(portrait.expressions.happy.parts).toEqual({ hat: 'party' })
    expect([portrait.width, portrait.height]).toEqual([200, 400])
    expect(portrait.talk).toEqual({ animation: 'talk' })
    expect(portrait.blink).toEqual({ animation: 'blink', everyMs: [2000, 6000] })
  })

  it('a part starts on its first option; the pose, then show(), win over it', () => {
    expect(spineParts(portrait, 'neutral', undefined)).toEqual({ hat: 'cap' })
    expect(spineParts(portrait, 'happy', undefined)).toEqual({ hat: 'party' })
    expect(spineParts(portrait, 'happy', { hat: 'none' })).toEqual({ hat: 'none' })
    // An unknown pose falls back to the first one.
    expect(spineParts(portrait, 'nope', undefined)).toEqual({ hat: 'cap' })
  })

  it('an option is one skin, several skins (a whole outfit), or none', () => {
    const dressed = fromSpine(data, {
      expressions: { neutral: 'idle' },
      parts: { outfit: { both: ['hat/cap', 'hat/party'], cap: 'hat/cap', none: null } },
    })
    expect(dressed.parts.outfit).toEqual({
      both: ['hat/cap', 'hat/party'],
      cap: ['hat/cap'],
      none: [],
    })
  })

  it('a pose can have an intro; mixes are per pair', () => {
    const waving = fromSpine(data, {
      expressions: { wave: { intro: 'wave_in', animation: 'wave' } },
      mixes: { 'wave>idle': 0.5 },
      mix: 0.3,
    })
    expect(waving.expressions.wave).toEqual({
      intro: 'wave_in',
      animation: 'wave',
      loop: true,
      parts: {},
    })
    expect(waving.mix).toBe(0.3)
    expect(waving.mixes).toEqual({ 'wave>idle': 0.5 })
  })

  it('takes its own box and part defaults', () => {
    const own = fromSpine(data, {
      expressions: { neutral: 'idle' },
      parts: { hat: { cap: 'hat/cap', none: null } },
      defaults: { parts: { hat: 'none' } },
      box: { x: 0, y: 0, width: 50, height: 60 },
    })
    expect([own.width, own.height]).toEqual([50, 60])
    expect(spineParts(own, null, undefined)).toEqual({ hat: 'none' })
  })
})
