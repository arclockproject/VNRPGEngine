// Types for src/content/chapters.ts (game.chapters: labels for the story's parts, shown on saves).
// Must not import content.
import type { ComponentType } from 'react'
import type { ChapterCardSlotProps } from './slots'

/** How a chapter that begins is shown. */
export type ChapterAnnounce = boolean | 'toast' | 'card' | 'both'

/** The chapter card's timing and style (chapters.ts `card`, or one chapter's own `card`). */
export interface ChapterCardConfig {
  /**
   * 'screen' (default): covers the stage, like a VN eyecatch. In a scene, `await
   * chapter('id')` (`chapter id` in .vn) waits until it covers; the stage changes after it happen
   * at once under it, and it leaves only once the new pictures have loaded.
   * 'overlay': a see-through backdrop with the title and description over the scene.
   */
  style?: 'screen' | 'overlay'
  /** How long it stays, ms, fades included (when `steps` is left out). */
  ms: number
  /** Both fades, ms (fadeIn / fadeOut win). */
  fadeMs: number
  fadeIn?: number
  fadeOut?: number
  /**
   * Time between the fades as steps, like a boot screen: [800, 1500] = step 0 for 0.8 s, then
   * step 1 for 1.5 s (the card gets `step` to show more as it goes). Wins over `ms`.
   */
  steps?: number | readonly number[]
  /** A click / tap / confirm skips it (it still waits for the new pictures to load). */
  skippable: boolean
  /**
   * Come in / go out through a mask transition (a name from src/content/scenes.ts transitions)
   * instead of a fade. 'screen' style only.
   */
  maskIn?: string
  maskOut?: string
}

export interface ChapterConfig {
  /** The chapter's number (story order; `vn_chapters` can give a number its own name, e.g. 0 = "Prologue"). */
  number: number
  /** A sub chapter: 1.2 = number 1, sub 2. Leave it out for a whole chapter. */
  sub?: number
  /** Its name, without the number: "The town" (translated). Saves and the toast show both. */
  title: string
  /** Shown under the title when a save is picked, and on the card: the state of the story (translated). */
  description?: string
  /** A picture on the chapter card (an image import). */
  image?: string
  /** This chapter only: how it is shown (instead of `announce`). */
  announce?: ChapterAnnounce
  /** This chapter only: its card's timing and style, on top of `card`. */
  card?: Partial<ChapterCardConfig>
  /**
   * This chapter only: draw its card with this component instead of src/content/ui/ChapterCard.tsx
   * (same props: label, title, description, image, style, shown, fadeMs, phase, step, skipped).
   */
  screen?: ComponentType<ChapterCardSlotProps>
}

export interface ChaptersConfig<K extends string = string> {
  /**
   * How a chapter that begins is shown: 'toast' (a small message; true means the same), 'card' (the
   * chapter card: the next line waits for it), 'both', or false (nothing). A chapter can set its own.
   */
  announce: ChapterAnnounce
  /** The chapter card: style, timing, fades, steps and skipping. */
  card?: ChapterCardConfig
  /** How a number reads (translated): {number} = "1", or "1.2" with a sub chapter. */
  label: string
  /**
   * A name per chapter number, shown instead of `label` (translated): { 0: 'Prologue', 1: 'Spring' }.
   * Used on the flowchart's chapter lines, saves and the toast (a sub chapter adds ".2"). Numbers not
   * listed use `label`.
   */
  vn_chapters: Partial<Record<number, string>>
  /** Number and title together, on saves and in the toast: {label} and {title}. */
  full: string
  /**
   * An event, a map hook or a route starts one with game.chapters.reach('id') (`chapter id` in a
   * .vn file; `chapter('id')` in a route, which also draws it on the flowchart). In a scene,
   * `await chapter('id')` also waits for a 'screen' card to cover the stage. Ordered by number.
   */
  chapters: Record<K, ChapterConfig>
}

export function defineChapters<const K extends string>(
  config: ChaptersConfig<K>,
): ChaptersConfig<K> {
  return config
}
