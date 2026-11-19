import screen from '@/content/config/screen'
import type { ParamArgs } from '../define'
import {
  loadMinigame,
  type MinigameId,
  type MinigameParams,
  type MinigameResult,
} from '../registry'
import { recordStep, takeStep } from '../scene/replay'
import { useSystemStore } from '../stores/system'

/** Fade in/out duration of the minigame layer. */
export const MINIGAME_FADE_MS = screen.timings.minigameFade

const set = useSystemStore.setState

/** Puts a minigame on screen; resolves with what it passes to finish() (after the fade out). */
function mount(
  id: MinigameId,
  params: unknown,
  def: { quitResult?: unknown; menuButton?: boolean },
  onFinish?: (result: unknown) => void,
): Promise<unknown> {
  return new Promise((resolve) => {
    let finished = false
    set((s) => {
      s.minigame = {
        id,
        params,
        quit: 'quitResult' in def ? { result: def.quitResult } : null,
        leaving: false,
        overTitle: useSystemStore.getState().title !== null,
        ...(def.menuButton === false ? { noMenuButton: true } : {}),
        finish: (result) => {
          if (finished) return // only the first finish() counts
          finished = true
          onFinish?.(result)
          set((st) => {
            if (st.minigame) st.minigame.leaving = true
          })
          setTimeout(() => {
            set((st) => {
              st.minigame = null
            })
            resolve(result)
          }, MINIGAME_FADE_MS)
        },
      }
    })
  })
}

export const minigames = {
  /** Shows a minigame full screen. Resolves with its result when it calls finish() (after the fade). */
  async start<K extends MinigameId>(
    id: K,
    ...[params]: ParamArgs<MinigameParams<K>>
  ): Promise<MinigameResult<K>> {
    const def = (await loadMinigame(id)) as { quitResult?: unknown; menuButton?: boolean }
    // Replaying a mid-scene save: the minigame was played already, use its result.
    const replayed = takeStep('m')
    if (replayed) {
      recordStep(replayed)
      return replayed.v as MinigameResult<K>
    }
    if (useSystemStore.getState().minigame) {
      throw new Error(`Cannot start minigame "${id}": another minigame is running`)
    }
    return (await mount(id, params, def, (result) =>
      recordStep({ k: 'm', v: result }),
    )) as MinigameResult<K>
  },

  /**
   * Opens a minigame as a screen of the game's own UI (Extras), not as a step of a scene: it is
   * never part of a mid-scene save, and a running scene simply waits under it. Resolves with its
   * result. Does nothing (resolves undefined) when another minigame is up.
   */
  async open<K extends MinigameId>(
    id: K,
    ...[params]: ParamArgs<MinigameParams<K>>
  ): Promise<MinigameResult<K> | undefined> {
    const def = (await loadMinigame(id)) as { quitResult?: unknown; menuButton?: boolean }
    if (useSystemStore.getState().minigame) return undefined
    return (await mount(id, params, def)) as MinigameResult<K>
  },

  /**
   * Ends the running minigame from outside, as if it called finish(result) (e.g. a callback it
   * was given, like the after story screen's launch). Nothing runs: does nothing.
   */
  finish(result?: unknown): void {
    useSystemStore.getState().minigame?.finish(result)
  },

  isRunning(): boolean {
    return useSystemStore.getState().minigame !== null
  },
}
