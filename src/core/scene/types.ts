// The visual-novel commands an event script gets (say, choice, show, ...).

import type scenes from '@/content/scenes'
import type { ChapterId } from '../managers/chapters'
import type {
  BackgroundId,
  BackgroundVariantOf,
  CharacterId,
  CharacterPartsOf,
  EndingId,
  GalleryId,
  GalleryVariantOf,
  InsetId,
  InsetVariantOf,
  MovieId,
  PoseOf,
  VoiceClipId,
  WeatherKind,
} from '../registry'
import type { StageTint } from '../scenes'
import type { TweenOptions } from '../tween'
import type { FILTERS } from './filters'

export type { TweenOptions }

// "Stage pixels" (y, offsetX, shake strength): pixels on a screen `stage.designHeight` tall
// (src/content/config/screen.ts, 720 by default). They scale with the real game screen, so y: -140 is the
// same share of the screen on a phone and on a 4K monitor.

/** What animate() can change on a portrait. Anything left out stays as it is. */
export interface ActorAnimation {
  /** A stage position or % of the screen width (50 = centre). */
  x?: StagePosition | number
  /** Extra horizontal stage pixels on top of `x` (negative = left). */
  offsetX?: number
  /** Stage pixels; negative moves up, positive moves down. */
  y?: number
  /** 1 = normal size. Grows/shrinks from the bottom centre (the feet). */
  scale?: number
  /**
   * Which part of the picture, top to bottom (0..1), fills their normal portrait height, its bottom
   * on the screen's bottom edge: [0.65, 1] = the legs only, [0, 0.35] = the face. Works out a
   * `scale` and `y` (given ones win), so animating it pans / zooms along the body:
   * animate('anna', { frame: [0, 0.35] }, { duration: 2500 }) after show('anna', { frame: [0.65, 1] }).
   */
  frame?: readonly [number, number]
  /** Degrees, clockwise. */
  rotate?: number
  /** 0 = invisible, 1 = fully visible. */
  opacity?: number
}

export interface CameraTarget {
  /** 1 = normal, 2 = twice as close. */
  zoom?: number
  /** Keep this in the middle: a shown character, or a point in % of the screen. */
  focus?: CharacterId | { x: number; y: number }
}

/** Where a character portrait stands. */
export type StagePosition = keyof typeof scenes.stage.positions

/** How near a character stands: a name from src/content/scenes.ts `stage.distances`. */
export type StageDistanceName = keyof typeof scenes.stage.distances

/** A tint from src/content/scenes.ts `tints` (a colour multiplied over the picture). */
export type TintName = keyof NonNullable<typeof scenes.tints>

/**
 * A preset name (see scene/filters.ts), a tint from src/content/scenes.ts `tints`, or your own:
 * { css: 'hue-rotate(90deg)' } (any CSS filter), { color: '#ffc49a', strength: 0.4 } (a tint), or both.
 */
export type SceneFilter = keyof typeof FILTERS | TintName | StageTint

/**
 * What filter() changes: 'all' (the whole stage and the map behind it: the default),
 * 'background' (background / CG only), 'characters' (every portrait) or one character.
 */
export type FilterTarget = 'all' | 'background' | 'characters' | CharacterId

/** A named line look from src/content/scenes.ts `lineStyles`. */
export type LineStyleName = keyof typeof scenes.lineStyles

export interface LineStyle {
  /** A named look from src/content/scenes.ts `lineStyles` ('thought'); the keys below win over it. */
  style?: LineStyleName
  italic?: boolean
  size?: 'small' | 'normal' | 'large'
  /** Text colour. Default: normal text colour. */
  color?: string
  /** Shakes the text (shouting, surprise). */
  shake?: boolean
  /** Typing speed multiplier: 2 = twice as fast, 0.5 = slow and dramatic. */
  speed?: number
  /** Continue by itself this many ms after the text is fully shown. */
  autoAdvance?: number
  /** Show a different name, e.g. '???' before the player knows who it is. */
  as?: string
  /**
   * The line's voice clip: its number (`voice: 12` plays
   * audio/voice/<language>/<event id>/<speaker>_0012.*; how many digits: src/content/scenes.ts
   * voice.digits), or a clip of another event by name ('town/arrival/anna_0012', no language).
   * No `voice` = no voice: the character's `blip` plays while the text types. Stops when the player
   * continues, unless they turned on "Voices play to the end". A clip that is not recorded yet
   * plays nothing (`pnpm story` lists those). Several voices at once (a line said together, or
   * someone else's voice under this line): { jack: 3, anna: 7 }, all starting together.
   */
  voice?: number | VoiceClipId | VoiceMap
  /** Turns off the short automatic pause after . ! ? while typing (on by default). */
  noAutoPause?: boolean
  /** The pose shown in the side image (the speaker's face next to the text) for this line. */
  face?: string
}

/** Every LineStyle key (also tells the values in a line's options apart from its style). */
export const LINE_STYLE_KEYS: Record<keyof LineStyle, true> = {
  style: true,
  italic: true,
  size: true,
  color: true,
  shake: true,
  speed: true,
  autoAdvance: true,
  as: true,
  voice: true,
  noAutoPause: true,
  face: true,
}

/** A value put into a line's text: say('jack', 'You have {count} apples.', { count: 5 }). */
export type LineValue = string | number

type MarkupTag = 'b' | 'i' | 'color' | 'size' | 'shake' | 'wave' | 'w' | 'ruby'
type NotAName = '' | `${string}${' ' | '{' | '=' | '/' | '#'}${string}`

/** The {name} holes in a line's text. Markup tags like {b} or {wave} are not holes. */
export type LineHoles<S extends string> = S extends `${string}{${infer N}}${infer Rest}`
  ? (N extends NotAName | MarkupTag ? never : N) | LineHoles<Rest>
  : never

/** A line's options: its style, plus one value per {name} in the text. */
export type LineOptions<S extends string> = string extends S
  ? LineStyle & Record<string, unknown>
  : LineStyle & {
      [K in LineHoles<S>]: K extends keyof LineStyle
        ? `rename {${K}}: "${K}" is a line style option`
        : LineValue
    }

/**
 * Several voices on one line, by speaker (the name in their files: a character id, or "Student A"
 * as student_a): { jack: 3, anna: 'town/arrival/anna_0012' }. They start together.
 */
export type VoiceMap = Partial<Record<CharacterId, number | VoiceClipId>> & {
  readonly [speaker: string]: number | VoiceClipId | undefined
}

/** The options are required when the text has {name} holes to fill. */
export type LineArgs<S extends string> = [LineHoles<S>] extends [never]
  ? [options?: LineOptions<S>]
  : [options: LineOptions<S>]

/**
 * Who speaks: a character id, or 'id:pose' to change their pose (and show them) as they speak,
 * e.g. say('anna:happy', 'Hi!'). Poses are typed.
 */
export type Speaker = { [K in CharacterId]: K | `${K}:${PoseOf<K>}` }[CharacterId]

/** A choice: its text, or text plus conditions. */
export type ChoiceOption =
  | string
  | {
      label: string
      /** Not shown at all (e.g. the player doesn't know about it yet). */
      hidden?: boolean
      /** Shown greyed out; a text explains why ("Needs 50 gold"). */
      disabled?: boolean | string
    }

export interface ChoiceSettings<K> {
  /** Milliseconds to choose; then `default` (or the first option that can be picked) is chosen. */
  timeout?: number
  default?: K
}

/** For layered portraits: pick single parts, e.g. { mouth: 'frown' } (null hides a layer). */
export type PartOverrides<Parts> = [Parts] extends [never]
  ? never
  : { [K in keyof Parts]?: Parts[K] | null }

/** A mask transition from src/content/scenes.ts (`transitions`). */
export type TransitionName = keyof typeof scenes.transitions

/** A named move from src/content/scenes.ts `moves`. */
export type MoveName = keyof typeof scenes.moves

/** A free picture on the stage (image()). */
export interface ImageOptions {
  /** Centre, in % of the screen width. Default 50. */
  x?: number
  /** Centre, in % of the screen height. Default 50. */
  y?: number
  /** Width in % of the screen width (the height follows the picture). Default: `height` or 40. */
  width?: number
  /** Height in % of the screen height, instead of `width`. */
  height?: number
  /** 0..1. Default 1. */
  opacity?: number
  /** Default 1. */
  scale?: number
  /** Degrees. */
  rotate?: number
  /**
   * 'back' = behind the characters, 'front' = in front of them (default), 'top' = over the text
   * box too (a letter held up to the screen).
   */
  layer?: 'back' | 'front' | 'top'
  /** Draw pixel art with hard edges. */
  pixelated?: boolean
  /** How long it takes to appear, move there, or go, in ms. Default 300. */
  duration?: number
}

export interface BackgroundOptions {
  /** Length in ms. Default 400 for a crossfade, or the transition's own `duration`. */
  duration?: number
  /**
   * How the new picture comes in. Default: a crossfade. A name from src/content/scenes.ts wipes or
   * dissolves it in by a mask (pictures and colours only; a video or gradient crossfades).
   */
  transition?: TransitionName
}

/**
 * What cg() takes after the id: a CG with variants must name one (the plain picture only exists as
 * a variant of its own, `base: {}`); a picture without variants, or null, takes none.
 */
export type CgArgs<K extends GalleryId | null> = K extends GalleryId
  ? [GalleryVariantOf<K>] extends [never]
    ? [variant?: undefined, options?: BackgroundOptions]
    : [variant: GalleryVariantOf<K>, options?: BackgroundOptions]
  : [variant?: undefined, options?: BackgroundOptions]

/**
 * What bg() takes after the id: a background with variants (its index.ts) must name one, like a
 * layered CG; a plain picture takes none (null keeps the place for the options).
 */
export type BgArgs<K extends BackgroundId> = [BackgroundVariantOf<K>] extends [never]
  ? [variant?: null, options?: BackgroundOptions]
  : [variant: BackgroundVariantOf<K>, options?: BackgroundOptions]

/** inset(): how the framed picture comes, changes and goes. */
export interface InsetOptions {
  /** Fade length in ms (in, out, and from one picture to the next). Default: scenes.ts inset.fadeMs. */
  duration?: number
}

/**
 * What inset() takes after the id: an inset with variants (its index.ts) must name one, like bg();
 * a plain picture takes none (null keeps the place for the options); inset(null) takes it away.
 */
export type InsetArgs<K extends InsetId | null> = K extends InsetId
  ? [InsetVariantOf<K>] extends [never]
    ? [variant?: null, options?: InsetOptions]
    : [variant: InsetVariantOf<K>, options?: InsetOptions]
  : [variant?: null, options?: InsetOptions]

export interface MovieOptions {
  /** The player can end it with confirm, a click or a tap. Default true. */
  skippable?: boolean
  /** 'contain' (default) shows the whole picture with bars; 'cover' fills the screen. */
  fit?: 'contain' | 'cover'
  /** 0..1 on top of the music volume slider. Default 1. */
  volume?: number
  /** true = the game's music plays on under the movie. Default: it fades out for the movie. */
  keepMusic?: boolean
  /** CSS colour behind the picture. Default black. */
  background?: string
}

export interface MoviePlayOptions extends MovieOptions {
  /** A movie from src/content/movies unlocks in Extras → Movies when it plays. Default true. */
  unlock?: boolean
}

export interface InputOptions {
  /** What the field starts with; also used when the player leaves it empty. */
  default?: string
  /** Most characters allowed. Default 16. */
  maxLength?: number
  /** Grey hint text in the empty field. */
  placeholder?: string
  /** The window's title. Default: none. */
  title?: string
}

export interface ShowOptions<Pose extends string, Parts = never> {
  /**
   * A pose from `portraits`, or an expression of a layered portrait. Default: the first one.
   * A new pose replaces the parts its expression sets; other part changes (e.g. an outfit) stay.
   */
  pose?: Pose
  /** Layered portraits only: change single parts on top of the expression. */
  parts?: PartOverrides<Parts>
  /** Default 'center', or where they already stand. */
  at?: StagePosition
  /** Mirror the portrait. */
  flip?: boolean
  /**
   * How near they stand, a name from src/content/scenes.ts `stage.distances` ('far', 'close'…).
   * Someone already on stage steps there; `scale` / `y` given here win over it.
   */
  distance?: StageDistanceName
  /**
   * Size right away (1 = normal), scaled from the feet. Small + higher up (negative `y`) reads as
   * far away; then animate() them closer: animate('jack', { scale: 1, y: 0 }, { duration: 2000 }).
   */
  scale?: number
  /** Horizontal stage pixels from `at`, right away (negative = left): at "center" + offsetX -100 = a bit left. */
  offsetX?: number
  /** Vertical stage pixels right away (negative = up, positive = down; up reads as further away). */
  y?: number
  /**
   * Right away, which part of the picture fills their normal portrait height (see animate()'s
   * `frame`): [0.65, 1] = the legs only. Wins over `distance`; `scale` / `y` given here win over it.
   */
  frame?: readonly [number, number]
  /**
   * A filter or tint on this character only (a name from src/content/scenes.ts `tints`, a preset,
   * or { color, strength, css }); null = none, even when the characters or the background have one.
   */
  tint?: SceneFilter | null
}

export interface SceneApi {
  /**
   * Shows a line from a character and waits until the player continues. {name} in the text is
   * filled from the options: say('jack', 'You got {count} apples!', { count: 5, speed: 2 }).
   * Several characters saying it together: say(['jack', 'anna'], 'Bye!', { voice: { jack: 3,
   * anna: 7 } }) (name tag "Jack & Anna", the plain chat box).
   */
  say<S extends string>(
    who: Speaker | readonly Speaker[],
    text: S,
    ...options: LineArgs<S>
  ): Promise<void>
  /** A line without a speaker. Takes {name} values like say(). */
  narrate<S extends string>(text: S, ...options: LineArgs<S>): Promise<void>
  /**
   * Shows options and resolves with the chosen index… Options can be text or
   * { label, hidden, disabled: 'reason' }; settings: { timeout: ms, default: index }.
   */
  choice<const T extends readonly ChoiceOption[]>(
    options: T,
    settings?: ChoiceSettings<number>,
  ): Promise<number>
  /** …or, given { key: label }, with the chosen key. */
  choice<const T extends Record<string, ChoiceOption>>(
    options: T,
    settings?: ChoiceSettings<keyof T & string>,
  ): Promise<keyof T & string>
  /** Puts a character portrait on stage, or changes its pose/position if already shown. */
  show<K extends CharacterId>(who: K, options?: ShowOptions<PoseOf<K>, CharacterPartsOf<K>>): void
  /** Removes one character, or everyone when called without an argument. */
  hide(who?: CharacterId): void
  /** A colour ('#203040') or image URL behind the characters; null shows the map again. */
  /**
   * Changes the background; it crossfades (400 ms default). `duration: 0` changes at once.
   * A video file (mp4, webm) plays in a loop without sound. `transition: 'wipeLeft'` brings it in
   * by a mask (names: src/content/scenes.ts).
   */
  background(colorOrImage: string | null, options?: BackgroundOptions): void
  /**
   * Shows a background from src/content/backgrounds by its id (typed): bg('street') for a plain
   * picture, bg('town/bus_stop', 'evening') for a variant of a layered one (its folder's index.ts,
   * like a CG). Takes the options of background(): bg('street', null, { transition: 'wipeLeft' }).
   */
  bg<K extends BackgroundId>(id: K, ...rest: BgArgs<K>): void
  /** Changes the name shown for a character from now on, e.g. '???' → 'God' → 'Evil God'. */
  rename(who: CharacterId, name: string): void
  /** Shows the character's real name from now on (game.characters.reveal). */
  reveal(who: CharacterId): void
  /**
   * Shows a gallery picture (src/content/gallery/<id>) as the background and unlocks it. A layered
   * CG with variants must name one: cg('pond_memory', 'base'). null removes it.
   */
  cg<K extends GalleryId | null>(id: K, ...rest: CgArgs<K>): void
  /**
   * A framed picture in the middle of the screen, over the background and the characters (src/content/
   * insets, typed; made like backgrounds): bg('shrine', 'night') then inset('sneaking', 'red_girl').
   * Another inset() crossfades to it; inset(null) fades it away. Its size and frame: scenes.ts `inset`
   * and the look part `inset`.
   */
  inset<K extends InsetId | null>(id: K, ...rest: InsetArgs<K>): void
  /** Tints/blurs everything behind the dialogue (map included); null removes it. */
  /**
   * A filter or tint over the stage, or null to remove it. { on: 'characters' } / 'background' /
   * a character id changes only that part (a character's own one wins over 'characters').
   */
  filter(filter: SceneFilter | null, options?: { on?: FilterTarget }): void
  /**
   * Plays a video over the whole scene (an opening movie, an animated cutscene) and resolves when
   * it ends or the player skips it. `await movie('intro')` plays src/content/movies/intro and
   * unlocks it in Extras → Movies (`{ unlock: false }`: it does not). A file works too:
   * `await movie(clip)` with `import clip from './op.mp4'` (never in Extras).
   */
  movie(src: MovieId | (string & {}), options?: MoviePlayOptions): Promise<void>
  /**
   * Asks the player to type something (a name) and resolves with it, never empty:
   * `const name = await input('Your name?', { default: 'Alex' })`. Works with a keyboard, a touch
   * screen and a controller (on-screen keys). Saved with mid-scene saves like a choice.
   */
  input(prompt: string, options?: InputOptions): Promise<string>
  /**
   * A free picture on the stage: an item close-up, a letter, a map. `name` is yours; calling it
   * again with the same name moves / changes that picture, `null` takes it away.
   * `image('letter', letterPng, { y: 40, width: 30 })` … `image('letter', null)`.
   * Resolves when it has finished appearing, moving or going.
   */
  image(name: string, src: string | null, options?: ImageOptions): Promise<void>
  /** Takes every image() picture away. */
  clearImages(duration?: number): Promise<void>
  /** Rain, snow, petals… over the scene (src/content/weather.ts). null stops it. */
  weather(kind: WeatherKind | null, options?: { intensity?: number }): void
  /** A named move from src/content/scenes.ts: move('anna', 'hop'). */
  move(who: CharacterId, move: MoveName): Promise<void>
  /**
   * Full-page text: lines pile up on a page over the scene instead of showing one at a time in
   * the box at the bottom. nvl(false) goes back to the box.
   */
  nvl(on?: boolean): void
  /** Full-page text: starts a new, empty page. */
  clearPage(): void
  /**
   * The story has ended this way (src/content/endings/<id>): listed in Extras → Endings from now
   * on, in every save. It does not stop the event or leave the game: do that yourself, e.g.
   * `await game.windows.open('credits')` then `game.session.leave()`.
   */
  ending(id: EndingId): void
  /**
   * A chapter begins (game.chapters.reach) and is announced (src/content/chapters.ts). With a
   * 'screen' card, await it: it resolves once the card covers the stage, so the stage changes after
   * it are hidden and happen at once; the card leaves when the new pictures have loaded.
   */
  chapter(id: ChapterId): Promise<void>

  // ---- effects (all return a promise: await it to wait, or don't to run alongside the next line)

  /**
   * Animates a shown character's portrait:
   * `await animate('anna', { x: 'left', rotate: -10, scale: 1.2 }, { duration: 600, ease: 'backOut' })`
   */
  animate(who: CharacterId, to: ActorAnimation, options?: TweenOptions): Promise<void>
  /**
   * Zooms/pans the scene and the map behind it: `await camera({ zoom: 1.6, focus: 'anna' })`.
   * Back to normal: `camera({ zoom: 1, focus: { x: 50, y: 50 } })`. Resets when the event ends.
   */
  camera(to: CameraTarget, options?: TweenOptions): Promise<void>
  /** Shakes the screen. Default strength 10 (stage pixels), duration 400 ms. */
  shake(options?: { strength?: number; duration?: number }): Promise<void>
  /**
   * Starts a shake that goes on until stopShake(), e.g. an earthquake while lines are spoken:
   * `startShake(6)`, `await say(...)`, `await stopShake()`. Calling it again changes the strength.
   */
  startShake(strength?: number): void
  /** Eases a startShake() out over `duration` ms (default 300). Awaitable. */
  stopShake(duration?: number): Promise<void>
  /** A quick full-screen flash (default white, 250 ms): hits, lightning, camera flashes. */
  flash(color?: string, duration?: number): Promise<void>
  /** Fades to a colour and stays there; fade(null) fades back. Default 500 ms. */
  fade(color: string | null, duration?: number): Promise<void>
}
