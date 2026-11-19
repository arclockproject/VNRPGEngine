// Every id a .vn script can use (characters, poses, flags, items, …), read from the project's files
// without running them. The editor extension (tools/vscode-vn) runs this on the open project
// whenever src/content changes, so new content shows up without rebuilding the extension.
// Runs through Node type stripping: no enums, namespaces or parameter properties here.
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { keysOf, topLevelKeys } from '../keys.ts'
import { CONTENT_DIR, INSETS_DIR, scanAudio, scanBackgrounds, scanContent } from '../registry.ts'

export { topLevelKeys }

export interface VnIds {
  characters: string[]
  /** Character -> its poses (expressions or portraits). */
  poses: Record<string, string[]>
  flags: string[]
  items: string[]
  events: string[]
  windows: string[]
  shops: string[]
  enemies: string[]
  /** Named fights (content/troops): `battle` takes them too. */
  troops: string[]
  achievements: string[]
  codex: string[]
  gallery: string[]
  audio: string[]
  /** Voice clips without their language folder: 'town/arrival/anna_0012' (`voice <clip>`). */
  voiceClips?: string[]
  /** Quest -> its step ids. */
  quests: Record<string, string[]>
  /** Gallery picture -> its variant names (layered CGs). */
  cgVariants: Record<string, string[]>
  stages: string[]
  /** src/content/backgrounds: id -> its variant names (bg <id> [variant]). */
  backgrounds?: Record<string, string[]>
  /** src/content/insets: id -> its variant names (inset <id> [variant]). */
  insets?: Record<string, string[]>
  /** src/content/scenes.ts lineStyles: who(thought): … */
  lineStyles?: string[]
  /** src/content/scenes.ts voice.digits: how voice numbers are written (4 = 0012). */
  voiceDigits?: number
  /** src/content/scenes.ts stage.distances: show <who> distance <name>. */
  distances?: string[]
  filters: string[]
  /** Mask transitions (src/content/scenes.ts): bg … with <name>. */
  transitions: string[]
  /** Named moves (src/content/scenes.ts): move <who> <name>. */
  moves?: string[]
  /** Weather kinds (src/content/weather.ts). */
  weather?: string[]
  endings?: string[]
  /** src/content/chapters.ts: chapter <id>. */
  chapters?: string[]
  /** src/content/routes: route <id> in a route script. */
  routes?: string[]
}

const read = (file: string) => (existsSync(file) ? readFileSync(file, 'utf8') : '')

export function collectVnIds(root: string): VnIds {
  const scan = scanContent(root, () => {})
  const content = path.join(root, CONTENT_DIR)
  const poses: Record<string, string[]> = {}
  for (const id of scan.characters) {
    const source = read(path.join(content, 'characters', id, 'index.ts'))
    const expressions = keysOf(source, /\bexpressions\s*:\s*\{/)
    poses[id] = expressions.length ? expressions : keysOf(source, /\bportraits\s*:\s*\{/)
  }
  const quests: Record<string, string[]> = {}
  for (const id of scan.quests) {
    quests[id] = keysOf(read(path.join(content, 'quests', id, 'index.ts')), /\bsteps\s*:\s*\{/)
  }
  const cgVariants: Record<string, string[]> = {}
  for (const id of scan.gallery) {
    cgVariants[id] = keysOf(
      read(path.join(content, 'gallery', id, 'index.ts')),
      /\bvariants\s*:\s*\{/,
    )
  }
  const audio = scanAudio(root, () => {}).map((a) => a.id)
  const voiceClips = [
    ...new Set(
      audio.flatMap((id) => {
        const m = /^voice\/[^/]+\/(.+)$/.exec(id)
        return m ? [m[1] as string] : []
      }),
    ),
  ].sort()
  return {
    characters: scan.characters,
    poses,
    flags: keysOf(read(path.join(content, 'flags.ts')), /defineFlags\(\s*\{/),
    items: scan.items,
    events: scan.events,
    routes: scan.routes,
    windows: scan.windows,
    shops: scan.shops,
    enemies: scan.enemies,
    troops: scan.troops,
    achievements: scan.achievements,
    codex: scan.codex,
    gallery: scan.gallery,
    audio,
    voiceClips,
    quests,
    cgVariants,
    stages: keysOf(read(path.join(content, 'scenes.ts')), /\bpositions\s*:\s*\{/),
    backgrounds: Object.fromEntries(
      scanBackgrounds(root, () => {}).map((b) => [
        b.id,
        // A background with variants lists them in its index.ts (like a gallery picture).
        b.config
          ? keysOf(read(path.join(content, 'backgrounds', b.id, 'index.ts')), /\bvariants\s*:\s*\{/)
          : [],
      ]),
    ),
    insets: Object.fromEntries(
      scanBackgrounds(root, () => {}, undefined, INSETS_DIR).map((b) => [
        b.id,
        b.config
          ? keysOf(read(path.join(content, INSETS_DIR, b.id, 'index.ts')), /\bvariants\s*:\s*\{/)
          : [],
      ]),
    ),
    lineStyles: keysOf(read(path.join(content, 'scenes.ts')), /\blineStyles\s*:\s*\{/),
    voiceDigits: Number(
      /\bvoice\s*:\s*\{[\s\S]*?\bdigits\s*:\s*(\d+)/.exec(
        read(path.join(content, 'scenes.ts')),
      )?.[1] ?? 4,
    ),
    distances: keysOf(read(path.join(content, 'scenes.ts')), /\bdistances\s*:\s*\{/),
    filters: [
      ...new Set([
        ...keysOf(read(path.join(root, 'src/core/scene/filters.ts')), /FILTERS\s*=\s*\{/),
        ...keysOf(read(path.join(content, 'scenes.ts')), /\btints\s*:\s*\{/),
      ]),
    ],
    transitions: keysOf(read(path.join(content, 'scenes.ts')), /\btransitions\s*:\s*\{/),
    moves: keysOf(read(path.join(content, 'scenes.ts')), /\bmoves\s*:\s*\{/),
    weather: keysOf(read(path.join(content, 'weather.ts')), /\bkinds\s*:\s*\{/),
    endings: scan.endings ?? [],
    chapters: keysOf(read(path.join(content, 'chapters.ts')), /\bchapters\s*:\s*\{/),
  }
}
