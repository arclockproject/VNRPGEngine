// Types for src/content/config/screen.ts (screen ratio, bar colour, image viewer). The code using them
// is in src/core/layers/screen.ts; this file must not import content (content imports it).

/** 'W:H', or 'fill' for the whole window. */
export type ScreenRatio = `${number}:${number}` | 'fill'

export interface ScreenConfig {
  /** Choices in Settings → Screen ratio, in this order. */
  ratios: readonly ScreenRatio[]
  /** Used by new players, and when a stored choice is no longer in `ratios`. */
  defaultRatio: ScreenRatio
  /** CSS colour of the bars around the game screen. */
  barColor: string
  /** Choices (seconds, 0 = never) for hiding the mouse cursor after it stops moving. */
  cursorAutoHide: readonly number[]
  /** Used by new players, and when a stored choice is no longer in `cursorAutoHide`. */
  defaultCursorAutoHide: number
  /** Phones held upright get a "turn your device" screen instead of the game. */
  landscapeOnly: boolean
  /** At this game-screen height (px) or less, layouts go compact (phones held sideways). */
  shortHeight: number
  /** The map view (sized by screen height, so the same ratio looks the same at any resolution). */
  map: {
    /** Tiles that fit the screen height at zoom 1. */
    tilesHigh: number
    /** Screen height (px) at which map labels, bubbles and prompts have their normal size. */
    textHeight: number
    /** Round the zoom to whole screen pixels per art pixel (even pixels, view size varies a bit). */
    pixelPerfect: boolean
  }
  /** The small map in the corner while walking around (<Minimap /> in src/content/ui/Hud.tsx). */
  minimap: {
    /** false = no minimap at all (and no Settings switch for it). true = shown; players can hide it in Settings. */
    show: boolean
    /** Longest side on screen, px. */
    size: number
    /** Tiles shown around the player. 0 = the whole map, however big. */
    radius: number
    /** CSS colours. */
    colors: {
      ground: string
      wall: string
      player: string
      door: string
      actor: string
    }
    /** Show doors / characters as dots. */
    doors: boolean
    actors: boolean
    /** 0..1 */
    opacity: number
  }
  /** The event stage: character portraits, show()/animate() offsets and shake(). */
  stage: {
    /**
     * show()/animate() `y` and `offsetX` and shake() strength are pixels on a screen this tall.
     * They grow and shrink with the real screen, so a scene looks the same at any size.
     */
    designHeight: number
    /** Tallest a portrait gets, in % of the screen height. */
    portraitHeight: number
    /** Widest a portrait gets, in % of the screen width (narrow screens shrink it to fit). */
    portraitWidth: number
    /**
     * Which part of a portrait picture fills `portraitHeight`, top to bottom (0 = the picture's top
     * edge, 1 = its bottom edge); that part's bottom stands on the screen's bottom edge. [0, 0.6] =
     * head to waist (the legs go below the screen); [0.2, 1] = neck down fills it and the head
     * sticks up above (off the screen when big enough). Only the screen's edges cut a picture.
     * A character's own `stage.show` wins. Default [0, 1]: the whole picture.
     */
    show?: [number, number]
  }
  /** Fades and waits, ms. */
  timings: {
    /** Fade to black (and back) on a map change. */
    mapFade: number
    /** The loading screen shows when a map takes longer than this. */
    loadingDelay: number
    /** Minigames fading in and out. */
    minigameFade: number
    /** "Press any key" ignores input for this long after it appears. */
    titleMinShow: number
    /** The title screen fading out into the game. */
    titleFade: number
    /** Cross-fade between title screen variants. */
    titleSwitchFade: number
    /** A spinner shows when a title screen takes longer than this to load. */
    titleSpinnerDelay: number
    /** A skipped boot screen fades out in at most this. */
    bootSkipFade: number
  }
  /** game.toast(). */
  toast: {
    /** How long a toast stays (unless it sets its own `ms`). */
    ms: number
    /** Most toasts on screen at once. */
    max: number
  }
  /** game.screenshot() and the screenshot action. */
  screenshot: {
    /** Width in px; 0 = as shown on screen. */
    width: number
    format: 'png' | 'jpeg'
    /** JPEG quality, 0..1. */
    quality: number
    /** Start of the file name. */
    prefix: string
  }
  /** What the player sees when something breaks (core/errors.ts). */
  errors: {
    /** Show a short toast in the finished game too (dev builds always show the real message). */
    tellPlayer: boolean
    /** How long that toast stays, ms. */
    toastMs: number
    /** At most one error toast in this many ms. */
    toastEveryMs: number
  }
  /** Full-screen picture viewer (Extras gallery). */
  imageViewer: {
    /** Largest zoom (e.g. 4 = 4×). */
    maxZoom: number
    /** Holding A / confirm: zoom multiplies by this every second (B zooms out as fast). */
    zoomPerSecond: number
    /** Pan speed with a full stick / held arrow, in screen pixels per second. */
    panSpeed: number
    /** Zoom after a double-click / double-tap. */
    doubleTapZoom: number
    /** Two taps within this many ms count as a double tap. */
    doubleTapMs: number
    /** Swipe length (px) that switches picture at zoom 1. */
    swipePx: number
    /** CSS background behind the picture. */
    background: string
  }
}

export function defineScreen(config: ScreenConfig): ScreenConfig {
  return config
}
