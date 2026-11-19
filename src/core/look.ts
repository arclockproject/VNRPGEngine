// Types and helpers for the game's look (src/content/look/).
// This file must not import content: src/content/look/ imports it.
import type { ThemeOptions } from '@mui/material/styles'
import type { CSSProperties } from 'react'
import type { AudioId } from './registry'

/**
 * One styled box: a background, and optionally a 9-slice frame image. The frame's corners keep
 * their size, its sides stretch or tile, and its middle fills the inside, so it fits any size.
 */
export interface LookBox {
  /** Any CSS `background`: a colour, a gradient, or `url(...)` for an image. Drawn under the frame. */
  background?: string
  /** Text colour. */
  color?: string
  /** A 9-slice frame image (URL, e.g. imported from a .png). */
  image?: string
  /** Pixels of `image` that are frame, from each edge: one number, or [top, right, bottom, left]. Default 16. */
  slice?: number | [number, number, number, number]
  /** Draw the frame this many times bigger (pixel art cut at 8px, drawn at 3 = 24px). Default 1. */
  scale?: number
  /** How the sides and middle fill the space: 'stretch' (default), 'round' (tile, whole repeats), 'repeat', 'space'. */
  sides?: 'stretch' | 'round' | 'repeat' | 'space'
  /** Sharp pixels when scaled (for pixel art). */
  pixelated?: boolean
  /**
   * Plain CSS for this box, e.g. `{ borderRadius: 8, padding: '4px 12px' }`. Applied last, so it
   * wins over everything above (also over what a frame `image` sets, like its square corners).
   * In a state (`focus`, `pressed`...) it is added to the normal look's `css`.
   */
  css?: CSSProperties
}

/**
 * A box that reacts to the player. A state without its own frame `image` keeps the frame with a small effect:
 * focus brighter, pressed darker, disabled grey. Focus also shows on mouse hover.
 */
export interface LookPart extends LookBox {
  /** Picked with keyboard / gamepad, or under the mouse. */
  focus?: LookBox
  /** Held down. */
  pressed?: LookBox
  disabled?: LookBox
  /** The current choice (tabs, menu items). */
  selected?: LookBox
}

/** Native scrollbars everywhere (windows, lists). Unset parts keep the dark browser default. */
export interface LookScrollbar {
  /** Colour of the part you drag. */
  thumb?: string
  /** Colour behind it. */
  track?: string
  /** Default "auto". */
  width?: 'auto' | 'thin' | 'none'
}

/**
 * Empty space kept around a window, so the game shows at its edges. It grows with the game
 * screen's shorter side: `min` at `smallScreen` px or less, `max` at `largeScreen` px or more.
 */
export interface LookWindowGap {
  /** Default 32 (half of max, so phones keep a smaller gap too). */
  min?: number
  /** Default 64. */
  max?: number
  /** Default 480. */
  smallScreen?: number
  /** Default 1000. */
  largeScreen?: number
}

export interface LookTabs {
  /** The strip behind the tabs. */
  bar?: LookBox
  /** Each tab; `selected` is the open one. */
  tab?: LookPart
  /** The line under the open tab: a CSS background, or 'none' to hide it. */
  indicator?: string
}

export interface LookSlider {
  /** Height of the slider bar in px (MUI default 4). Make room for a frame's edges. */
  height?: number
  /** The whole length of the bar. */
  rail?: LookBox
  /** The filled part, up to the value. */
  track?: LookBox
  /** The knob. Tip: `background: 'url(knob.png) center / contain no-repeat'`. */
  thumb?: LookPart
  /** Knob size in px (MUI default 20). */
  thumbSize?: number
}

export interface LookProgress {
  /** Height in px (MUI default 4). Make room for a frame's edges. */
  height?: number
  /** The whole length. */
  rail?: LookBox
  /** The filled part. It slides in from the left, so its left edge stays hidden. */
  bar?: LookBox
}

/**
 * The game's colours. They become the MUI palette, so `color="primary"`, `'text.secondary'`,
 * `'divider'` and every MUI part without its own look use them. Unset = MUI's dark default.
 */
export interface LookColors {
  /** Normal text (`text.primary`). */
  text?: string
  /** Quieter text: hints, captions (`text.secondary`). */
  muted?: string
  /** Greyed-out text (`text.disabled`). */
  disabled?: string
  /** The main colour: `primary` buttons, switches that are on, sliders, spinners, focus. */
  accent?: string
  /** Text on top of `accent`. */
  onAccent?: string
  /** `secondary` buttons and parts. */
  second?: string
  /** `success`. */
  good?: string
  /** `warning`. */
  warn?: string
  /** `error`. */
  danger?: string
  info?: string
  /** Thin lines between things (`divider`). */
  divider?: string
  /** Behind everything (`background.default`). */
  background?: string
  /** Plain panels without a frame (`background.paper`). */
  surface?: string
}

/** MUI Typography variants (`<Typography variant="body2">`). */
export type TextVariant =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'subtitle1'
  | 'subtitle2'
  | 'body1'
  | 'body2'
  | 'caption'
  | 'overline'
  | 'button'

/** Fonts and sizes. Each Typography variant takes plain CSS (fontSize, fontWeight, textShadow...). */
export type LookText = {
  /** CSS font-family for all text. Unset = default. */
  font?: string
  /** Base text size in px (MUI default 14). The variants scale with it unless they set their own. */
  size?: number
} & Partial<Record<TextVariant, CSSProperties>>

export type ButtonVariant = 'contained' | 'outlined' | 'text'
export const BUTTON_VARIANTS = ['contained', 'outlined', 'text'] as const
export type ButtonColor =
  | 'primary'
  | 'secondary'
  | 'warning'
  | 'error'
  | 'inherit'
  | 'success'
  | 'info'
export const BUTTON_COLORS = [
  'primary',
  'secondary',
  'warning',
  'error',
  'inherit',
  'success',
  'info',
] as const

/**
 * A button look. What is written here goes to all three variants; `contained`, `outlined`
 * and `text` change one variant only, on top of it.
 */
export interface LookButton extends LookPart {
  contained?: LookPart
  outlined?: LookPart
  text?: LookPart
}

/** `all` first, then the button's colour on top, each with its variant. */
export type LookButtons = { all?: LookButton } & Partial<Record<ButtonColor, LookButton>>

export interface LookSwitch {
  /** The bar the knob slides on. */
  track?: LookBox
  /** The knob. */
  thumb?: LookBox
  /** Changes while the switch is on. */
  on?: { track?: LookBox; thumb?: LookBox }
}

/** A sound in src/content/audio/, or one with its own volume (0..1). */
export type LookSound = AudioId | { id: AudioId; volume?: number }

/**
 * Sounds the UI plays by itself. Leave one out for silence. More names can be added and used on
 * one element with `data-sound="name"`; `data-sound="none"` keeps an element quiet.
 */
export interface LookSounds {
  /** Focus moved to another control with keyboard or gamepad. */
  move?: LookSound
  /** The mouse moved onto a control. */
  hover?: LookSound
  /** A button, menu row or dropdown was clicked / confirmed. */
  click?: LookSound
  /** A tab was picked. */
  tab?: LookSound
  /** A switch or checkbox was flipped. */
  toggle?: LookSound
  /** A window opened. */
  open?: LookSound
  /** A window closed. */
  close?: LookSound
  [name: string]: LookSound | undefined
}

/** Parts the engine itself draws. They must all be in `parts` (an empty {} = no styling). */
export interface EngineParts {
  /** Event answer buttons (a Button variant: starts from `button.all`). */
  choice: LookPart
  /** Title screen menu buttons (a Button variant: starts from `button.all`). */
  titleButton: LookPart
  /** The dark layer behind a modal window. */
  cover: LookBox
  /** The dark layer behind the event log. */
  logCover: LookBox
  /** The speaker's name on the chat box. Its background is the character's colour when it has one. */
  nameTag: LookBox
  /**
   * Text in the chat box: what a character (or a named speaker) says, and narration. Give them a
   * SOLID colour: "Text box opacity" fades the box, and see-through text would fade with it.
   */
  lineText: LookBox
  narrationText: LookBox
  /**
   * Optional: added on top of lineText / narrationText for a line the player has read before (in
   * any playthrough), e.g. another colour. Left out = read lines look the same.
   */
  lineTextRead?: LookBox
  narrationTextRead?: LookBox
  /** The full-screen chapter card: the cover, the "Chapter 1" line, and the title under it. */
  chapterCard: LookBox
  chapterCardLabel: LookBox
  chapterCardTitle: LookBox
  /** The chapter's description on the card (optional). */
  chapterCardDescription?: LookBox
  /** The see-through backdrop of an 'overlay' chapter card (chapters.ts card.style; optional). */
  chapterCardOverlay?: LookBox
  /** The strip of small buttons (Back, Auto, Skip, Hide) on the chat box's top border. */
  sceneToolbar: LookBox
  /** Added to an event answer the player has picked before (on top of `choice`). */
  choiceChosen: LookBox
  /** The frame around the speaker's face next to the text (side image). */
  sideImage: LookBox
  /**
   * The frame of inset() (the picture in the middle of the screen). Optional: without it the
   * picture only gets the theme's shadow (layers/event/Inset.tsx).
   */
  inset?: LookBox
  /** The page of full-page text (nvl()), on top of the chat box's own look. */
  nvlPage: LookBox
  /** A game.timers timer on screen. */
  timer: LookBox
  /** Added to a countdown in its last seconds (src/content/config/timers.ts warnSeconds). */
  timerWarning: LookBox
  /** Round on-screen buttons for touch (A, B, Bag). */
  touchButton: LookPart
  /** The on-screen joystick's base, and the knob that moves on it. */
  joystick: LookBox
  joystickKnob: LookBox
  /** Close button and caption over a full-screen picture. */
  viewer: LookBox
  /** The dots that pick a picture variant; `selected` = the shown one. */
  viewerDot: LookPart
  /** Flowchart (VN mode): every box; `focus` = under the cursor / picked with keys or a pad. */
  flowNode: LookPart
  /** Added to a box the player has not reached yet ("???"). */
  flowNodeLocked: LookBox
  /** Added to the box shown in the side panel. */
  flowNodeSelected: LookBox
  /** Added to the boxes on the way that would load (from the start to the selected box). */
  flowNodeOnPath: LookBox
  /** Added to the box the story is at now. */
  flowNodeCurrent: LookBox
  /** Added to a box that leads into another route. */
  flowRouteLink: LookBox
  /** Added to the box where the story ends (back to the title). */
  flowEnd: LookBox
  /** Added to a choice box (the player picks there; its options are the lines leaving it). */
  flowChoice: LookBox
  /** A flag() / check() diamond (drawn turned 45 degrees; not a box, can't be picked). */
  flowBranch: LookBox
  /** Added to a diamond on the way that would load. */
  flowBranchOnPath: LookBox
  /** The side panel (picture, title, description, Load). */
  flowPanel: LookBox
  /** The route tabs beside the chart; `selected` = the route shown. */
  flowTab: LookPart
  /** The line between the main story's tabs and the after stories' group (its text: the heading). */
  flowTabDivider: LookBox
  /** The "Routes" heading over the main story's tabs. */
  flowTabHeading: LookBox
}

export type LookParts = EngineParts & Record<string, LookPart>

export interface LookConfig {
  /** The palette: text, accent, good / warn / danger... */
  colors?: LookColors
  /** Font and text sizes. */
  text?: LookText
  /** Sounds on focus, click, tab, window open / close. */
  sounds?: LookSounds
  /**
   * Named looks. On a Button or Paper use `variant="name"`; anywhere else `sx={part('name')}`
   * (from '@/core/ui/part'). Add your own freely.
   */
  parts: LookParts
  /**
   * Raw MUI theme options, merged last over everything above: default props (behaviour) and
   * styles for anything the look has no setting for.
   */
  mui?: ThemeOptions
  scrollbar?: LookScrollbar
  /** Window frames (falls back to `panel`). */
  window?: LookBox
  windowGap?: LookWindowGap
  /** The event chat box (falls back to `panel`). */
  dialog?: LookBox
  /** Every MUI Paper: base for windows, the chat box, toasts, battle panels, alerts. */
  panel?: LookBox
  /** Every MUI Button: by colour, and by variant (contained / outlined / text). */
  button?: LookButtons
  /** Round icon buttons (a window's ✕). */
  iconButton?: LookPart
  tabs?: LookTabs
  slider?: LookSlider
  progress?: LookProgress
  /** Chips; the states show on clickable ones. */
  chip?: LookPart
  /** Alert boxes (over `panel`). */
  alert?: LookBox
  /** Avatars (round pictures / letters). */
  avatar?: LookBox
  switch?: LookSwitch
  /** A closed dropdown (Select). `focus` = picked or open. */
  input?: LookPart
  /** The list that opens from a dropdown. */
  menu?: LookBox
  /** One row in that list. */
  menuItem?: LookPart
}

/**
 * Keeps the part names exact (they become <Button variant="…">); everything else is the declared
 * LookConfig, so core can read any optional setting even when the game's look leaves it out.
 */
export function defineLook<const P extends LookParts>(
  config: LookConfig & { parts: P },
): LookConfig & { parts: P } {
  return config
}

type Style = CSSProperties

function edges(slice: LookBox['slice']): [number, number, number, number] {
  if (Array.isArray(slice)) return slice
  const s = slice ?? 16
  return [s, s, s, s]
}

/** The style object for a box (use with `sx`, or spread into `style`). */
export function boxLook(box: LookBox | undefined): Style {
  if (!box) return {}
  const style: Style = {}
  if (box.background) style.background = box.background
  if (box.color) style.color = box.color
  if (box.image) {
    const slice = edges(box.slice)
    const scale = box.scale ?? 1
    const widths = slice.map((s) => `${s * scale}px`).join(' ')
    style.borderStyle = 'solid'
    style.borderColor = 'transparent'
    style.borderWidth = widths
    style.borderRadius = '0'
    style.borderImage = `url("${box.image}") ${slice.join(' ')} fill / ${widths} ${box.sides ?? 'stretch'}`
    // The background stays inside the frame, and MUI's square shadows go.
    style.backgroundClip = 'padding-box'
    style.boxShadow = 'none'
    if (box.pixelated) style.imageRendering = 'pixelated'
  }
  // The dev's own CSS always wins.
  return { ...style, ...box.css }
}

/** `over` on top of `base`. Their `css` is joined, not replaced. */
function mergeBox(base: LookBox, over: LookBox | undefined): LookBox {
  if (!over) return base
  const box = { ...base, ...over }
  if (base.css || over.css) box.css = { ...base.css, ...over.css }
  return box
}

const STATES = ['focus', 'pressed', 'disabled', 'selected'] as const

/** `over` on top of `base`, state by state (a button colour over `button.all`, a choice over a button). */
export function mergeParts(...parts: (LookPart | undefined)[]): LookPart | undefined {
  let out: LookPart | undefined
  for (const part of parts) {
    if (!part) continue
    if (!out) {
      out = part
      continue
    }
    const merged: LookPart = mergeBox(out, part)
    for (const state of STATES) {
      const a = out[state]
      const b = part[state]
      if (a || b) merged[state] = mergeBox(a ?? {}, b)
    }
    out = merged
  }
  return out
}

/** CSS selectors for each state. Parts whose MUI class differs pass their own. */
export interface StateSelectors {
  focus?: string
  pressed?: string
  disabled?: string
  selected?: string
}

const SELECTORS: Required<StateSelectors> = {
  focus: '&:focus-visible, &.Mui-focusVisible',
  pressed: '&:active',
  disabled: '&.Mui-disabled',
  selected: '&.Mui-selected',
}

// Used when a part has a frame but no picture for a state, so the state still shows.
const FALLBACK: Record<keyof StateSelectors, Style> = {
  focus: { filter: 'brightness(1.25)' },
  pressed: { filter: 'brightness(0.85)' },
  disabled: { filter: 'grayscale(1)', opacity: '0.6' },
  selected: { filter: 'brightness(1.15)' },
}

/**
 * The full style for a part: its normal look plus each state (use with `sx` or theme overrides).
 * A state redraws the whole merged box, because MUI changes borders in some states (a disabled
 * outlined button resets its border to 1px, which would wipe the frame).
 */
export function partLook(part: LookPart | undefined, selectors: StateSelectors = {}): object {
  if (!part) return {}
  const { focus, pressed, disabled, selected, ...normal } = part
  const sel = { ...SELECTORS, ...selectors }
  const style: Record<string, unknown> = { ...boxLook(normal) }
  const hover: Record<string, unknown> = {}
  const add = (base: LookBox, baseSel: string, order: [keyof StateSelectors, LookBox?][]) => {
    for (const [name, box] of order) {
      if (!box && !base.image) continue
      // Same frame picture as the base: add a small effect so the state still shows.
      const effect = base.image && !box?.image ? FALLBACK[name] : {}
      const { css, ...merged } = mergeBox(base, box)
      const look = { ...boxLook(merged), ...effect, ...css }
      // "&" + "&:focus-visible, &.Mui-focusVisible" -> the state on top of a base state.
      const key = sel[name].replaceAll('&', baseSel)
      // Hover only where a real mouse hovers (a tap would leave it stuck on phones).
      if (name === 'focus') hover[`${baseSel}:hover`] = look
      style[key] = look
    }
  }
  // Later rules win: selected < focus/hover < pressed < disabled.
  add(normal, '&', [
    ['selected', selected],
    ['focus', focus],
    ['pressed', pressed],
    ['disabled', disabled],
  ])
  // A selected part (the open tab) that is also focused or pressed keeps its selected picture.
  if (selected) {
    const sel1 = sel.selected
    if (!sel1.includes(','))
      add(mergeBox(normal, selected), sel1, [
        ['focus', focus],
        ['pressed', pressed],
      ])
  }
  if (Object.keys(hover).length) style['@media (hover: hover)'] = hover
  return style
}

/** One state of a part as a flat style: the normal look with that state on top. */
export function stateLook(part: LookPart | undefined, state: keyof StateSelectors): Style {
  if (!part) return {}
  const { focus, pressed, disabled, selected, ...normal } = part
  return boxLook(mergeBox(normal, { focus, pressed, disabled, selected }[state]))
}

/**
 * MUI paints a slider's rail and knob in the accent colour. Under a frame picture that colour
 * showed as a thin line at the edges where the screen scale is not a whole number (Electron).
 */
function underFrame(box: LookBox): Style {
  return box.image && !box.background ? { backgroundColor: 'transparent' } : {}
}

/** True when this look draws a frame image somewhere on windows (they then drop their outline). */
export function hasFrame(...boxes: (LookBox | undefined)[]): boolean {
  return boxes.some((b) => b?.image)
}

/** The look of one button: what is shared by all variants, then that variant on top. */
function buttonPart(button: LookButton | undefined, variant?: ButtonVariant): LookPart | undefined {
  if (!button) return undefined
  const { contained, outlined, text, ...shared } = button
  return variant ? mergeParts(shared, { contained, outlined, text }[variant]) : shared
}

/** The MUI palette from the look's colours (unset ones keep MUI's dark default). */
export function lookPalette(colors: LookColors | undefined): NonNullable<ThemeOptions['palette']> {
  const c = colors ?? {}
  const main = (color: string | undefined, extra?: object) =>
    color ? { main: color, ...extra } : undefined
  const text = { primary: c.text, secondary: c.muted, disabled: c.disabled }
  const background = { default: c.background, paper: c.surface }
  const palette = {
    mode: 'dark' as const,
    primary: main(c.accent, c.onAccent ? { contrastText: c.onAccent } : {}),
    secondary: main(c.second),
    success: main(c.good),
    warning: main(c.warn),
    error: main(c.danger),
    info: main(c.info),
    divider: c.divider,
    text: clean(text),
    background: clean(background),
  }
  return clean(palette) as NonNullable<ThemeOptions['palette']>
}

/** Drops unset keys (MUI would take `undefined` as a value). */
function clean<T extends object>(object: T): Partial<T> {
  return Object.fromEntries(Object.entries(object).filter(([, v]) => v !== undefined)) as Partial<T>
}

/** MUI typography options from the look's text settings. */
export function lookTypography(
  text: LookText | undefined,
): NonNullable<ThemeOptions['typography']> {
  if (!text) return {}
  const { font, size, ...variants } = text
  return clean({ fontFamily: font, fontSize: size, ...variants }) as NonNullable<
    ThemeOptions['typography']
  >
}

// MUI pulses a grey blob inside a focused button. A part with its own focus look doesn't need it
// (click ripples stay).
const ownFocus = (part: LookPart | undefined) => Boolean(part?.image || part?.focus)

/** MUI theme overrides that give every MUI part the look (goes into createTheme in boot.tsx). */
export function lookComponents(
  look: Omit<LookConfig, 'parts'> & { parts?: Record<string, LookPart> },
): NonNullable<ThemeOptions['components']> {
  const { slider, progress, tabs, button } = look
  const thumbSize = slider?.thumbSize
  const parts = look.parts ?? {}
  const names = Object.keys(parts)
  // MUI's types only know its own variant names; the part names are added in lookTypes.ts.
  const variant = (name: string) => ({ variant: name }) as { variant: ButtonVariant }
  return {
    MuiPaper: {
      styleOverrides: { root: boxLook(look.panel) },
      variants: names.map((name) => ({
        props: { variant: name } as { variant: 'outlined' },
        style: boxLook(parts[name]),
      })),
    },
    MuiButton: {
      defaultProps: { disableFocusRipple: ownFocus(button?.all) },
      variants: [
        // all < all's variant < the colour < the colour's variant.
        ...BUTTON_VARIANTS.flatMap((kind) =>
          BUTTON_COLORS.map((color) => ({
            props: { variant: kind, color },
            style: partLook(
              mergeParts(
                buttonPart(button?.all),
                buttonPart(button?.all, kind),
                buttonPart(button?.[color]),
                buttonPart(button?.[color], kind),
              ),
            ),
          })),
        ),
        // Named parts: <Button variant="choice">. No MUI variant styling under them.
        ...names.map((name) => ({
          props: variant(name),
          style: partLook(mergeParts(buttonPart(button?.all), parts[name])),
        })),
      ],
    },
    MuiIconButton: {
      defaultProps: { disableFocusRipple: ownFocus(look.iconButton) },
      styleOverrides: { root: partLook(look.iconButton) },
    },
    MuiChip: { styleOverrides: { root: partLook(look.chip) } },
    MuiAlert: { styleOverrides: { root: boxLook(look.alert) } },
    MuiAvatar: { styleOverrides: { root: boxLook(look.avatar) } },
    MuiSwitch: {
      styleOverrides: {
        // MUI draws the track half see-through; a track with its own look is drawn as given.
        track: look.switch?.track ? { opacity: 1, ...boxLook(look.switch.track) } : {},
        thumb: boxLook(look.switch?.thumb),
        switchBase: {
          ...(look.switch?.on?.thumb
            ? { '&.Mui-checked .MuiSwitch-thumb': boxLook(look.switch.on.thumb) }
            : {}),
          ...(look.switch?.on?.track
            ? {
                '&.Mui-checked + .MuiSwitch-track': {
                  opacity: 1,
                  ...boxLook(look.switch.on.track),
                },
              }
            : {}),
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: boxLook(tabs?.bar),
        indicator: tabs?.indicator
          ? tabs.indicator === 'none'
            ? { display: 'none' }
            : { background: tabs.indicator }
          : {},
      },
    },
    MuiTab: {
      defaultProps: { disableFocusRipple: ownFocus(tabs?.tab) },
      styleOverrides: { root: partLook(tabs?.tab) },
    },
    MuiSlider: {
      styleOverrides: {
        root: slider?.height ? { height: slider.height } : {},
        rail: slider?.rail
          ? { opacity: 1, borderRadius: 0, ...underFrame(slider.rail), ...boxLook(slider.rail) }
          : {},
        track: { borderRadius: 0, ...boxLook(slider?.track) },
        thumb: slider?.thumb
          ? {
              ...(thumbSize ? { width: thumbSize, height: thumbSize } : {}),
              borderRadius: 0,
              // MUI's round shadow and glow ring around the knob.
              '&::before': { boxShadow: 'none' },
              '&:hover, &.Mui-focusVisible, &.Mui-active': { boxShadow: 'none' },
              ...underFrame(slider.thumb),
              ...partLook(slider.thumb, { pressed: '&.Mui-active' }),
            }
          : thumbSize
            ? { width: thumbSize, height: thumbSize }
            : {},
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          ...(progress?.height ? { height: progress.height } : {}),
          ...boxLook(progress?.rail),
        },
        bar: boxLook(progress?.bar),
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          ...partLook(look.input, { focus: '&.Mui-focused', pressed: '&:active' }),
          ...(look.input ? { '& .MuiOutlinedInput-notchedOutline': { border: 'none' } } : {}),
        },
      },
    },
    MuiMenu: { styleOverrides: { paper: boxLook(look.menu) } },
    MuiMenuItem: { styleOverrides: { root: partLook(look.menuItem) } },
  }
}

/** CSS length for the window gap: scales with the game screen (cqmin), clamped to min..max. */
export function windowGapCss(gap: LookWindowGap | undefined): string {
  const min = gap?.min ?? 32
  const max = gap?.max ?? 64
  const small = gap?.smallScreen ?? 480
  const large = Math.max(gap?.largeScreen ?? 1000, small + 1)
  const grow = `calc(${min}px + ${max - min} * (100cqmin - ${small}px) / ${large - small})`
  return `clamp(${Math.min(min, max)}px, ${grow}, ${Math.max(min, max)}px)`
}

/** Page-wide CSS for the scrollbar setting (goes into the MUI theme's CssBaseline). */
export function scrollbarLook(bar: LookScrollbar | undefined): Style {
  if (!bar) return {}
  const style: Style = {}
  if (bar.width) style.scrollbarWidth = bar.width
  if (bar.thumb || bar.track)
    style.scrollbarColor = `${bar.thumb ?? '#5a6375'} ${bar.track ?? 'transparent'}`
  return style
}

/** Text drawn on the map (name labels, the "press A" prompt). Colours: CSS ('#fff', 'white'). */
export interface LookMapText {
  /** CSS font-family. */
  font?: string
  /** px at the normal text size (content/config/screen.ts `map.textHeight`). */
  size?: number
  /** 'normal', 'bold' or a number as text ('800'). */
  weight?: string
  color?: string
  /** The line around each letter; 'transparent' or outlineWidth 0 = none. */
  outline?: string
  outlineWidth?: number
}

/** src/content/look/map.ts: text and speech bubbles on the map. Anything left out keeps the default. */
export interface LookMap {
  /** Names over objects and NPCs (the Tiled `label` property). */
  label?: LookMapText
  /** Over the player when something can be used: the confirm key / button, or `touch` on touch. */
  prompt?: LookMapText & {
    /** Shown on touch screens (no key to name). */
    touch?: string
  }
  /** npc.bark('Hi!') / player.bark(). Emote balloons take their colours from content/emotes.ts. */
  bubble?: {
    /** The balloon: its inside, border and border width. */
    fill?: string
    outline?: string
    outlineWidth?: number
    /** Corner roundness, px. */
    radius?: number
    /** Space between the text and the border, px. */
    padding?: number
    /** Size of the little point under the balloon, px. */
    tail?: number
    /** Longer lines wrap at this width, px. */
    maxWidth?: number
    /** The text: font, size, weight, colour. */
    text?: Pick<LookMapText, 'font' | 'size' | 'weight' | 'color'>
    /** Fade in / out, ms. */
    fadeMs?: number
    /**
     * How long a bark stays when it gives no duration, ms: baseMs + perLetterMs per letter, kept
     * between minMs and maxMs. Default { minMs: 1500, maxMs: 6000, baseMs: 900, perLetterMs: 55 }.
     */
    time?: { minMs?: number; maxMs?: number; baseMs?: number; perLetterMs?: number }
  }
}

export function defineMapLook(config: LookMap): LookMap {
  return config
}
