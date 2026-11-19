import { describe, expect, it } from 'vitest'
import {
  animationStates,
  facingToward,
  frameAt,
  idleAnimation,
  pickAnimation,
  walkLegs,
} from './anim'

describe('pickAnimation', () => {
  const names = ['idle_down', 'idle_right', 'walk_down', 'wave']
  it('prefers state_facing, mirrors right for left, then the plain state', () => {
    expect(pickAnimation(names, 'idle', 'down')).toEqual({ name: 'idle_down', flip: false })
    expect(pickAnimation(names, 'idle', 'left')).toEqual({ name: 'idle_right', flip: true })
    expect(pickAnimation(names, 'wave', 'up')).toEqual({ name: 'wave', flip: false })
    expect(pickAnimation(names, 'walk', 'up')).toBeUndefined()
  })
  it('falls back to idle facing down, then the first tag', () => {
    expect(idleAnimation(names, 'left')).toEqual({ name: 'idle_right', flip: true })
    expect(idleAnimation(names, 'up')).toEqual({ name: 'idle_down', flip: false })
    expect(idleAnimation(['bounce', 'hurt'], 'right')).toEqual({ name: 'bounce', flip: false })
    expect(idleAnimation([], 'right')).toBeUndefined()
  })
  it('lists states', () => {
    expect(animationStates(names)).toEqual(['idle', 'walk', 'wave'])
  })
})

describe('frameAt', () => {
  const anim = { frames: [5, 6, 7], durations: [100, 200, 100], repeat: 0 }
  it('loops by duration', () => {
    expect(frameAt(anim, 0)).toEqual({ cell: 5, done: false })
    expect(frameAt(anim, 150)).toEqual({ cell: 6, done: false })
    expect(frameAt(anim, 350)).toEqual({ cell: 7, done: false })
    expect(frameAt(anim, 450)).toEqual({ cell: 5, done: false })
  })
  it('stops on the last frame after its repeats', () => {
    const twice = { ...anim, repeat: 2 }
    expect(frameAt(twice, 450)).toEqual({ cell: 5, done: false })
    expect(frameAt(twice, 800)).toEqual({ cell: 7, done: true })
  })
})

describe('walkLegs', () => {
  it('chains steps with their own speed or the default', () => {
    expect(
      walkLegs({ x: 10, y: 10 }, [{ left: 5, speed: 5 }, { right: 3 }, { up: 2, speed: 10 }], 3),
    ).toEqual([
      { facing: 'left', x: 5, y: 10, speed: 5 },
      { facing: 'right', x: 8, y: 10, speed: 3 },
      { facing: 'up', x: 8, y: 8, speed: 10 },
    ])
  })
  it('rejects steps without exactly one direction, and bad speeds', () => {
    expect(() => walkLegs({ x: 0, y: 0 }, [{ left: 1, up: 1 }], 3)).toThrow('step 1')
    expect(() => walkLegs({ x: 0, y: 0 }, [{ speed: 2 }], 3)).toThrow('exactly one direction')
    expect(() => walkLegs({ x: 0, y: 0 }, [{ up: 1, speed: 0 }], 3)).toThrow('speed')
  })
})

describe('facingToward', () => {
  it('uses the bigger axis', () => {
    expect(facingToward({ x: 0, y: 0 }, { x: 3, y: 1 }, 'up')).toBe('right')
    expect(facingToward({ x: 0, y: 0 }, { x: -1, y: -4 }, 'down')).toBe('up')
    expect(facingToward({ x: 1, y: 1 }, { x: 1, y: 1 }, 'left')).toBe('left')
  })
})
