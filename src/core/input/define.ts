// Types for src/content/config/input.ts, where the game declares its actions and bindings.

/** Standard gamepad layout (Xbox naming). Steam Deck and most controllers use this. */
export const GamepadButton = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  Back: 8,
  Start: 9,
  LeftStick: 10,
  RightStick: 11,
  DpadUp: 12,
  DpadDown: 13,
  DpadLeft: 14,
  DpadRight: 15,
} as const

export type Direction = 'up' | 'down' | 'left' | 'right'
export const DIRECTIONS: readonly Direction[] = ['up', 'down', 'left', 'right']

/** Actions the engine itself relies on (window navigation, closing, menus). */
export type RequiredAction = 'confirm' | 'cancel' | 'menu' | Direction

/**
 * Every action the engine reacts to by itself. A game whose config/input.ts leaves one out still
 * builds; that action then has no key or button (it never fires) until the game adds it.
 */
export type EngineAction =
  | RequiredAction
  | 'inventory'
  | 'skip'
  | 'back'
  | 'hide'
  | 'log'
  | 'auto'
  | 'tabPrev'
  | 'tabNext'
  | 'quickSave'
  | 'quickLoad'
  | 'screenshot'
  | 'fullscreen'

export interface ActionBinding {
  /** KeyboardEvent.code values, e.g. 'KeyW', 'Space', 'Escape' (layout independent). */
  keys?: string[]
  /** Gamepad button indexes, see GamepadButton. */
  buttons?: number[]
  /** Fires when the left stick (or touch joystick) is pushed this way. */
  stick?: Direction
  /**
   * false = not in VN-only mode (src/content/config/mode.ts vnOnly): it never fires there and is not
   * listed in Settings → Controls (e.g. the inventory, which a visual novel has none of). Default true.
   */
  vnMode?: boolean
  /**
   * true = its controller buttons can't be changed (Settings → Controls shows a lock) and no other
   * action may take them: the button that opens the menu, so a controller player can always get to
   * Settings. Keys stay changeable. Default false.
   */
  padLocked?: boolean
  /**
   * true = while one of the `menuWindows` is open, its DEFAULT controller buttons work, not the
   * player's own: moving, confirm and cancel, so a player can always fix their bindings in
   * Settings. Elsewhere the player's own buttons apply. Default false.
   */
  padResetInMenus?: boolean
}

export interface TouchButton<A extends string> {
  action: A
  label: string
  /** 'top-right' pins the button to the top right corner. Default: the bottom right group. */
  place?: 'top-right'
  /** Where the button shows. Default: both. */
  layers?: ('map' | 'event')[]
}

/** How sticks, held directions and the on-screen joystick feel. */
export interface InputFeel {
  stick: {
    /** Stick movement below this (0..1) is ignored (worn sticks never rest at exactly 0). */
    deadzone: number
    /** Pushing past this counts as pressing that direction (menus)... */
    press: number
    /** ...until it falls back under this. */
    release: number
  }
  /** A held direction on a controller or touch repeats (menus, lists). Keyboards use the OS repeat. */
  repeat: {
    /** ms before the first repeat. */
    delayMs: number
    /** ms between repeats after that. */
    rateMs: number
  }
  /** The on-screen joystick on touch devices, px. */
  joystick: {
    size: number
    knob: number
  }
}

export interface InputConfig<A extends string> {
  actions: Record<A, ActionBinding>
  feel: InputFeel
  /** On-screen buttons shown on touch devices (bottom right, first one is largest). */
  touchButtons?: TouchButton<A>[]
  /**
   * Android's Back button (or back gesture): the actions it tries, in order, until one does
   * something. Leave it out for cancel, then menu (what Escape does on a keyboard).
   */
  backButton?: A[]
  /**
   * Windows where the `padResetInMenus` actions use their default controller buttons (the pause
   * menu and Settings: the way to fix one's bindings). A dialog opened from one counts too.
   */
  menuWindows?: string[]
}

export function defineInput<A extends string>(config: {
  actions: Record<A, ActionBinding> & Record<RequiredAction, ActionBinding>
  touchButtons?: TouchButton<NoInfer<A> | RequiredAction>[]
  backButton?: (NoInfer<A> | RequiredAction)[]
  menuWindows?: string[]
  feel: InputFeel
}): InputConfig<A | RequiredAction> {
  return config as InputConfig<A | RequiredAction>
}

/** One gamepad button as shown in prompts: its name, and a colour for face buttons (CSS). */
export interface ButtonGlyph {
  label: string
  color?: string
}

/**
 * src/content/look/glyphs.ts: how keys and gamepad buttons are named in prompts and on the controls
 * screen. Anything left out: a key shows its code ('KeyW' -> 'W'), a button '#n'.
 */
export interface GlyphsConfig {
  /** KeyboardEvent.code -> label: { ArrowUp: '↑', Escape: 'Esc' }. */
  keys?: Partial<Record<string, string>>
  /** Per controller kind: button index (GamepadButton) -> name and colour. */
  gamepads?: Partial<
    Record<'xbox' | 'playstation' | 'nintendo' | 'steamdeck', Partial<Record<number, ButtonGlyph>>>
  >
}

export function defineGlyphs(config: GlyphsConfig): GlyphsConfig {
  return config
}
