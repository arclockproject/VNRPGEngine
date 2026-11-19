// Loads an event's pictures before they are needed, like Ren'Py's look-ahead. The build lists each
// event's pictures in script order (vite/media/events.ts); while the event runs, the next
// `preloadAhead` of them (src/content/config/media.ts) are downloaded and decoded, counted from the one
// on screen. Events inside events get their own list; the parent's comes back when they end.
import media from '@/content/config/media'
import { cgPicture, type GalleryConfig, pictureUrls } from '../gallery'
import { lang } from '../lang'
import { isLayered, portraitUrls } from '../portrait/define'
import type { SpinePortrait } from '../portrait/spine'
import {
  backgrounds,
  characters,
  type EventId,
  type EventMedia,
  gallery,
  insets,
  loadEventMedia,
} from '../registry'

interface Running {
  /** Each entry: the URLs one picture needs (a layered CG or a character has several). */
  pictures: string[][]
  /** Index of the picture on screen (-1 = none yet). */
  at: number
}

const stack: Running[] = []
/** Decoded images kept alive while they are in the window ahead. */
const held = new Map<string, HTMLImageElement>()

/** What the look-ahead loads: the player's language's files (the others are never fetched). */
function urlsOf(item: EventMedia): string[] {
  if (item.kind === 'image') return [lang.image(item.url)]
  if (item.kind === 'cg') {
    const picture = (gallery as Record<string, GalleryConfig>)[item.id]
    if (!picture) return []
    return pictureUrls(cgPicture(picture, item.variant, lang.current())).map(lang.image)
  }
  if (item.kind === 'bg' || item.kind === 'inset') {
    const config = (item.kind === 'bg' ? backgrounds : insets)[item.id]
    if (!config) return []
    // Videos stream when shown.
    return pictureUrls(cgPicture(config, item.variant, lang.current()))
      .filter((url) => !/\.(mp4|webm)([?#].*)?$/i.test(url))
      .map(lang.image)
  }
  const character = (characters as Record<string, { portraits?: Record<string, string> }>)[item.id]
  const layered = (character as { layered?: unknown } | undefined)?.layered
  if (isLayered(layered)) return portraitUrls(layered).map(lang.image)
  // A Spine portrait: its atlas pages (the runtime loads the rest when it is first shown).
  const spine = (character as { spine?: SpinePortrait } | undefined)?.spine
  if (spine?.kind === 'spine') return Object.values(spine.data.pages)
  return Object.values(character?.portraits ?? {}).map(lang.image)
}

/** Every portrait image of a character. */
export const characterUrls = (id: string) => urlsOf({ kind: 'character', id })

function load(url: string) {
  if (held.has(url) || typeof Image === 'undefined') return
  const img = new Image()
  img.src = url
  // decode() makes the browser do the slow part now, not when the picture appears.
  img.decode().catch(() => {})
  held.set(url, img)
}

/** Loads the window ahead and lets go of everything else. */
function refresh() {
  const top = stack.at(-1)
  const wanted = new Set<string>()
  if (top) {
    const from = Math.max(0, top.at)
    for (const urls of top.pictures.slice(from, from + 1 + media.events.preloadAhead))
      for (const url of urls) wanted.add(url)
  }
  for (const url of held.keys()) if (!wanted.has(url)) held.delete(url)
  for (const url of wanted) load(url)
}

/** An event starts (also inside another event). */
export async function startEventPreload(id: EventId): Promise<void> {
  const running: Running = { pictures: [], at: -1 }
  stack.push(running)
  try {
    running.pictures = (await loadEventMedia(id)).map(urlsOf).filter((urls) => urls.length > 0)
  } catch {
    // Preloading is a nice-to-have: the pictures still load when shown.
  }
  if (stack.at(-1) === running) refresh()
}

/** That event ended. */
export function endEventPreload(): void {
  stack.pop()
  refresh()
}

/** A background, CG or character is now on screen: move the window to it. */
export function notePictureShown(urls: readonly string[]): void {
  const top = stack.at(-1)
  const first = urls[0]
  if (!top || !first) return
  const index = top.pictures.findIndex((p, i) => i >= top.at && p.includes(first))
  const found = index >= 0 ? index : top.pictures.findIndex((p) => p.includes(first))
  if (found < 0) return
  top.at = found
  refresh()
}

/** For tests. */
export function preloadState() {
  return { held: [...held.keys()], depth: stack.length, at: stack.at(-1)?.at ?? -1 }
}
