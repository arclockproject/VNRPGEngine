// Ambient sound, achievements, codex, title screens, money, shops, flags and quests. Part of core/define.ts (import from there).

import type { ComponentType } from 'react'
import type { Game } from '../game'
import type { AudioId, ItemId, WeatherKind } from '../registry'
import type { VariantValue } from '../variants'
import type { propTagType } from './maps'

// ---------------------------------------------------------------- ambient sound

/** src/content/ambient.ts: sounds that go with the weather. */
export interface AmbientConfig {
  weather: Partial<Record<WeatherKind, AudioId | null>>
}

export function defineAmbient(config: AmbientConfig): AmbientConfig {
  return config
}

// ---------------------------------------------------------------- achievements + codex

/** An achievement (src/content/achievements/<id>): game.achievements.unlock('<id>'). */
export interface AchievementConfig {
  /** Only in the version of the game built with this content variant (src/content/config/variants.ts); left out of the others. */
  only?: VariantValue
  title: string
  description: string
  icon?: string
  /** Shown as "???" until unlocked. */
  secret?: boolean
}

export function defineAchievement(config: AchievementConfig): AchievementConfig {
  return config
}

// ---------------------------------------------------------------- title screens

/** What a boot screen's component gets. */
export interface BootScreenProps {
  /** Which of `steps` is playing, from 0. */
  step: number
}

/**
 * A boot screen (src/content/boot/<name>.tsx): a notice or logo shown once when the game starts,
 * before "press any key". All of them play one after another (by `order`, then file name): fade
 * in, each step in turn, fade to black.
 */
export interface BootConfig {
  /** Playing order, lowest first. Default 0 (ties go by file name). */
  order?: number
  /** true = a confirm key / button, click or tap ends it early. false = it always plays in full. */
  skippable: boolean
  /** How long it stays, in ms. A list = several stills: `step` goes 0, 1, 2… as each one ends. */
  steps: number | readonly number[]
  /** Fade from black, ms (before the first step). */
  fadeIn: number
  /** Fade to black, ms (after the last step). */
  fadeOut: number
  /** Pictures and other files to load before the boot screens start (imported URLs). */
  preload?: readonly string[]
  /** What it draws. It fills the screen; the engine does the fades. */
  screen: ComponentType<BootScreenProps>
}

export function defineBoot(config: BootConfig): BootConfig {
  return config
}

/** What a title screen's art gets. It plays its entrance when it first draws (mount). */
export interface TitleScreenProps {
  /**
   * 'intro' = the entrance is playing (no menu yet), 'shown' / 'menu' = entrance over,
   * 'leaving' = fading out to the game.
   */
  phase: 'intro' | 'shown' | 'menu' | 'leaving'
  /**
   * Which of the title's `intro` steps is playing, from 0. Equal to the number of steps once the
   * entrance is over (or was skipped): draw the final look then.
   */
  step: number
}

/**
 * A title screen (src/content/titles/<id>): the art drawn behind the title menu. Unlock more with
 * game.title.unlock('<id>'); kept across all saves. The player switches between unlocked ones.
 */
export interface TitleConfig {
  /** Shown in the switcher (bottom left). */
  name: string
  /** Switcher order, oldest first. Default 0. */
  order?: number
  /** Available from the start, without unlocking (your first title screen). */
  unlocked?: boolean
  /** The art and its entrance: `() => import('./Screen')`. Loaded only when needed. */
  screen: () => Promise<{ default: ComponentType<TitleScreenProps> }>
  /**
   * How long the entrance takes, in ms: the menu, switcher and version wait for it. A list =
   * several stills (`step` 0, 1, 2… in the screen's props, e.g. `[1000, 1200]`: first element,
   * 1 s later the second, 1.2 s later the menu). The player can skip it: the screen then gets the
   * last step and its CSS animations jump to their end. Default: no wait.
   */
  intro?: number | readonly number[]
  /**
   * Files from outside this folder to load before it shows (e.g. a shared logo). Every image,
   * sound and video inside the folder is loaded already.
   */
  preload?: readonly string[]
  /** Music while it shows (from src/content/audio), loaded before it shows too. */
  music?: AudioId
}

export function defineTitle(config: TitleConfig): TitleConfig {
  return config
}

/** Another version of a journal entry, shown while `when` is true. */
export interface CodexVersion {
  /** Checked each time the journal shows the entry. */
  when: (game: Game) => boolean
  /** Each field replaces the entry's own; leave one out to keep it. */
  title?: string
  text?: string
  image?: string
}

/** A journal entry (src/content/codex/<id>): people, places, lore. game.codex.unlock('<id>'). */
export interface CodexConfig {
  /** Only in the version of the game built with this content variant (src/content/config/variants.ts); left out of the others. */
  only?: VariantValue
  title: string
  /** Groups entries in the journal, e.g. 'People', 'Places'. */
  category: string
  text: string
  image?: string
  /** Versions that depend on game state (affection, flags, quests…). The first match is shown. */
  versions?: CodexVersion[]
}

export function defineCodex(config: CodexConfig): CodexConfig {
  return config
}

// ---------------------------------------------------------------- money + shops

/** The currency (src/content/config/money.ts). */
export interface MoneyConfig {
  /** How amounts are shown, e.g. '{amount} coins'. Translated like other text. */
  format: string
  /** Money at the start of a new game. Default 0. */
  start?: number
  /** Most the player can carry. Default no limit. */
  max?: number
  icon?: string
  /** Most of one item in the bag, for items without their own `max`. */
  itemStack: number
}

export function defineMoney(config: MoneyConfig): MoneyConfig {
  return config
}

export interface ShopItem {
  /** Price here. Default: the item's `price` (times the shop's `priceRate`). */
  price?: number
  /** How many the shop has. Default: no limit. */
  stock?: number
}

/** A shop (src/content/shops/<id>): game.shops.open('<id>'). */
export interface ShopConfig {
  name: string
  /** What it sells: { apple: {}, lantern: { price: 40, stock: 1 } }. */
  items: Partial<Record<ItemId, ShopItem>>
  /** Multiplies items' default prices. Default 1. */
  priceRate?: number
  /**
   * What it buys from the player: true = any item with a price, a list = only those, false = nothing.
   * Default true.
   */
  buys?: boolean | ItemId[]
  /** Share of the price paid when the player sells. Default 0.5. */
  sellRate?: number
  /** 'daily' = stock refills each in-game day; 'never' = sold out stays sold out. Default 'daily'. */
  restock?: 'daily' | 'never'
}

export function defineShop(config: ShopConfig): ShopConfig {
  return config
}

// ---------------------------------------------------------------- flags

export type FlagValue = boolean | number | string
type Widen<T> = T extends boolean ? boolean : T extends number ? number : string

/**
 * The story flags and their starting values (src/content/flags.ts). game.flags.get/set are typed
 * from this: a typo in a flag name is an error.
 */
export function defineFlags<T extends Record<string, FlagValue>>(
  flags: T,
): { [K in keyof T]: Widen<T[K]> } {
  return flags as unknown as { [K in keyof T]: Widen<T[K]> }
}

// ---------------------------------------------------------------- quests

declare const questStepType: unique symbol

export interface QuestContext {
  game: Game
}

/**
 * A quest step with more than its text. With `when`, the step is listed in the quest log from the
 * start but reads `hiddenText` ("???") until `when` returns true (or the step is done).
 */
export interface QuestStep {
  text: string
  /** Checked whenever the log is shown: true = show `text`. E.g. `({ game }) => game.flags.get('x')`. */
  when?: (ctx: QuestContext) => boolean
  /** Shown instead of `text` while `when` is false. Default '???'. */
  hiddenText?: string
}

/** A quest with ordered steps (src/content/quests/<id>). Progress is saved. */
export interface QuestConfig<S extends string> {
  title: string
  description?: string
  /** Step id -> what the player should do (a text, or a QuestStep to mask it), in order. */
  steps: Record<S, string | QuestStep>
  onStart?: (ctx: QuestContext) => void
  onComplete?: (ctx: QuestContext) => void
}

export type QuestDefinition<S extends string = string> = QuestConfig<S> & {
  readonly [questStepType]: S
}

export function defineQuest<const S extends string>(config: QuestConfig<S>): QuestDefinition<S> {
  return config as QuestDefinition<S>
}

export type QuestStepsOf<D> = D extends { readonly [questStepType]: infer S } ? S : never
export type PropTagsOf<D> = D extends { readonly [propTagType]: infer T extends string } ? T : never
