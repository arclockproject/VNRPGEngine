// The chapter card (src/content/chapters.ts announce: 'card' / 'both'). While it shows, the next
// line, choice or text input waits for it (core/scene/director.ts), so the scene starts after it.
// Runtime only: never saved, never shown while a save replays or while skipping.
//
// Two styles:
//   'screen'  (VN eyecatch) covers the stage. `await chapter('id')` in a scene waits until it
//             covers fully; stage changes made while it covers are instant (no fades, no slides),
//             and it leaves only once the stage's pictures have loaded, so the reveal shows the new
//             stage at once, with no swap after it.
//   'overlay' a see-through backdrop with the title over the scene: the stage stays as it is.
//
// Phases: 'in' (fading in) -> 'on' (steps run; covering) -> 'out' (fading out) -> gone.
import type { ComponentType } from 'react'
import { create } from 'zustand'
import type { ChapterCardSlotProps } from '../slots'

export type ChapterCardStyle = 'screen' | 'overlay'
export type ChapterCardPhase = 'in' | 'on' | 'out'

export interface ChapterCard {
  /** Increases with every card (the layer restarts its timing). */
  id: number
  /** "Chapter 1.2" (translated). */
  label: string
  /** The chapter's title (translated). */
  title: string
  /** The chapter's description (translated), if it has one. */
  description?: string
  /** A picture on it, if the chapter has one. */
  image?: string
  style: ChapterCardStyle
  /** Fade in / out, ms. */
  fadeIn: number
  fadeOut: number
  /** Time on screen between the fades, as steps (the slot's `step` counts them up), ms. */
  steps: number[]
  skippable: boolean
  /** Mask transitions (src/content/scenes.ts transitions) to come in / go out with, else a fade. */
  maskIn?: string
  maskOut?: string
  /** The chapter's own drawing, instead of src/content/ui/ChapterCard.tsx. */
  screen?: ComponentType<ChapterCardSlotProps>
}

/** What showChapterCard() takes: the timing can still be the old `ms` + `fadeMs`. */
export type ChapterCardInput = Omit<
  ChapterCard,
  'id' | 'style' | 'fadeIn' | 'fadeOut' | 'steps'
> & {
  style?: ChapterCardStyle
  fadeIn?: number
  fadeOut?: number
  steps?: number | readonly number[]
  /** Total time, fades included (used when `steps` is left out). */
  ms?: number
  /** Both fades (when fadeIn / fadeOut are left out). */
  fadeMs?: number
}

export const useChapterCard = create<{ card: ChapterCard | null; phase: ChapterCardPhase }>(() => ({
  card: null,
  phase: 'in',
}))

let count = 0
let done: (() => void) | null = null
let waiting: Promise<void> | null = null
let covered: (() => void) | null = null
let covering: Promise<void> | null = null

/** Shows a card (replacing one already up). */
export function showChapterCard(input: ChapterCardInput): void {
  done?.()
  covered?.()
  const fade = input.fadeMs ?? 600
  const fadeIn = input.fadeIn ?? fade
  const fadeOut = input.fadeOut ?? fade
  const steps =
    input.steps === undefined
      ? [Math.max(0, (input.ms ?? 2800) - fadeIn - fadeOut)]
      : typeof input.steps === 'number'
        ? [input.steps]
        : [...input.steps]
  const { ms: _ms, fadeMs: _fadeMs, ...rest } = input
  const card: ChapterCard = {
    ...rest,
    id: ++count,
    style: input.style ?? 'screen',
    fadeIn,
    fadeOut,
    steps,
  }
  waiting = new Promise((resolve) => {
    done = resolve
  })
  covering = new Promise((resolve) => {
    covered = resolve
  })
  useChapterCard.setState({ card, phase: 'in' })
}

/** The card has faded in: it covers the stage now (the layer calls this). */
export function chapterCardCovering(): void {
  if (!useChapterCard.getState().card) return
  useChapterCard.setState({ phase: 'on' })
  const finish = covered
  covered = null
  finish?.()
}

/** The card starts to fade out (the layer calls this). */
export function chapterCardLeaving(): void {
  if (useChapterCard.getState().card) useChapterCard.setState({ phase: 'out' })
}

/** The card is over (its time ran out, or the player skipped it). */
export function endChapterCard(): void {
  useChapterCard.setState({ card: null, phase: 'in' })
  const finish = done
  const cover = covered
  done = null
  waiting = null
  covered = null
  covering = null
  finish?.()
  cover?.()
}

/** Resolves when no card is up (at once if none is). */
export function chapterCardDone(): Promise<void> | null {
  return waiting
}

/**
 * A 'screen' card that is still fading in: resolves once it covers the stage (null = nothing to
 * wait for). `await chapter('id')` uses this, so the stage changes after it are hidden.
 */
export function chapterCardCovered(): Promise<void> | null {
  const { card, phase } = useChapterCard.getState()
  return card?.style === 'screen' && phase === 'in' ? covering : null
}

/** A 'screen' card covers the stage now: stage changes happen at once (nobody sees them). */
export function isUnderCard(): boolean {
  const { card, phase } = useChapterCard.getState()
  return card?.style === 'screen' && phase === 'on'
}
