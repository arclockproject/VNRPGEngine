// Types for src/content/scenes.ts: how visual-novel scenes behave (voices, reading comfort, mask
// transitions, the music room, rumble). Must not import content (content imports this file).

/** A named font the player can pick in Settings → Text. */
export interface FontChoice {
  /** Shown in the list (translated). */
  name: string
  /** CSS font-family. Leave it out for the game's own font (src/content/look/text.ts). */
  family?: string
}

/**
 * How a mask transition spreads over the screen: 0 = changes first, 1 = changes last.
 * Either a greyscale picture (black first, white last; an image import), or a function of the
 * position (x and y from 0 to 1, left to right and top to bottom).
 */
export type TransitionRule = string | ((x: number, y: number) => number)

export interface MaskTransition {
  rule: TransitionRule
  /** Width of the soft edge, 0 (hard) to 1 (the whole picture dissolves together). Default 0.15. */
  softness?: number
  /** Start from the white parts instead. */
  reverse?: boolean
  /** Default length in ms when background() gives none. */
  duration?: number
}

/** A kind of thing Extras can count as found. */
/**
 * When the speaker's face shows next to the text: 'never'; 'always' (every line of a character
 * with a portrait); 'offstage' (only while the speaker is not on the stage: a voice on the
 * phone, the player character).
 */
export type SideImageShow = 'never' | 'always' | 'offstage'

export type CompletionPart = 'endings' | 'gallery' | 'movies' | 'music' | 'achievements'

export interface MusicTrack<Id extends string = string> {
  /** A sound id, e.g. 'music/town'. */
  id: Id
  /** Shown in Extras → Music (translated). */
  title: string
  artist?: string
}

/**
 * One step of a named move (move('anna', 'hop')). Values are RELATIVE to how the character stood
 * when the move began, so a move works wherever they are: end with a step of all zeros (or just a
 * duration) to come back.
 */
export interface MoveStep {
  /** Stage pixels sideways from where they stood (negative = left). */
  offsetX?: number
  /** Stage pixels down (negative = up). */
  y?: number
  /** × their size (1.05 = a little closer). */
  scale?: number
  /** Degrees added to their tilt. */
  rotate?: number
  /** 0..1 (absolute). */
  opacity?: number
  /** ms. Default 150. */
  duration?: number
  /** An easing name from the tween engine ('quadOut', 'bounceOut'…). Default 'quadInOut'. */
  ease?: string
}

/**
 * A named look for dialogue lines (a thought, a whisper, a shout): say('hero', '…', { style:
 * 'thought' }), `hero(thought): …` in a .vn file. What the line itself sets wins.
 */
export interface LineStylePreset {
  italic?: boolean
  size?: 'small' | 'normal' | 'large'
  /** Text colour. */
  color?: string
  shake?: boolean
  /** Typing speed multiplier. */
  speed?: number
  /** Continue by itself after this many ms. */
  autoAdvance?: number
  noAutoPause?: boolean
}

/** How near a character stands: show('anna', { distance: 'close' }). */
export interface StageDistance {
  /** 1 = as drawn. Grows from the feet. */
  scale: number
  /** Stage pixels down (negative = up). A close character usually sinks a little (positive). */
  y?: number
}

export interface StageConfig<Positions extends string = string, Distances extends string = string> {
  /**
   * Where characters stand, in % of the screen width (50 = the middle): show('anna', { at: 'left' }).
   * Add your own names. Without `at` a new character stands at `center`, or at the first one
   * when there is no `center`.
   */
  positions: Record<Positions, number>
  /** How near they stand: show('anna', { distance: 'close' }), `show anna distance close`. */
  distances: Record<Distances, StageDistance>
  /** How long a character takes to step to another distance, ms. */
  distanceMs: number
  /** How long a character takes to slide to another position, ms. */
  slideMs: number
  /** How long a new character takes to fade in, ms. */
  fadeInMs: number
  /** Characters who are not speaking while someone else is. */
  dim: {
    /** false = everyone stays as drawn. */
    on: boolean
    /** 1 = as drawn, 0 = black. */
    brightness: number
    /** ms. */
    fadeMs: number
  }
}

/**
 * A tint (scenes.ts `tints`, or filter({ color, strength })): `color` multiplied over the picture
 * (transparent edges stay transparent), then the CSS filter `css`, if any.
 */
export interface StageTint {
  /** A CSS colour (#rgb, #rrggbb or rgb()). White = no change. */
  color?: string
  /** 0..1: how much of the colour (1 = the full multiply). Default 1. */
  strength?: number
  /** Any CSS filter, applied after the colour: 'saturate(0.8)'. */
  css?: string
}

/** How an auto-hiding scene toolbar behaves (scenes.ts toolbar.autoHide). */
export interface ToolbarAutoHide {
  /** Height of the area at the bottom of the game screen (full width) that shows it, px. */
  zone: number
  /** Wait after the mouse leaves before it hides, ms. */
  delay: number
  /** How far it moves down while hiding, px (none with "Reduce motion"). */
  slide: number
  /** Length of the hide / show animation, ms. */
  ms: number
}

export interface ScenesConfig<
  Fonts extends string = string,
  Transitions extends string = string,
  Moves extends string = string,
  Positions extends string = string,
  Distances extends string = string,
  LineStyles extends string = string,
  Tints extends string = string,
> {
  /** Named looks for lines: say(who, text, { style: 'thought' }), `who(thought): text` in .vn. */
  lineStyles: Record<LineStyles, LineStylePreset>
  /** The stage: where characters stand, how near, and how the silent ones look. */
  stage: StageConfig<Positions, Distances>
  voice: {
    /** Music volume while a voice clip plays: 0.4 = 40% of its normal volume. 1 = unchanged. */
    duckMusic: number
    /** How fast the music goes down and comes back, in ms. */
    duckFadeMs: number
    /** New players: the "Lower music under voices" switch. */
    duckByDefault: boolean
    /** New players: a voice clip keeps playing after the player continues (until the next clip). */
    keepByDefault: boolean
    /**
     * The voice languages: folders in src/content/audio/voice (voice/ja/<event id>/anna_0012.ogg).
     * The first is the default: new players hear it whatever their text language is, and it stands
     * in for clips another language does not have. With more than one, Settings -> Audio lets the
     * player pick. The names need not be text languages.
     */
    languages: readonly [string, ...string[]]
    /**
     * Names for the voice languages in Settings -> Audio: { ja: 'Japanese' } (translated like other
     * text). Left out: the name of the text language with that code, else the code itself.
     */
    languageNames?: Record<string, string>
    /** How many digits a voice number has in file names: 4 = anna_0012. Scripts may write 12. */
    digits: number
    /** Mouths of layered portraits move with the voice clip (not with the typing) on voiced lines. */
    lipSync: {
      /** false = mouths flap while the text types, voiced or not. */
      on: boolean
      /** How loud the clip must be for an open mouth, 0..1 (0.04 suits normal speech). */
      threshold: number
      /** The mouth stays open at least this long, ms (stops flicker). */
      holdMs: number
      /** How often the clip's loudness is checked, ms. Default 40. */
      checkMs?: number
    }
    /**
     * Favourite voices: a star on every voiced line in the log; the starred lines are kept on this
     * device (not in a save) and play again from Extras → Voices. `max` = how many can be kept.
     */
    favourites: { on: boolean; max: number }
    /**
     * The system voice: short clips a character says for the menus (src/content/audio/system_voice/
     * <character>/<cue>.ogg). Optional.
     */
    system?: {
      /** New players: a character id, 'random' or 'off'. Default 'random'. */
      default?: string
      /** Quitting waits for the 'quit' clip, at most this long, ms. Default 2500. */
      quitWaitMs?: number
    }
  }
  text: {
    /**
     * The name tag of a line several characters say together (say(['jack', 'anna'], …)), from
     * their shown names: ['Jack', 'Anna'] -> 'Jack & Anna'. A line's `as` still wins.
     */
    groupName: (names: readonly string[]) => string
    /** Choices for Settings → Text size (1 = as designed). */
    sizes: readonly number[]
    defaultSize: number
    /** Choices for Settings → Font. The first one is the default. */
    fonts: Record<Fonts, FontChoice>
    /**
     * false = no Font row in Settings: everyone gets the first font (a font picked before is ignored).
     * Default true.
     */
    playerPicksFont?: boolean
    /** New players: how solid the chat box's background is, 0 (see-through) to 1 (as designed). */
    defaultBoxOpacity: number
    /** Lines kept in the log. */
    logLines: number
    /** Pause after sentence punctuation while a line types, ms. */
    autoPauseMs: number
  }
  skip: {
    /** New players: Skip turns itself back on after an answer is picked (Settings → Text). */
    afterChoiceByDefault: boolean
    /** How long the skip button over a movie stays after a tap or key, ms. Default 3000. */
    movieButtonMs?: number
  }
  /** The mouse wheel during a scene. */
  wheel: {
    /** Wheel up opens the log. */
    log: boolean
    /** Wheel down continues (like a click). */
    advance: boolean
    /** Wheel down at the end of the log closes it. */
    closeLog: boolean
    /** Smaller wheel movements are ignored (a touchpad at rest). Default 4. */
    min?: number
    /** At most one step per this many ms. Default 140. */
    gapMs?: number
    /** After the log closes the wheel waits this long, ms (the same flick must not reopen it). Default 350. */
    afterLogMs?: number
  }
  comfort: {
    /**
     * New players: "Reduce shaking and flashes". 'system' follows the device's own
     * "reduce motion" setting.
     */
    reduceMotionByDefault: boolean | 'system'
    /** With that setting on, flash() becomes a soft fade of this strength (0 = no flash at all). */
    reducedFlash: number
  }
  rumble: {
    /** shake() and startShake() also shake the controller (and buzz a phone). */
    onShake: boolean
    /** 0..1: how hard a shake of strength 10 rumbles. */
    strength: number
  }
  /** Crossfade of background() / cg() when no duration is given, ms. */
  backgroundFadeMs: number
  /** Edge softness of mask transitions that set none (0..1). */
  maskSoftness: number
  /** Named moves for characters on stage: move('anna', 'hop'), or `move anna hop` in a .vn file. */
  moves: Record<Moves, readonly MoveStep[]>
  /** The speaker's face next to the text. */
  sideImage: {
    /** New players' choice; the player changes it in Settings → Text (see SideImageShow). */
    showByDefault: SideImageShow
    /** Side of the square, as a share of the text box's height (inside its frame): 0.8 = 80%. */
    size: number
    /**
     * The smallest side in stage pixels (on a `stage.designHeight`-tall screen). A box shorter
     * than this still wins: the face is never taller than the text box.
     */
    minSize: number
    side: 'left' | 'right'
    /** Space between the face and the edge of the text box, px: [normal, short screens]. Default [12, 6]. */
    inset?: [number, number]
    /**
     * 'inside' (default): in the text box, on `side`. With textBox.layout 'center' the text moves
     * over while a face shows; with 'full' the face sits in the side's textSpace (the text stays).
     * 'outside': next to the box, on `side` (layout 'center' only; 'full' has no room beside it).
     * The box keeps the room free, so it doesn't move when a line has no face. The frame around
     * the face is the look part `sideImage` (src/content/look/parts.ts): no background or border
     * there = only the face shows.
     */
    place?: 'inside' | 'outside'
  }
  /** inset(): the framed picture in the middle of the screen. Its frame: the look part `inset`. */
  inset?: {
    /** Width, % of the screen. Default 62. */
    width?: number
    /** Its shape, a CSS aspect-ratio ('16 / 9'). Default '16 / 9'. */
    aspectRatio?: string
    /** Where its middle is, % from the top (50 = the screen's middle). Default 43 (clear of the chat box). */
    y?: number
    /** Fade in / out / between pictures, ms, when inset() names none. Default 300. */
    fadeMs?: number
    /**
     * Which is on top where they meet: 'underBox' (default) = the chat box covers the picture;
     * 'overBox' = the picture covers the chat box (choices still come over both).
     */
    layer?: 'underBox' | 'overBox'
  }
  /** Where the chat box sits and how wide it is (src/content/ui/TextDialog.tsx reads it). */
  textBox?: {
    /**
     * 'center' (default): a box in the middle of the screen's bottom.
     * 'full': the box spans the screen's whole width, the text in the middle with `textSpace` free
     * on both sides (the side image goes in its side's space).
     */
    layout: 'center' | 'full'
    /** 'center': the widest the box gets, px. Default 960. */
    maxWidth?: number
    /** 'center': screen left free on each side of the box, px: [normal, short screens]. Default [16, 4]. */
    margin?: [number, number]
    /** 'full': room on each side of the text, px: [normal, short screens]. Default [200, 110]. */
    textSpace?: [number, number]
  }
  /** Full-page text (nvl()): pages of lines over the scene instead of the box at the bottom. */
  nvl: {
    /** Page width in % of the screen. */
    width: number
    /** A new page starts by itself when the page holds this many lines (0 = only on clearPage()). */
    maxLines: number
  }
  choices: {
    /** Answers the player has picked before (in any playthrough) get the `choiceChosen` look. */
    markChosen: boolean
    /** Written before such an answer ('✓ '). '' = nothing. */
    chosenMark: string
  }
  /** The scene toolbar (Back, Auto, Skip…). Placed by TextDialog.tsx and Choice.tsx. */
  toolbar: {
    /**
     * Hide it until the mouse comes near the bottom of the screen (for a bar placed there), with a
     * Lock button and a Settings switch that keep it shown. null = always shown.
     */
    autoHide: ToolbarAutoHide | null
    /**
     * Where TextDialog.tsx and Choice.tsx put it: 'boxTop' (default) = on the box's top edge, at the
     * right; 'boxBottom' = inside the box along its bottom edge, at the right; 'screen' = the
     * screen's bottom right corner, under the box.
     */
    place?: 'boxTop' | 'boxBottom' | 'screen'
    /** "Skip back": pause between two steps back, ms. Default 250. */
    skipBackMs?: number
  }
  log: {
    /** The log offers "Jump back here" on lines of the running scene. */
    jumpBack: boolean
    /**
     * While a route plays: how many earlier scenes Back (and the log's "Jump back here") can still
     * go into. 0 = only the running scene.
     */
    backScenes: number
    /**
     * Back keeps the scene on screen while it goes back; only when that takes longer than this (ms,
     * a very long scene) does the replay cover (src/content/ui/Loading.tsx) show. Default 600.
     */
    backCoverMs?: number
  }
  /** The "found so far" percentage in Extras. */
  completion: {
    /** Shown at the top of Extras. */
    show: boolean
    /** What counts towards it. */
    count: readonly CompletionPart[]
  }
  /** Named mask transitions: background('…', { transition: 'wipeLeft' }). */
  transitions: Record<Transitions, MaskTransition>
  /**
   * Named tints: filter('evening', { on: 'characters' }), show('anna', { tint: 'night' }). A tint
   * with a preset's name (flashback, night, dream, blur) replaces that preset. Optional.
   */
  tints?: Record<Tints, StageTint>
  /**
   * A background variant that tints the characters by itself: { evening: 'evening' } = after
   * bg('classroom', 'evening') everyone on stage gets the tint 'evening' (until filter(…, { on:
   * 'characters' }) or their own tint says otherwise). Optional.
   */
  tintByBackground?: Partial<Record<string, NoInfer<Tints>>>
  musicRoom: {
    /** Tracks in Extras → Music, in this order. */
    tracks: readonly MusicTrack[]
    /** 'heard' = a track appears once it has played in the game; 'always' = all from the start. */
    unlock: 'heard' | 'always'
  }
}

export function defineScenes<
  const Fonts extends string,
  const Transitions extends string,
  const Moves extends string,
  const Positions extends string,
  const Distances extends string,
  const LineStyles extends string,
  const Tints extends string,
>(
  config: ScenesConfig<Fonts, Transitions, Moves, Positions, Distances, LineStyles, Tints>,
): ScenesConfig<Fonts, Transitions, Moves, Positions, Distances, LineStyles, Tints> {
  return config
}
