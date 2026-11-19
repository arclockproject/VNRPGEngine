// How visual-novel scenes behave: voices, reading comfort, mask transitions, the music room and
// controller rumble. Edit freely: this is game content, not engine.
import type { AudioId } from '@/core/registry'
import { defineScenes, type MusicTrack } from '@/core/scenes'
import swirl from './assets/transitions/swirl.png'

export default defineScenes({
  // Named looks for lines. In a .vn file: `hero(thought): I wonder...`; in code:
  // say('hero', 'I wonder...', { style: 'thought' }). Keys: italic, size ('small' | 'normal' |
  // 'large'), color, shake, speed (2 = twice as fast), autoAdvance (ms), noAutoPause.
  lineStyles: {
    thought: { italic: true },
    whisper: { size: 'small', speed: 0.7 },
    shout: { size: 'large', shake: true },
  },

  stage: {
    // Where characters stand, in % of the screen width: show('anna', { at: 'left' }),
    // `show anna at left` in a .vn file. Add your own names (e.g. midleft: 37).
    positions: { farleft: 10, left: 25, center: 50, right: 75, farright: 90 },
    // How near they stand: show('anna', { distance: 'close' }), `show anna distance close`.
    // scale: 1 = as drawn; y: pixels down on a 720-tall screen (negative = up).
    distances: {
      far: { scale: 0.75, y: -40 },
      normal: { scale: 1, y: 0 },
      close: { scale: 1.3, y: 110 },
      face: { scale: 1.9, y: 420 },
    },
    distanceMs: 300, // stepping nearer / further
    slideMs: 350, // sliding to another position
    fadeInMs: 300, // a new character appearing
    // Characters who are not speaking go darker while someone else speaks.
    dim: { on: true, brightness: 0.55, fadeMs: 200 },
  },

  voice: {
    // Music volume while a voice clip plays (0.4 = 40%). The player can switch this off.
    duckMusic: 0.4,
    duckFadeMs: 250,
    duckByDefault: true,
    // false = a voice clip stops when the player continues; true = it plays to its end.
    keepByDefault: false,
    // A line plays a voice when it has a voice number: say('anna', 'Hi!', { voice: 12 }), or
    // `anna(12): Hi!` in a .vn file. Its file: audio/voice/<language>/<event id>/anna_0012.ogg.
    // No number = no voice (the character's blip plays). `pnpm story --voice --number` numbers the
    // lines that have none.
    // The voice languages = the folders in audio/voice. The first is the default: every new player
    // hears it (whatever their text language). A clip missing in the player's language plays from
    // the first language here that has it. With more than one, the player picks in Settings -> Audio.
    // (The demo has no audio/voice/ja folder yet: Japanese plays the English clips.)
    languages: ['en', 'ja'],
    // How each is called in Settings -> Audio (left out: the text language's name, or the code).
    languageNames: { en: 'English', ja: 'Japanese' },
    // Digits of a voice number in file names: 4 = anna_0012 (scripts may write 12 or 0012).
    digits: 4,
    // On lines with a voice clip, mouths move with the clip (open while it is loud enough) and stop
    // when it ends. Lines without a clip flap while the text types, as before.
    lipSync: {
      on: true,
      threshold: 0.04, // 0..1: how loud the clip must be for an open mouth
      holdMs: 90, // the mouth stays open at least this long
      checkMs: 40, // how often the loudness is checked, ms
    },
    // Favourite voices: a star (☆) on voiced lines in the log; Extras → Voices plays them again.
    // Kept on this device, across saves. max = how many a player can keep.
    favourites: { on: true, max: 200 },
  },

  text: {
    // The name tag of a line several characters say together: say(['jack', 'anna'], 'Bye!').
    groupName: (names) =>
      names.length < 3 ? names.join(' & ') : `${names.slice(0, -1).join(', ')} & ${names.at(-1)}`,
    // Settings → Text → Text size.
    sizes: [0.85, 1, 1.15, 1.3, 1.5],
    defaultSize: 1,
    // Settings → Text → Font. The first is the default. Fonts in src/content/fonts are added after
    // these by themselves; `family` here can also use their ids.
    fonts: {
      game: { name: 'Game font' },
      sans: { name: 'Plain (easy to read)', family: 'Verdana, "DejaVu Sans", Arial, sans-serif' },
      serif: { name: 'Book', family: 'Georgia, "DejaVu Serif", "Times New Roman", serif' },
      mono: { name: 'Typewriter', family: '"Courier New", "DejaVu Sans Mono", monospace' },
    },
    // false = no Font row in Settings: everyone gets the first font above.
    playerPicksFont: true,
    // 1 = the chat box as drawn in look/; lower lets the scene show through it.
    defaultBoxOpacity: 1,
    logLines: 200,
    // The short breath after . ! ? … while a line types (ms). 0 = none.
    autoPauseMs: 300,
  },

  skip: {
    // New players: Skip turns itself back on after an answer is picked. The player changes it in
    // Settings → Text ("Keep skipping after a choice").
    afterChoiceByDefault: false,
    // How long the skip button over a movie stays after a tap or key (ms).
    movieButtonMs: 3000,
  },

  // The mouse wheel during a scene.
  wheel: {
    log: true, // up opens the log
    advance: true, // down continues, like a click
    closeLog: true, // down at the end of the log closes it
    min: 4, // smaller movements are ignored (a touchpad at rest)
    gapMs: 140, // at most one step per this many ms
    afterLogMs: 350, // pause after the log closes
  },

  comfort: {
    // 'system' = on when the device asks for less motion.
    reduceMotionByDefault: 'system',
    // With "Reduce shaking and flashes" on, a flash is a soft fade this strong (0 = none).
    reducedFlash: 0.25,
  },

  rumble: {
    onShake: true,
    strength: 0.6,
  },

  // Named moves: move('anna', 'hop') in an event, `move anna hop` in a .vn file. Each step is
  // relative to where the character stood; a step with only a duration returns them there.
  // y: negative = up. duration in ms (default 150).
  moves: {
    hop: [
      { y: -28, duration: 110, ease: 'quadOut' },
      { duration: 140, ease: 'quadIn' },
    ],
    nod: [{ y: 12, duration: 120 }, { duration: 140 }],
    shakeHead: [
      { offsetX: -14, duration: 90 },
      { offsetX: 14, duration: 120 },
      { offsetX: -10, duration: 110 },
      { duration: 100 },
    ],
    startle: [
      { y: -16, scale: 1.04, duration: 70, ease: 'quadOut' },
      { duration: 220, ease: 'bounceOut' },
    ],
    lean: [{ scale: 1.08, y: 10, duration: 260, ease: 'quadOut' }],
    leanBack: [{ scale: 1 / 1.08, y: -10, duration: 260, ease: 'quadOut' }],
    tremble: [
      { offsetX: -4, duration: 45 },
      { offsetX: 4, duration: 45 },
      { offsetX: -4, duration: 45 },
      { offsetX: 4, duration: 45 },
      { duration: 45 },
    ],
    sink: [{ y: 40, opacity: 0.6, duration: 500, ease: 'quadIn' }],
  },

  // The speaker's face next to the text, cut from their portrait with their face box (the
  // "#face" layer in the .aseprite file, or faceArea in the character's file).
  sideImage: {
    // New players: 'never', 'always', or 'offstage' = only while the speaker is not on the
    // stage. The player changes it in Settings → Text.
    showByDefault: 'offstage',
    // A square as tall as this part of the text box (0.8 = 80% of its height)...
    size: 0.8,
    // ...but at least this tall, in pixels on a 720-tall screen (never taller than the box).
    minSize: 150,
    side: 'left',
    inset: [12, 6], // space to the box's edge, px: normal, short screens
    // 'inside' = in the text box; 'outside' = next to it (textBox layout 'center' only). Its frame:
    // look/parts.ts `sideImage` (take out its background and border to show only the face).
    place: 'inside',
  },

  // inset('sneaking', 'red_girl'): a framed picture (src/content/insets) in the middle of the screen,
  // over the background and the characters. Its frame and shadow: look/parts.ts `inset`.
  inset: {
    width: 62, // % of the screen
    aspectRatio: '16 / 9',
    y: 43, // where its middle is, % from the top (a bit high: the chat box is below)
    fadeMs: 300,
    // Where they meet: 'underBox' = the chat box is over the picture, 'overBox' = the picture is
    // over the chat box (choices come over both).
    layer: 'underBox',
  },

  // The chat box (laid out by src/content/ui/TextDialog.tsx).
  textBox: {
    // 'center': a box in the middle of the bottom, `margin` px of screen free left and right, at
    // most `maxWidth` wide; the side image pushes the text over while it shows.
    // 'full': the box spans the whole bottom; the text keeps `textSpace` px free on each side, and
    // the side image sits in that space (the text never moves).
    layout: 'center',
    maxWidth: 960,
    margin: [16, 4], // px: normal, short screens (phones held sideways)
    textSpace: [200, 110], // px: normal, short screens
  },

  // Full-page text: nvl() in an event, `nvl on` in a .vn file.
  nvl: {
    width: 76, // % of the screen
    maxLines: 0, // start a new page by itself after this many lines (0 = only on clearPage())
  },

  choices: {
    // Answers picked before (in any playthrough) look different: look/parts.ts `choiceChosen`.
    markChosen: true,
    chosenMark: '✓ ',
  },

  // The scene toolbar (Back, Auto, Skip…). Where it sits: src/content/ui/TextDialog.tsx and Choice.tsx;
  // its buttons: src/content/ui/SceneToolbar.tsx.
  toolbar: {
    // For a bar at the bottom of the screen: hidden until the mouse is within `zone` px of the
    // screen's bottom edge (full width) or over the bar; `delay` ms after it leaves it hides
    // (slides down `slide` px and fades, `ms` long). Adds a Lock button and a Settings switch that
    // keep it shown. Touch screens always show it. null = always shown.
    autoHide: null,
    // autoHide: { zone: 50, delay: 400, slide: 24, ms: 200 },
    // 'boxTop' = on the box's top edge (right), 'boxBottom' = inside the box along its bottom (right),
    // 'screen' = the screen's bottom right corner, under the box.
    place: 'boxBottom',
    // "Skip back": ms between two steps back.
    skipBackMs: 250,
  },

  log: {
    // "Jump back here" on the log's lines of the running scene.
    jumpBack: true,
    // Visual novel routes: how many earlier scenes Back (and "Jump back here") can go into.
    // Back on a scene's first line goes to the last line of the scene before (or its choice).
    backScenes: 10,
    // Back keeps the scene on screen while it goes back. If that takes longer than this (ms; a very
    // long scene), the replay cover (src/content/ui/Loading.tsx ReplayCover) shows meanwhile.
    backCoverMs: 600,
  },

  // "Found 42%" at the top of Extras: what counts towards it.
  completion: {
    show: true,
    count: ['endings', 'gallery', 'movies', 'music', 'achievements'],
  },

  // background() and cg() without their own `duration`: crossfade in ms.
  backgroundFadeMs: 400,
  // How soft the edge of a mask transition is when it doesn't say (0 = hard, 1 = very soft).
  maskSoftness: 0.15,

  // Mask transitions for background() and cg(): { transition: 'wipeLeft', duration: 800 }.
  // `rule` says where the new picture shows first (0) and last (1): a function of the position
  // (x, y from 0 to 1), or a greyscale picture you import (black first, white last).
  transitions: {
    wipeLeft: { rule: (x) => 1 - x },
    wipeRight: { rule: (x) => x },
    wipeUp: { rule: (_x, y) => 1 - y },
    wipeDown: { rule: (_x, y) => y },
    // A circle opening from the middle / closing onto it.
    irisOut: { rule: (x, y) => Math.hypot(x - 0.5, y - 0.5) / 0.71 },
    irisIn: { rule: (x, y) => 1 - Math.hypot(x - 0.5, y - 0.5) / 0.71 },
    // Like a clock hand sweeping round.
    clock: {
      rule: (x, y) => (Math.atan2(x - 0.5, 0.5 - y) / (2 * Math.PI) + 1) % 1,
      softness: 0.05,
    },
    blinds: { rule: (x) => (x * 8) % 1, softness: 0.3 },
    diagonal: { rule: (x, y) => (x + y) / 2 },
    // Random dots.
    pixels: { rule: () => Math.random(), softness: 0.05 },
    // From a picture: black parts change first, white parts last.
    swirl: { rule: swirl, softness: 0.2 },
  },

  // Tints: a colour multiplied over the picture (white = no change; transparent edges stay
  // transparent), then an optional CSS filter. filter('evening', { on: 'characters' }),
  // show('anna', { tint: 'night' }), `filter evening on characters` / `show anna tint night` in .vn.
  // A tint named like a preset (flashback, night, dream, blur) replaces that preset.
  tints: {
    evening: { color: '#ffc49a', strength: 0.5 },
    night: { color: '#7d8cd0', strength: 0.6, css: 'saturate(0.8)' },
    sunset: { color: '#ff9f80', strength: 0.4 },
  },
  // A background variant that tints the characters by itself: bg('classroom', 'evening') -> 'evening'.
  tintByBackground: { evening: 'evening', night: 'night' },

  // Extras → Music.
  musicRoom: {
    tracks: [
      { id: 'music/town', title: 'Town' },
      { id: 'music/forest', title: 'Forest' },
    ] satisfies MusicTrack<AudioId>[],
    unlock: 'heard',
  },
})
