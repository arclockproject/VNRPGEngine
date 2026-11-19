import { useEffect, useEffectEvent } from 'react'
import { topLayer, useSystemStore } from '../stores/system'

/**
 * Calls `tick(deltaSeconds)` every animation frame while the minigame is the top layer.
 * It pauses by itself while a window (e.g. settings) is open over the minigame, and stops
 * once the minigame has finished. Update refs / draw to a canvas here, not React state.
 */
export function useGameLoop(tick: (deltaSeconds: number) => void) {
  const onTick = useEffectEvent(tick)
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
      // Cap the step so a long pause (tab hidden, window open) doesn't jump the game ahead.
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      const state = useSystemStore.getState()
      if (topLayer(state) === 'minigame' && !state.minigame?.leaving) onTick(dt)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])
}
