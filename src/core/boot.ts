// Boot screens (src/content/boot/*.tsx): notices and logos shown one after another when the game
// starts, before "press any key". Each fades in, plays its steps, fades to black, then the next.
import screen from '@/content/config/screen'
import type { BootConfig } from './define'
import { lang, languageReady } from './lang'
import { useSystemStore } from './stores/system'
import { loadAsset } from './titles'
import { wait } from './wait'

const files = import.meta.glob<{ default: BootConfig }>('../content/boot/*.tsx')

/** A skipped screen fades out at most this slowly. */
const SKIP_FADE_MS = screen.timings.bootSkipFade

const set = useSystemStore.setState
let loaded: BootConfig[] = []
let skipCurrent: (() => void) | undefined

/** Step lengths as a list: `5000` is one step. */
export const stepList = (steps: number | readonly number[] | undefined): readonly number[] =>
  steps === undefined ? [] : typeof steps === 'number' ? [steps] : steps

/** File name without folder and extension; files starting with _ are helpers. */
const nameOf = (path: string) => path.slice(path.lastIndexOf('/') + 1).replace(/\.tsx$/, '')

/** Loads every boot screen and its `preload` files, in playing order. */
export async function loadBootScreens(): Promise<BootConfig[]> {
  const paths = Object.keys(files).filter(
    (path) => !nameOf(path).startsWith('_') && !path.includes('.test.'),
  )
  const modules = await Promise.all(
    paths.map(async (path) => ({ name: nameOf(path), config: (await files[path]?.())?.default })),
  )
  const list = modules
    .filter((m): m is { name: string; config: BootConfig } => {
      if (!m.config) console.warn(`[boot] ${m.name}.tsx has no default export (defineBoot)`)
      return Boolean(m.config)
    })
    .sort((a, b) => (a.config.order ?? 0) - (b.config.order ?? 0) || a.name.localeCompare(b.name))
    .map((m) => m.config)
  // The player's language first, so the screens (and their pictures) show translated at once.
  await languageReady()
  await Promise.all(
    list.flatMap((config) => (config.preload ?? []).map((url) => loadAsset(lang.image(url)))),
  )
  return list
}

/** The boot screen on screen right now (BootLayer draws it). */
export const bootScreenAt = (index: number): BootConfig | undefined => loaded[index]

/** Skips the boot screen on screen if it allows that. True if it did. */
export function skipBootScreen(): boolean {
  if (!skipCurrent) return false
  skipCurrent()
  return true
}

/**
 * Plays the given boot screens in order. Resolves when the last one has faded to black.
 * `alive` is asked before each change: false stops the run (the title screen was hidden).
 */
export async function playBootScreens(list: BootConfig[], alive: () => boolean): Promise<void> {
  loaded = list
  for (const [index, config] of list.entries()) {
    if (!alive()) break
    let skipped = false
    let wake: (() => void) | undefined
    // Waits `ms`, or until this screen is skipped.
    const hold = (ms: number) =>
      new Promise<void>((resolve) => {
        if (skipped) return resolve()
        const timer = setTimeout(resolve, ms)
        wake = () => {
          clearTimeout(timer)
          resolve()
        }
      })
    skipCurrent = config.skippable
      ? () => {
          skipped = true
          wake?.()
        }
      : undefined

    set((s) => {
      s.boot = { index, step: 0, out: false, fade: config.fadeIn }
    })
    await hold(config.fadeIn)
    for (const [step, ms] of stepList(config.steps).entries()) {
      if (skipped || !alive()) break
      set((s) => {
        if (s.boot) s.boot.step = step
      })
      await hold(ms)
    }
    skipCurrent = undefined
    if (!alive()) break
    const fade = skipped ? Math.min(config.fadeOut, SKIP_FADE_MS) : config.fadeOut
    set((s) => {
      if (s.boot) Object.assign(s.boot, { out: true, fade })
    })
    await wait(fade)
  }
  skipCurrent = undefined
  set((s) => {
    s.boot = null
  })
}
