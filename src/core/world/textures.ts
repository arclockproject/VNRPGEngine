// Keeps map images (tilesets, sprite sheets) within a memory budget. The current map's images are
// "in use" and never freed; images of maps left earlier stay loaded until they don't fit the budget
// (src/content/config/media.ts images.memoryMB), then the least recently used go first.
import { Assets, type Texture } from 'pixi.js'
import media from '@/content/config/media'
import { isAndroid, isElectron } from '../platform'

/** url -> bytes, oldest first. */
const loaded = new Map<string, number>()
let inUse = new Set<string>()

function bytesOf(url: string): number {
  const texture = Assets.cache.has(url) ? Assets.get<Texture>(url) : undefined
  const source = texture?.source
  return source ? source.pixelWidth * source.pixelHeight * 4 : 0
}

export function budgetBytes(): number {
  const { memoryMB } = media.images
  const mb = isElectron ? memoryMB.desktop : isAndroid ? memoryMB.mobile : memoryMB.browser
  return mb * 1024 * 1024
}

/** Call after Assets.load: marks these images as just used. */
export function noteLoaded(urls: Iterable<string>): void {
  for (const url of urls) {
    loaded.delete(url)
    loaded.set(url, bytesOf(url))
  }
}

/** The images the map on screen needs (replaces the previous set). */
export function setInUse(urls: Iterable<string>): void {
  inUse = new Set(urls)
  noteLoaded(inUse)
}

/** More images the map on screen needs (a structure or prop added while playing). */
export function addInUse(urls: Iterable<string>): void {
  for (const url of urls) inUse.add(url)
  noteLoaded(urls)
}

/** Frees the least recently used images not in use until the rest fits `budget` bytes. */
export function trim(budget = budgetBytes()): string[] {
  let spare = 0
  for (const [url, bytes] of loaded) if (!inUse.has(url)) spare += bytes
  const freed: string[] = []
  for (const [url, bytes] of loaded) {
    if (spare <= budget) break
    if (inUse.has(url)) continue
    loaded.delete(url)
    spare -= bytes
    freed.push(url)
    // Sprites still holding sub-textures of it are gone with the old map (World.clear).
    if (Assets.cache.has(url)) void Assets.unload(url)
  }
  return freed
}

/** For tests and the debug overlay. */
export function textureStats() {
  let total = 0
  for (const bytes of loaded.values()) total += bytes
  return { images: loaded.size, inUse: inUse.size, bytes: total }
}

export function resetTextures(): void {
  loaded.clear()
  inUse = new Set()
}
