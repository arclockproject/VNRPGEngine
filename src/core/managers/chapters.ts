// game.chapters: which part of the story the game is in. A label only: it is saved, shown on
// save slots and announced. Chapters: src/content/chapters.ts.
import config from '@/content/chapters'
import type { ChapterCardConfig, ChapterConfig } from '../chapters'
import { t } from '../lang'
import { showChapterCard } from '../scene/chapterCard'
import { isSkippingEffects } from '../scene/playback'
import { isCatchingUp, isFastForward } from '../scene/replay'
import { useGameStore } from '../stores/game'
import { isPersistentFrozen } from '../stores/persistent'
import { toast } from '../ui/toast'

export type ChapterId = Extract<keyof typeof config.chapters, string>

const chapters = config.chapters as Record<string, ChapterConfig>
/** The card when chapters.ts gives no `card`. */
const DEFAULT_CARD: ChapterCardConfig = { ms: 2800, fadeMs: 600, skippable: true }

export const chapterManager = {
  /** The chapter this playthrough is in (the last one reached), or undefined. */
  current(): ChapterId | undefined {
    const id = useGameStore.getState().chapter
    return id && id in chapters ? (id as ChapterId) : undefined
  },

  /**
   * A chapter begins here. Calling it again for the chapter the game is already in does nothing.
   * Returns true when the chapter changed.
   */
  reach(id: ChapterId): boolean {
    if (!(id in chapters)) {
      console.warn(`[chapters] unknown chapter "${id}" (src/content/chapters.ts)`)
      return false
    }
    if (useGameStore.getState().chapter === id) return false
    useGameStore.setState((s) => {
      s.chapter = id
    })
    // A loaded save running its scene again, or a scene looked at through Extras: nothing shown.
    const chapter = chapters[id] as ChapterConfig
    const announce = chapter.announce ?? config.announce
    if (!announce || isFastForward() || isPersistentFrozen()) return true
    const how = announce === true ? 'toast' : announce
    if (how === 'toast' || how === 'both')
      toast(chapterManager.fullTitle(id) as string, { kind: 'chapter', params: { chapter: id } })
    // The card: not while skipping (the player wants to get on), and not on the way to the line a
    // loaded save was made at (the player saw it before saving).
    if ((how === 'card' || how === 'both') && !isSkippingEffects() && !isCatchingUp()) {
      const card = { ...DEFAULT_CARD, ...config.card, ...chapter.card }
      showChapterCard({
        ...card,
        label: chapterManager.label(id) as string,
        title: t(chapter.title),
        ...(chapter.description ? { description: t(chapter.description) } : {}),
        ...(chapter.image ? { image: chapter.image } : {}),
        ...(chapter.screen ? { screen: chapter.screen } : {}),
      })
    }
    return true
  },

  /** "Chapter 1.2" / "Prologue" (translated), or undefined for an unknown id. */
  label(id: string | null | undefined): string | undefined {
    const c = id ? chapters[id] : undefined
    if (!c) return undefined
    return chapterManager.numberLabel(c.number, c.sub)
  },

  /** "Chapter 1" (no sub: the flowchart's heading for every 1.x) or "Chapter 1.2" (translated). */
  numberLabel(number: number, sub?: number): string {
    const s = sub !== undefined ? `.${sub}` : ''
    const named = (config.vn_chapters as Partial<Record<number, string>>)[number]
    if (named) return t(named) + s
    return t(config.label, { number: `${number}${s}` })
  },

  /** "Chapter 1.2: The town" (translated): saves and the toast. */
  fullTitle(id: string | null | undefined): string | undefined {
    const c = id ? chapters[id] : undefined
    if (!c) return undefined
    return t(config.full, { label: chapterManager.label(id) as string, title: t(c.title) })
  },

  /** A chapter's title and description (untranslated), or undefined for an unknown id. */
  info(id: string | null | undefined): ChapterConfig | undefined {
    return id ? chapters[id] : undefined
  },
}
