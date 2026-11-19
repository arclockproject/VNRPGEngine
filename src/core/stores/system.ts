// Runtime state of the engine: what is on screen right now. Not part of save files.
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { EventId, MapId, MinigameId, WindowId } from '../registry'
import { emptyScene, type SceneState } from '../scene/state'

export interface OpenWindow {
  id: WindowId
  params: unknown
}

export type InputDevice = 'keyboard' | 'gamepad' | 'touch'
/** Which button labels to show for the last used gamepad. */
export type GamepadKind = 'xbox' | 'playstation' | 'nintendo' | 'steamdeck'

export interface SystemState {
  map: { id: MapId; params: unknown; spawn: string } | null
  /** Map change in progress: fading 'out', 'loading' (black, maybe with progress), fading 'in'. */
  mapTransition: 'out' | 'loading' | 'in' | null
  /** 0..1 while loading a map's assets. */
  loadingProgress: number
  /** The running event (innermost) and the chain it runs inside of, outermost first. */
  event: { id: EventId; stack: EventId[] } | null
  /** Dialogue, portraits, background and filter of the running event. */
  scene: SceneState
  minigame: {
    id: MinigameId
    params: unknown
    finish: (result: unknown) => void
    /** Present when the cancel action may quit; holds the result to quit with. */
    quit: { result: unknown } | null
    /** Fading out after finish(); input is ignored meanwhile. */
    leaving: boolean
    /** Started from the title screen: drawn (and takes input) over it. */
    overTitle: boolean
    /** Its definition says menuButton: false: no pause menu button over it. */
    noMenuButton?: boolean
  } | null
  /** Back to front: the last entry is the top window. */
  windows: OpenWindow[]
  /**
   * Title screen: 'boot' (boot screens, first start only), 'waiting' for any key, 'intro' (the
   * art plays its entrance), 'shown' (art only), 'menu' (titleMenu buttons), 'leaving' while it
   * fades out, or null.
   */
  title: 'boot' | 'waiting' | 'intro' | 'shown' | 'menu' | 'leaving' | null
  /** The boot screen on screen: which one, its step, and whether it is fading out (`fade` ms). */
  boot: { index: number; step: number; out: boolean; fade: number } | null
  /** True once the menu buttons have finished appearing: only then can they be used. */
  titleMenuIn: boolean
  /** Goes up each time the player skips the title entrance (the art jumps to its final look). */
  titleSkips: number
  /** Labels of the title menu while title === 'menu'. */
  titleMenu: string[] | null
  /** False while the title screen's pictures and sounds load (a dark cover shows meanwhile). */
  titleReady: boolean
  /** Last used input device (keyboard also covers mouse). */
  device: InputDevice
  /** Kind of the last used gamepad (for button prompts). */
  gamepad: GamepadKind
  /** A scene replayed from Extras: it shows (and takes input) above the title screen. */
  sceneReplay: boolean
}

export const useSystemStore = create<SystemState>()(
  immer(() => ({
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
  })),
)

/**
 * Screen layers, bottom to top: map → event → minigame → title → windows.
 * Only the top one reacts to game input. Windows sit above the title screen so menus like
 * Load and Settings can open from it.
 */
export type LayerName = 'map' | 'event' | 'minigame' | 'windows' | 'title'

export function topLayer(state: SystemState): LayerName {
  if (state.windows.length > 0) return 'windows'
  if (state.sceneReplay && state.event) return 'event'
  if (state.minigame?.overTitle) return 'minigame'
  if (state.title !== null) return 'title'
  if (state.minigame) return 'minigame'
  if (state.event) return 'event'
  return 'map'
}

/**
 * The title layer is playing something (boot screens, the entrance, the menu appearing): no
 * action reaches it; confirm (or a click / tap) skips what may be skipped.
 */
export function titleBusy(state: SystemState): boolean {
  if (state.title === 'boot' || state.title === 'intro') return true
  return (state.title === 'shown' || state.title === 'menu') && !state.titleMenuIn
}
