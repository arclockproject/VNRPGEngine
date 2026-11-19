// Dev server only: content entries (maps, structures, events, windows, minigames) accept their own
// hot updates and hand the new module to the game (src/core/registry.ts), so saving a map (or its
// Tiled file) updates the running game without a page reload.
import path from 'node:path'
import type { Plugin } from 'vite'

const HOT_KINDS = ['maps', 'structures', 'events', 'windows', 'minigames']
const ENTRY = /\/src\/content\/([a-z]+)\/(.+)\/index(?:\.gen)?\.tsx?$/
/** An event written as one file: events/common/day1.vn -> events/common/day1.gen.ts. */
const FLAT_EVENT = /\/src\/content\/(events)\/((?:[a-z][a-z0-9_]*\/)*[a-z][a-z0-9_]*)\.gen\.ts$/

/** '/…/src/content/maps/countryside/town/index.ts' -> { kind: 'maps', id: 'countryside/town' } */
export function hotEntry(file: string): { kind: string; id: string } | null {
  const clean = file.split(path.sep).join('/').split('?')[0] ?? ''
  const match = ENTRY.exec(clean) ?? FLAT_EVENT.exec(clean)
  if (!match || !HOT_KINDS.includes(match[1] ?? '')) return null
  return { kind: match[1] as string, id: match[2] as string }
}

export function hotContentPlugin(): Plugin {
  return {
    name: 'game-hot-content',
    apply: 'serve',
    transform(code, id) {
      const entry = hotEntry(id)
      if (!entry) return null
      const call = `globalThis.__gameHot?.(${JSON.stringify(entry.kind)}, ${JSON.stringify(entry.id)}, m.default)`
      return {
        code: `${code}\nif (import.meta.hot) import.meta.hot.accept((m) => { if (m) ${call} })\n`,
        map: null,
      }
    },
  }
}
