import screen from '@/content/config/screen'
import { systemVoice } from '../audio/systemVoice'
import { loadBootScreens, playBootScreens, skipBootScreen, stepList } from '../boot'
import type { TitleConfig } from '../define'
import { input } from '../input/manager'
import { t } from '../lang'
import { type TitleId, titles } from '../registry'
import { titleBusy, useSystemStore } from '../stores/system'
import {
  currentTitle,
  isTitleUnlocked,
  lockTitle,
  prepareTitle,
  releaseTitles,
  selectTitle,
  unlockedTitles,
  unlockTitle,
  warmTitles,
} from '../titles'
import { wait } from '../wait'

/** Ignore input for a moment so a key still held from before doesn't skip the screen. */
const MIN_SHOW_MS = screen.timings.titleMinShow
const FADE_MS = screen.timings.titleFade

const set = useSystemStore.setState

let resolveMenu: ((index: number | null) => void) | undefined
/** The keys of the menu on screen (the system voice says the picked one). */
let menuKeys: string[] = []
/** Boot screens play once per launch, never again on "Return to title". */
let booted = false
/** Ends the entrance that is playing (skipped = the player asked). */
let endIntro: ((skipped: boolean) => void) | undefined

/** Total length of a title screen's entrance, ms. */
const introMs = (id: TitleId | null): number =>
  stepList(id ? (titles as Record<string, TitleConfig | undefined>)[id]?.intro : undefined).reduce(
    (sum, ms) => sum + ms,
    0,
  )

export const title = {
  /**
   * Plays the boot screens (src/content/boot) one after another, the first time it is called
   * after the game starts; later calls (Return to title) do nothing. Call it before show().
   */
  async boot(): Promise<void> {
    if (booted) return
    booted = true
    set((s) => {
      s.title = 'boot'
      s.titleMenu = null
      s.titleReady = false
      s.boot = null
      s.windows = []
    })
    // The title screen loads behind the boot screens.
    const current = currentTitle()
    if (current) prepareTitle(current).catch(() => {})
    try {
      const screens = await loadBootScreens()
      await playBootScreens(screens, () => useSystemStore.getState().title === 'boot')
    } catch (error) {
      console.error('[boot]', error)
    }
  },

  /**
   * Skips what is playing on the title layer, if it may be skipped: a skippable boot screen, the
   * entrance (the art and the menu jump to their final look), the menu appearing. True if it did.
   */
  skip(): boolean {
    const state = useSystemStore.getState()
    if (!titleBusy(state)) return false
    if (state.title === 'boot') return skipBootScreen()
    if (endIntro) endIntro(true)
    else
      set((s) => {
        s.titleMenuIn = true
      })
    return true
  },

  /**
   * Shows "press any key", then the title screen's entrance; resolves when that is over (or
   * skipped). It stays visible. The current title screen variant is fully loaded first (a dark
   * cover shows meanwhile).
   */
  show(): Promise<void> {
    // The title screen owns the screen (and input) at once, also while it loads. Windows still
    // open here (e.g. a key pressed while the map was unloading opened one) would sit hidden under
    // the title and swallow all input, so close them.
    set((s) => {
      s.title = 'waiting'
      s.titleMenu = null
      s.titleReady = false
      s.titleMenuIn = false
      s.boot = null
      s.windows = []
    })
    let shownAt = Number.POSITIVE_INFINITY
    const current = currentTitle()
    void (current ? prepareTitle(current) : Promise.resolve())
      .catch((error: unknown) => console.error('[title] could not load', current, error))
      .then(() => {
        if (useSystemStore.getState().title === null) return
        shownAt = performance.now()
        set((s) => {
          s.titleReady = true
        })
        void warmTitles() // the other unlocked ones, so switching is instant
      })
    return new Promise((resolve) => {
      const stop = input.onAnyInput(() => {
        if (performance.now() - shownAt < MIN_SHOW_MS) return
        stop()
        if (useSystemStore.getState().title !== 'waiting') return resolve()
        const timer = setTimeout(() => endIntro?.(false), introMs(current))
        endIntro = (skipped) => {
          clearTimeout(timer)
          endIntro = undefined
          set((s) => {
            if (s.title === 'intro') s.title = 'shown'
            if (!skipped) return
            // Skipped: everything is in its final look at once, the menu included.
            s.titleSkips += 1
            s.titleMenuIn = true
          })
          resolve()
        }
        set((s) => {
          s.title = 'intro'
        })
        if (introMs(current) <= 0) endIntro(false)
      })
    })
  },

  /**
   * Shows menu buttons on the title screen; resolves with the chosen key, e.g.
   * `await game.title.menu({ continue: 'Continue', new: 'New game' })`.
   * Resolves with null if the title screen is hidden first (e.g. a save was loaded).
   */
  menu<const T extends Record<string, string>>(options: T): Promise<(keyof T & string) | null> {
    resolveMenu?.(null)
    const keys = Object.keys(options)
    menuKeys = keys
    set((s) => {
      s.title = 'menu'
      s.titleMenu = Object.values(options).map((label) => t(label))
    })
    return new Promise((resolve) => {
      resolveMenu = (index) => {
        resolveMenu = undefined
        set((s) => {
          if (s.title === 'menu') s.title = 'shown'
          s.titleMenu = null
        })
        resolve(index === null ? null : ((keys[index] ?? null) as (keyof T & string) | null))
      }
    })
  },

  /** Fades the title screen out. Resolves when it is gone (right away if it isn't shown). */
  async hide(): Promise<void> {
    if (useSystemStore.getState().title === null) return
    endIntro?.(false)
    resolveMenu?.(null)
    set((s) => {
      s.title = 'leaving'
      s.boot = null
      s.titleMenu = null
    })
    await wait(FADE_MS)
    set((s) => {
      s.title = null
      s.titleReady = false
    })
    releaseTitles() // free the title's pictures for the game
  },

  /**
   * Unlocks a title screen variant for good (all saves) and makes it the current one, e.g. after
   * the good ending: `game.title.unlock('good_ending')`. Already unlocked: nothing changes.
   */
  unlock: (id: TitleId) => unlockTitle(id),
  /** Locks a variant again (dev / testing). */
  lock: (id: TitleId) => lockTitle(id),
  /** Shows this unlocked variant (the player's pick, remembered across saves). */
  select: (id: TitleId) => selectTitle(id),
  /** The variant shown on the title screen. */
  current: () => currentTitle(),
  /** Unlocked variants in switcher order (oldest first). */
  unlocked: () => unlockedTitles(),
  isUnlocked: (id: TitleId) => isTitleUnlocked(id),

  fadeMs: FADE_MS,
}

input.onTitleSkip(() => void title.skip())

/** UI: the menu buttons have finished appearing and can be used now. */
export function titleMenuEntered() {
  set((s) => {
    if (s.title !== null) s.titleMenuIn = true
  })
}

/** UI: the player picked title menu item `index`. */
export function pickTitleMenu(index: number) {
  if (!useSystemStore.getState().titleMenuIn) return // still appearing: not usable yet
  // The system voice says the picked entry's key (src/content/start.ts: new, continue, load…).
  const key = menuKeys[index]
  if (key && resolveMenu) void systemVoice.play(key)
  resolveMenu?.(index)
}
