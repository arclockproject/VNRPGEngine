// Screen shape and the full-screen picture viewer. Edit freely: this is game content, not engine.
import { defineScreen } from '@/core/screen'

export default defineScreen({
  // Offered in Settings → General → Screen ratio. 'fill' = use the whole window, no bars.
  ratios: ['16:9', '16:10', '4:3', '21:9', 'fill'],
  defaultRatio: '16:9',
  // The bars around the game screen.
  barColor: '#000',
  // Settings → General → Hide idle mouse: seconds without mouse movement before the cursor hides.
  // 0 = never. Shown in this order. (A controller always hides it at once, whatever this is.)
  cursorAutoHide: [0, 10, 5],
  defaultCursorAutoHide: 0,
  // The game is made for wide screens. true = a phone held upright shows "turn your device" instead
  // (the Android app is locked to landscape as well: android/app/src/main/AndroidManifest.xml).
  landscapeOnly: true,
  // Game screens this tall (px) or less get the compact dialogue box (phones held sideways).
  shortHeight: 520,

  // The map view. It depends only on the screen ratio, so 720p, 1080p and 4K all show the same
  // part of the map at the same size.
  map: {
    // Tiles that fit the screen height. Bigger = see more, everything smaller. A map's `zoom` and
    // world.camera.zoom() multiply this.
    tilesHigh: 12,
    // Name labels, speech bubbles and the "press A" prompt have their normal size on a screen this
    // tall (px) and grow or shrink with it.
    textHeight: 720,
    // true = round the zoom to whole screen pixels per art pixel: every art pixel is the same size,
    // but how much map you see changes a little between resolutions.
    pixelPerfect: false,
  },

  // The small map in the corner while walking around. show: false = none at all; true = shown, and
  // players get a "Show minimap" switch in Settings to hide it. A map can switch it off for itself
  // with `minimap: false`. It is drawn by <Minimap /> in src/content/ui/Hud.tsx: move or remove it there.
  minimap: {
    show: true,
    size: 120, // longest side, px
    // Tiles shown around the player. 0 = always the whole map.
    radius: 12,
    colors: {
      ground: 'rgba(20, 28, 36, 0.78)',
      wall: 'rgba(170, 190, 205, 0.85)',
      player: '#ffd54a',
      door: '#5ad1ff',
      actor: '#ff8a65',
    },
    doors: true,
    actors: true,
    opacity: 0.9,
  },

  // Events (visual-novel scenes).
  stage: {
    // y / offsetX in show() and animate(), and shake strength, are pixels on a screen this tall.
    // On a bigger or smaller screen they grow or shrink with it, so scenes look the same everywhere.
    designHeight: 720,
    // Largest portrait: % of the screen height, and % of the screen width (whichever fits first).
    portraitHeight: 78,
    portraitWidth: 45,
    // Which part of a portrait fills that height, top to bottom (0..1): [0, 1] = the whole picture,
    // [0, 0.6] = head to waist with the legs below the screen (full-body art). A character's file
    // can set its own (`stage: { show: [0, 0.55] }`).
    show: [0, 1],
  },

  // Fades and waits, in ms.
  timings: {
    // Fade to black and back when the map changes.
    mapFade: 300,
    // A map that loads longer than this shows the loading screen.
    loadingDelay: 250,
    // Minigames (and battles) fading in and out.
    minigameFade: 250,
    // "Press any key": keys are ignored for this long after it appears.
    titleMinShow: 400,
    // The title screen fading away into the game.
    titleFade: 500,
    // Cross-fade between two title screens (the switch at the bottom left).
    titleSwitchFade: 600,
    // A title screen that loads longer than this shows a spinner.
    titleSpinnerDelay: 400,
    // Skipping a boot screen (logo): its fade-out is cut to this.
    bootSkipFade: 200,
  },

  // game.toast('…') messages at the top of the screen.
  toast: {
    ms: 2800,
    // More than this at once: the oldest go.
    max: 4,
  },

  // The screenshot key (F8 in src/content/config/input.ts) and game.screenshot().
  // Desktop: saved in the Pictures folder, in a folder named after the game. Phone: the share
  // sheet opens. Browser: it downloads.
  screenshot: {
    // Picture width in px (the height follows the screen ratio). 0 = the size on screen.
    width: 1920,
    format: 'png', // or 'jpeg'
    quality: 0.92, // jpeg only
    // File name: <prefix>_2026-11-12_18-30-05.png
    prefix: 'screenshot',
  },

  // When something in the game breaks (a crashed screen, an event script with a mistake).
  // It is always written to the console; while developing, a toast shows the real message.
  errors: {
    // true = players of the finished game get a short "Something went wrong" toast too.
    tellPlayer: true,
    toastMs: 6000,
    // At most one toast in this many ms (a broken loop can fail 60 times a second).
    toastEveryMs: 4000,
  },

  // Gallery pictures in Extras: pinch / scroll / hold A to zoom, hold B to zoom out.
  imageViewer: {
    maxZoom: 4,
    zoomPerSecond: 2.5,
    panSpeed: 900,
    doubleTapZoom: 2.5,
    // Two taps within this many ms = a double tap.
    doubleTapMs: 300,
    // A sideways swipe this long (px) shows the next / previous picture.
    swipePx: 60,
    background: '#000',
  },
})
