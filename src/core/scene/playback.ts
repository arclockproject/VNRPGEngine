// Skip and auto-play (visual novel controls). Runtime only: not saved.
import { create } from 'zustand'
import scenes from '@/content/scenes'
import { getGame } from '../gameRef'
import { useGameStore } from '../stores/game'
import { useSettingsStore } from '../stores/settings'
import { topLayer, useSystemStore } from '../stores/system'

/** "Skip back": the pause between two steps back, ms (src/content/scenes.ts toolbar.skipBackMs). */
const SKIP_BACK_MS = scenes.toolbar.skipBackMs ?? 250

interface PlaybackState {
  /** Skip mode: read lines fly by (unread ones too if the setting allows). Stops at choices. */
  skip: boolean
  /** Auto-play: lines continue by themselves after a pause. */
  auto: boolean
  /** Skip is moving lines on right now (set by the dialogue box). */
  active: boolean
  /** "To choice": skip without the short pause per line, up to the next choice. */
  fast: boolean
  /** "Skip back": Back again and again (one line each skipBackMs) until stopped or nothing is left. */
  back: boolean
}

export const usePlaybackStore = create<PlaybackState>(() => ({
  skip: false,
  auto: false,
  active: false,
  fast: false,
  back: false,
}))

/** Fades, animations and waits should finish at once: skipping, and the setting is on. */
export function isSkippingEffects(): boolean {
  return usePlaybackStore.getState().active && useSettingsStore.getState().skipEffects
}

export const playback = {
  toggleSkip: () => usePlaybackStore.setState((s) => ({ skip: !s.skip, fast: false, back: false })),
  /** Jumps ahead to the next choice (or the end of the scene). Stops at unread text like skip. */
  skipToChoice: () => usePlaybackStore.setState({ skip: true, fast: true, back: false }),
  toggleAuto: () => usePlaybackStore.setState((s) => ({ auto: !s.auto, back: false })),
  /** "Skip back" on / off. Turning it on stops Skip and Auto (they go the other way). */
  toggleSkipBack: () => {
    const on = !usePlaybackStore.getState().back
    usePlaybackStore.setState(
      on ? { back: true, skip: false, fast: false, auto: false, active: false } : { back: false },
    )
    if (on) void stepBack()
  },
  stopSkipBack: () => {
    if (usePlaybackStore.getState().back) usePlaybackStore.setState({ back: false })
  },
  stopSkip: () => usePlaybackStore.setState({ skip: false, active: false, fast: false }),
  /**
   * A choice shows: skipping stops. Returns a function to call once the player has picked: it
   * turns Skip back on when it was on and the player's "Keep skipping after a choice" setting
   * says so. ("To choice" has arrived, so it never comes back.)
   */
  pauseAtChoice: (): (() => void) => {
    const { skip, fast } = usePlaybackStore.getState()
    playback.stopSkip()
    return () => {
      if (skip && !fast && useSettingsStore.getState().skipAfterChoice)
        usePlaybackStore.setState({ skip: true })
    }
  },
  /**
   * A scene ended. Skipping stops with it, except while a route plays (visual novel mode): there
   * the next scene follows at once, so Skip and "To choice" carry on into it.
   */
  sceneEnded: () => {
    if (useGameStore.getState().route) usePlaybackStore.setState({ active: false })
    else playback.stopSkip()
  },
}

/** One step of "Skip back", then the next after a pause. Stops when Back can't go further or a window opens. */
async function stepBack(): Promise<void> {
  const on = () =>
    usePlaybackStore.getState().back && topLayer(useSystemStore.getState()) === 'event'
  if (!on()) return playback.stopSkipBack()
  const went = await getGame().save.rollback()
  if (!went) return playback.stopSkipBack()
  setTimeout(() => void stepBack(), SKIP_BACK_MS)
}
