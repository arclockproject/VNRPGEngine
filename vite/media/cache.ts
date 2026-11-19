// Shared helpers for vite/media: rule matching, the conversion cache, and "one job per file".
import { createHash } from 'node:crypto'
import path from 'node:path'
import sharp from 'sharp'

/** The first rule matching `relative` (a path inside src/content, with / separators). */
export function pickRule<R extends { match: string }>(
  rules: readonly R[],
  relative: string,
): R | undefined {
  return rules.find((rule) => path.posix.matchesGlob(relative, rule.match))
}

const running = new Map<string, Promise<string>>()

/** Runs `make` once per key at a time (Vite resolves the same file from many importers at once). */
export function once(key: string, make: () => Promise<string>): Promise<string> {
  let promise = running.get(key)
  if (!promise) {
    promise = make().finally(() => running.delete(key))
    running.set(key, promise)
  }
  return promise
}

/** Cache folder for this input + settings (a change in either makes a new one). */
export function cacheDirFor(cacheDir: string, input: Buffer, settings: unknown): string {
  const hash = createHash('sha1')
    .update(input)
    .update(JSON.stringify(settings))
    .update(sharp.versions.vips ?? '')
    .digest('hex')
    .slice(0, 16)
  return path.join(cacheDir, hash)
}
