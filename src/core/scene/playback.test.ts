// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { useGameStore } from '../stores/game'
import { useSettingsStore } from '../stores/settings'
import { playback, usePlaybackStore } from './playback'

const state = () => usePlaybackStore.getState()

beforeEach(() => {
  playback.stopSkip()
  useSettingsStore.setState({ skipAfterChoice: false })
  useGameStore.setState({ route: null })
})

describe('skip at a choice', () => {
  it('stops, and stays off after the pick by default', () => {
    playback.toggleSkip()
    const resume = playback.pauseAtChoice()
    expect(state().skip).toBe(false)
    resume()
    expect(state().skip).toBe(false)
  })

  it('comes back after the pick with "Keep skipping after a choice"', () => {
    useSettingsStore.setState({ skipAfterChoice: true })
    playback.toggleSkip()
    const resume = playback.pauseAtChoice()
    expect(state().skip).toBe(false)
    resume()
    expect(state().skip).toBe(true)
  })

  it('"To choice" has arrived: it never comes back; nor does skip that was off', () => {
    useSettingsStore.setState({ skipAfterChoice: true })
    playback.skipToChoice()
    playback.pauseAtChoice()()
    expect(state()).toMatchObject({ skip: false, fast: false })
    playback.pauseAtChoice()()
    expect(state().skip).toBe(false)
  })
})

describe('skip when a scene ends', () => {
  it('stops in the normal game', () => {
    playback.toggleSkip()
    playback.sceneEnded()
    expect(state().skip).toBe(false)
  })

  it('carries on into the next scene while a route plays', () => {
    useGameStore.setState({
      route: { id: 'common', from: [], answers: [], visited: [], done: false },
    })
    playback.skipToChoice()
    usePlaybackStore.setState({ active: true })
    playback.sceneEnded()
    expect(state()).toMatchObject({ skip: true, fast: true, active: false })
  })
})
