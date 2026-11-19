// Stacking order of the screen layers (see CLAUDE.md: map → event → minigame → window).
export const Z = {
  map: 0,
  hud: 5,
  /** Map fade / loading screen: covers map and HUD, events stay visible above it. */
  transition: 8,
  event: 10,
  /** The full-screen chapter card (src/content/chapters.ts announce: 'card'): over the scene. */
  chapterCard: 12,
  /** On-screen joystick/buttons (touch devices, over map and events). */
  touch: 15,
  minigame: 20,
  /** game.timers on screen: over events and minigames, under the title screen and windows. */
  timers: 21,
  /** Black cover while a mid-scene save replays up to the saved line. */
  cover: 22,
  /** Title screen covers the game; windows (load, settings) open above it. */
  title: 25,
  /** A scene replayed from Extras (over the title screen). */
  replay: 27,
  /** Windows use windows + 2 * stackIndex (+1 for the window above its modal backdrop). */
  windows: 30,
  /** Pause menu button (MenuButtonLayer): over windows so it can close the menu too. */
  menuButton: 700,
  /** Full-screen picture viewer (ImageViewer, e.g. Extras gallery): over windows. */
  viewer: 800,
  /** game.toast() messages: above everything but the dev panel. */
  toast: 900,
  dev: 1000,
} as const
