import { describe, expect, it } from 'vitest'
import type { EventId, MinigameId, WindowId } from '../registry'
import { emptyScene } from '../scene/state'
import { type SystemState, topLayer } from './system'

const base: SystemState = {
  map: null,
  event: null,
  scene: emptyScene(),
  minigame: null,
  windows: [],
  title: null,
  titleMenu: null,
  titleReady: false,
  boot: null,
  titleMenuIn: false,
  titleSkips: 0,
  mapTransition: null,
  loadingProgress: 0,
  device: 'keyboard',
  gamepad: 'xbox',
  sceneReplay: false,
}

describe('topLayer', () => {
  it('follows map → event → minigame → windows', () => {
    expect(topLayer(base)).toBe('map')
    const withEvent = { ...base, event: { id: 'e' as EventId, stack: ['e' as EventId] } }
    expect(topLayer(withEvent)).toBe('event')
    const withMinigame = {
      ...withEvent,
      minigame: {
        id: 'm' as MinigameId,
        params: undefined,
        finish: () => {},
        quit: null,
        leaving: false,
        overTitle: false,
      },
    }
    expect(topLayer(withMinigame)).toBe('minigame')
    const withWindow = { ...withMinigame, windows: [{ id: 'w' as WindowId, params: undefined }] }
    expect(topLayer(withWindow)).toBe('windows')
  })
})

describe('topLayer with title', () => {
  it('puts the title screen above the game, but below windows', () => {
    const minigame = {
      id: 'm' as MinigameId,
      params: undefined,
      finish: () => {},
      quit: null,
      leaving: false,
      overTitle: false,
    }
    expect(topLayer({ ...base, title: 'shown', minigame })).toBe('title')
    // Started from the title screen (After Stories): over it.
    const fromTitle = { ...minigame, overTitle: true }
    expect(topLayer({ ...base, title: 'menu', minigame: fromTitle })).toBe('minigame')
    const withWindow = {
      ...base,
      title: 'menu' as const,
      windows: [{ id: 'w' as WindowId, params: undefined }],
    }
    expect(topLayer(withWindow)).toBe('windows')
  })
})
