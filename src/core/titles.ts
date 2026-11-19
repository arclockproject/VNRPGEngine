// Title screen variants (src/content/titles/<id>): which are unlocked, which one shows, and
// loading everything a variant needs before it appears.
import type { ComponentType } from 'react'
import { audio } from './audio/manager'
import type { TitleConfig, TitleScreenProps } from './define'
import { lang } from './lang'
import { registry, type TitleId, titleAssets, titles } from './registry'
import { isUnlocked, usePersistentStore } from './stores/persistent'
import { unlockable, unlockKey } from './unlocks'

const config = (id: TitleId): TitleConfig | undefined =>
  (titles as Record<string, TitleConfig | undefined>)[id]

/** Every title screen in switcher order (oldest first). */
export function allTitles(): TitleId[] {
  return [...registry.titles].sort(
    (a, b) => (config(a)?.order ?? 0) - (config(b)?.order ?? 0) || a.localeCompare(b),
  )
}

/** Unlocked: by game.title.unlock, `unlocked: true`, or the first one when none says so. */
export function isTitleUnlocked(id: TitleId): boolean {
  const title = config(id)
  if (!title) return false
  if (title.unlocked || isUnlocked(unlockKey.title(id))) return true
  return !registry.titles.some((other) => config(other)?.unlocked) && allTitles()[0] === id
}

const unlocks = unlockable<TitleId>({
  name: 'title screen',
  exists: (id) => config(id) !== undefined,
  store: {
    has: isTitleUnlocked,
    // A new title screen becomes the current one (a new ending changes the title).
    add: (id) =>
      usePersistentStore.setState((s) => {
        s.unlocked[unlockKey.title(id)] = true
        s.titleScreen = id
      }),
    remove: (id) =>
      usePersistentStore.setState((s) => {
        delete s.unlocked[unlockKey.title(id)]
        if (s.titleScreen === id) delete s.titleScreen
      }),
  },
})

export const unlockedTitles = (): TitleId[] => allTitles().filter(isTitleUnlocked)

/** The one to show: the player's pick, or the newest unlocked. Null when there are none. */
export function currentTitle(): TitleId | null {
  const picked = usePersistentStore.getState().titleScreen as TitleId | undefined
  if (picked && isTitleUnlocked(picked)) return picked
  return unlockedTitles().at(-1) ?? null
}

/**
 * Unlocks a title screen for good and makes it the current one (a new ending changes the title).
 * Already unlocked: nothing changes, so reaching an ending again keeps the player's own pick.
 */
export function unlockTitle(id: TitleId): void {
  unlocks.unlock(id)
}

/** Dev / testing: locks it again (titles with `unlocked: true` stay). */
export function lockTitle(id: TitleId): void {
  unlocks.lock(id)
}

/** The player picks an unlocked title screen (remembered across saves). */
export function selectTitle(id: TitleId): void {
  if (!isTitleUnlocked(id)) return
  usePersistentStore.setState((s) => {
    s.titleScreen = id
  })
}

/** Picks the next (`by` 1) or previous (-1) unlocked title screen, wrapping around. */
export function stepTitle(by: number): void {
  const list = unlockedTitles()
  const current = currentTitle()
  if (list.length < 2 || !current) return
  const next = list[(list.indexOf(current) + by + list.length) % list.length]
  if (next) selectTitle(next)
}

// ---------------------------------------------------------------- preloading

type Screen = ComponentType<TitleScreenProps>
const preparing = new Map<TitleId, Promise<Screen>>()
const ready = new Map<TitleId, Screen>()
/** Loaded files, kept referenced (and decoded) while the title screen is up. */
const held = new Map<string, unknown>()

/** Waiting for one file never blocks the title for longer than this. */
const ASSET_TIMEOUT_MS = 15_000
const IMAGE = /^data:image\/|\.(png|jpe?g|webp|avif|gif|svg)(\?|#|$)/i
const VIDEO = /^data:video\/|\.(mp4|webm|mov|m4v)(\?|#|$)/i
const AUDIO = /^data:audio\/|\.(ogg|oga|mp3|wav|flac|opus|m4a|aac)(\?|#|$)/i

function withTimeout(promise: Promise<unknown>): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ASSET_TIMEOUT_MS)
    promise.then(
      () => {
        clearTimeout(timer)
        resolve()
      },
      () => {
        clearTimeout(timer)
        resolve() // a missing file shows as missing; it must not stop the title screen
      },
    )
  })
}

function mediaReady(element: HTMLMediaElement): Promise<void> {
  return new Promise((resolve, reject) => {
    element.addEventListener('canplaythrough', () => resolve(), { once: true })
    element.addEventListener('error', () => reject(element.error), { once: true })
    element.preload = 'auto'
    element.load()
  })
}

/** Downloads one file and decodes it (images) or buffers it (sound, video). */
export function loadAsset(url: string): Promise<void> {
  if (held.has(url)) return Promise.resolve()
  if (IMAGE.test(url) && typeof Image !== 'undefined') {
    const img = new Image()
    img.src = url
    held.set(url, img)
    return withTimeout(img.decode())
  }
  const media =
    VIDEO.test(url) && typeof document !== 'undefined'
      ? document.createElement('video')
      : AUDIO.test(url) && typeof Audio !== 'undefined'
        ? new Audio()
        : null
  if (media) {
    media.muted = true
    media.src = url
    held.set(url, media)
    return withTimeout(mediaReady(media))
  }
  held.set(url, true)
  return typeof fetch === 'undefined' ? Promise.resolve() : withTimeout(fetch(url))
}

/**
 * Loads a title screen's code and every file it needs (its folder, `preload`, `music`) and
 * decodes the pictures. Resolves with the screen component; safe to call again.
 */
export function prepareTitle(id: TitleId): Promise<Screen> {
  let promise = preparing.get(id)
  if (promise) return promise
  const title = config(id)
  if (!title) return Promise.reject(new Error(`Unknown title screen "${id}"`))
  const urls = [...(titleAssets[id] ?? []), ...(title.preload ?? [])]
  promise = Promise.all([
    title.screen(),
    // A language may swap a picture (a translated logo): load the one that will show.
    ...urls.map((url) => loadAsset(lang.image(url))),
    title.music ? withTimeout(audio.preload([title.music])) : undefined,
    typeof document !== 'undefined' && document.fonts
      ? withTimeout(document.fonts.ready)
      : undefined,
  ]).then(([module]) => {
    ready.set(id, module.default)
    return module.default
  })
  promise.catch(() => preparing.delete(id))
  preparing.set(id, promise)
  return promise
}

/** The screen component if prepareTitle finished, so it can draw at once. */
export const readyTitle = (id: TitleId): Screen | undefined => ready.get(id)

/** Prepares every other unlocked title in the background, one at a time (instant switching). */
export async function warmTitles(): Promise<void> {
  for (const id of unlockedTitles()) await prepareTitle(id).catch(() => {})
}

/** The title screen is gone: let go of its pictures, sounds and videos. */
export function releaseTitles(): void {
  for (const value of held.values())
    if (typeof HTMLMediaElement !== 'undefined' && value instanceof HTMLMediaElement) {
      value.removeAttribute('src')
      value.load()
    }
  held.clear()
  preparing.clear()
  ready.clear()
}

/** Title screens that set their own music (others then stop it, so a switch never keeps the wrong song). */
export const titlesHaveMusic = () => registry.titles.some((id) => config(id)?.music)
