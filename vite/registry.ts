// Content registry generator.
// Scans src/content/<kind>/<name>/index.ts(x) and writes src/generated/registry.gen.ts,
// which gives the game both the loaders and the TypeScript types for every entry.
// Grouped kinds may nest: events/anna/flashback/index.ts becomes the id 'anna/flashback'.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'
import { missingContentMessage, REQUIRED_WINDOWS } from '../src/core/required.ts'
import { contentLanguages } from './aseprite/lang.ts'
import { type DevStartMarker, scanDevStarts } from './devStart.ts'
import { keysOf } from './keys.ts'
import { isVariantName, variantValues } from './variants.ts'

export const CONTENT_DIR = 'src/content'
export const OUTPUT_FILE = 'src/generated/registry.gen.ts'

/**
 * Lazy kinds are loaded on first use (code-split). Eager kinds are bundled up front.
 * `grouped` kinds allow group folders: a folder without an index file whose subfolders are entries.
 */
export const KINDS = [
  { kind: 'maps', exportName: 'mapLoaders', eager: false, grouped: true },
  { kind: 'events', exportName: 'eventLoaders', eager: false, grouped: true },
  { kind: 'minigames', exportName: 'minigameLoaders', eager: false, grouped: false },
  { kind: 'windows', exportName: 'windowLoaders', eager: false, grouped: true },
  { kind: 'structures', exportName: 'structureLoaders', eager: false, grouped: true },
  { kind: 'characters', exportName: 'characters', eager: true, grouped: false },
  { kind: 'items', exportName: 'items', eager: true, grouped: false },
  { kind: 'quests', exportName: 'quests', eager: true, grouped: false },
  { kind: 'props', exportName: 'props', eager: true, grouped: true },
  { kind: 'gallery', exportName: 'gallery', eager: true, grouped: false },
  { kind: 'movies', exportName: 'movies', eager: true, grouped: false },
  { kind: 'endings', exportName: 'endings', eager: true, grouped: false },
  { kind: 'shops', exportName: 'shops', eager: true, grouped: false },
  { kind: 'achievements', exportName: 'achievements', eager: true, grouped: false },
  { kind: 'codex', exportName: 'codex', eager: true, grouped: false },
  { kind: 'enemies', exportName: 'enemies', eager: true, grouped: false },
  { kind: 'skills', exportName: 'skills', eager: true, grouped: false },
  { kind: 'troops', exportName: 'troops', eager: true, grouped: false },
  { kind: 'titles', exportName: 'titles', eager: true, grouped: false },
  { kind: 'routes', exportName: 'routeLoaders', eager: false, grouped: false },
  { kind: 'lang', exportName: 'langLoaders', eager: false, grouped: false },
] as const

export type Kind = (typeof KINDS)[number]['kind']
export type ContentScan = Record<Kind, string[]> & {
  audio?: AudioFile[]
  backgrounds?: BackgroundFile[]
  /** src/content/insets: pictures in a frame in the middle of the screen (inset()), like backgrounds. */
  insets?: BackgroundFile[]
  migrations?: number[]
  /** Dev start marker (@start / devStart()) in an event, or null (vite/devStart.ts). */
  devStart?: DevStartMarker | null
  /** Media files inside each title screen folder (preloaded before it shows). */
  titleAssets?: Record<string, string[]>
  /** Quest id -> its step ids, read from the quest file's `steps: { … }`. */
  questSteps?: Record<string, string[]>
  /** Route id -> the node keys of its `event('id', 'key')` calls (index.ts or index.vn). */
  routeKeys?: Record<string, string[]>
  /** Routes with a flow.ts next to their index file. */
  routeFlows?: string[]
  /** "kind/id" of entries written as index.vn (imported from their generated index.gen.ts). */
  vn?: string[]
  /** "events/id" of events written as one file, <name>.vn (imported from <name>.gen.ts). */
  flatVn?: string[]
}

/** Each folder name in an id, e.g. 'sudden_encounter_4'. Ids join them with '/'. */
const NAME_PATTERN = /^[a-z][a-z0-9_]*$/
const ENTRY_FILES = ['index.ts', 'index.tsx']
/** Events and routes may also be a script (compiled by vite/vn to index.gen.ts). */
const VN_ENTRY = 'index.vn'
/** Group folders may nest this deep (anna/act1/scene2 = 3). */
const MAX_GROUP_DEPTH = 4

function isEntry(dir: string, kind: string) {
  return (
    ENTRY_FILES.some((file) => existsSync(path.join(dir, file))) ||
    ((kind === 'events' || kind === 'routes') && existsSync(path.join(dir, VN_ENTRY)))
  )
}

const isVnOnly = (dir: string) =>
  existsSync(path.join(dir, VN_ENTRY)) && !ENTRY_FILES.some((f) => existsSync(path.join(dir, f)))

export function scanContent(root: string, warn: (message: string) => void = console.warn) {
  const scan = {} as ContentScan
  // "park.adult.vn", "park.adult/": a version of park for a content variant (vite/variants.ts).
  const versions = variantValues(root)
  const vn: string[] = []
  const flatVn: string[] = []
  for (const { kind, grouped } of KINDS) {
    const ids: string[] = []

    const walk = (dir: string, prefix: string[]) => {
      const entries = readdirSync(dir, { withFileTypes: true })
      // Events may be one file each: day1_morning.vn in a group folder (or right in events/).
      if (kind === 'events') {
        for (const entry of entries) {
          if (!entry.isFile() || !entry.name.endsWith('.vn') || entry.name === VN_ENTRY) continue
          const name = entry.name.slice(0, -3)
          if (name.startsWith('_') || name.startsWith('.')) continue
          if (isVariantName(name, versions)) continue
          const label = `${kind}/${[...prefix, entry.name].join('/')}`
          if (!NAME_PATTERN.test(name)) {
            warn(
              `[registry] ${label}: use lowercase letters, digits and _ (starting with a letter), skipped`,
            )
          } else if (entries.some((e) => e.isDirectory() && e.name === name)) {
            warn(`[registry] ${label}: the folder "${name}" next to it has the same name, skipped`)
          } else {
            ids.push([...prefix, name].join('/'))
            flatVn.push(`${kind}/${[...prefix, name].join('/')}`)
          }
        }
      }
      for (const entry of entries) {
        const name = entry.name
        // Folders starting with _ or . are for shared helpers, not entries.
        if (!entry.isDirectory() || name.startsWith('_') || name.startsWith('.')) continue
        if (isVariantName(name, versions)) continue
        const segments = [...prefix, name]
        const label = `${kind}/${segments.join('/')}`
        if (!NAME_PATTERN.test(name)) {
          warn(
            `[registry] ${label}: use lowercase letters, digits and _ (starting with a letter), skipped`,
          )
          continue
        }
        const full = path.join(dir, name)
        if (isEntry(full, kind)) {
          // An entry's own subfolders (art, helpers) are never scanned for more entries.
          ids.push(segments.join('/'))
          if (isVnOnly(full)) vn.push(`${kind}/${segments.join('/')}`)
        } else if (!grouped) {
          warn(`[registry] ${label} has no index.ts or index.tsx, skipped`)
        } else if (segments.length >= MAX_GROUP_DEPTH) {
          warn(`[registry] ${label}: groups can nest at most ${MAX_GROUP_DEPTH - 1} deep, skipped`)
        } else {
          const before = ids.length
          walk(full, segments)
          if (ids.length === before) {
            warn(`[registry] ${label} has no index.ts(x) and no entries inside, skipped`)
          }
        }
      }
    }

    const dir = path.join(root, CONTENT_DIR, kind)
    if (existsSync(dir)) walk(dir, [])
    scan[kind] = ids.sort()
  }
  if (vn.length) scan.vn = vn.sort()
  if (flatVn.length) scan.flatVn = flatVn.sort()
  return scan
}

/** 'anna/flashback' -> 'anna__flashback' (for import names). */
const identifier = (id: string) => id.replaceAll('/', '__')
/** Object keys: bare when possible, quoted when the id contains '/'. */
const key = (id: string) => (id.includes('/') ? `'${id}'` : id)

export function renderRegistry(scan: ContentScan): string {
  const lines = [
    '// AUTO-GENERATED by vite/registry.ts. Do not edit.',
    '// Add or remove folders in src/content/ and this file updates itself.',
    '',
  ]
  const vn = new Set(scan.vn ?? [])
  const flat = new Set(scan.flatVn ?? [])
  const from = (kind: string, id: string) =>
    `@/content/${kind}/${id}${flat.has(`${kind}/${id}`) ? '.gen' : vn.has(`${kind}/${id}`) ? '/index.gen' : ''}`
  for (const { kind, eager } of KINDS) {
    if (!eager) continue
    for (const id of scan[kind]) {
      lines.push(`import ${kind}_${identifier(id)} from '${from(kind, id)}'`)
    }
  }
  if (lines.length > 3) lines.push('')

  for (const { kind, exportName, eager } of KINDS) {
    lines.push(`export const ${exportName} = {`)
    for (const id of scan[kind]) {
      lines.push(
        eager
          ? `  ${key(id)}: ${kind}_${identifier(id)},`
          : `  ${key(id)}: () => import('${from(kind, id)}'),`,
      )
    }
    lines.push('} as const', '')
  }

  // Plain id unions, so content can use the Game type without a type cycle (codex `when`).
  lines.push('export type ContentIds = {')
  for (const { kind } of KINDS) {
    const ids = scan[kind].map((id) => `'${id}'`).join(' | ') || 'never'
    lines.push(`  ${kind}: ${ids}`)
  }
  lines.push('}', '')

  // Step ids per quest as plain unions too (a quest step's `when` takes `game`).
  lines.push('export type QuestStepIds = {')
  for (const id of scan.quests) {
    const steps = (scan.questSteps?.[id] ?? []).map((step) => `'${step}'`).join(' | ') || 'string'
    lines.push(`  ${id}: ${steps}`)
  }
  lines.push('}', '')

  // Node keys of each route, read from its event('id', 'key') calls (flow.ts is typed from these).
  lines.push('export type RouteKeys = {')
  for (const id of scan.routes) {
    const keys = (scan.routeKeys?.[id] ?? []).map((k) => `'${k}'`).join(' | ') || 'never'
    lines.push(`  ${id}: ${keys}`)
  }
  lines.push('}', '')
  // Each route's optional flow.ts (titles, descriptions, pictures, sets / before for the flowchart).
  lines.push('export const routeFlowLoaders = {')
  for (const id of scan.routeFlows ?? []) {
    lines.push(`  ${key(id)}: () => import('@/content/routes/${id}/flow'),`)
  }
  lines.push('} as const', '')

  // Audio: importing a sound file only gives its URL; nothing is downloaded until it plays.
  const audio = scan.audio ?? []
  for (const { id, file } of audio) {
    lines.push(`import audio_${identifier(id)} from '@/content/${AUDIO_DIR}/${file}'`)
  }
  lines.push('export const audioFiles = {')
  for (const { id } of audio) lines.push(`  '${id}': audio_${identifier(id)},`)
  lines.push('} as const', '')
  // Their versions per language (hello.ja.wav): only files that exist are listed.
  const versions = audio.flatMap(({ id, langs }) =>
    (langs ?? []).map(({ lang, file }) => ({ id, lang, file })),
  )
  for (const { id, lang, file } of versions) {
    lines.push(`import audio_${identifier(id)}__${lang} from '@/content/${AUDIO_DIR}/${file}'`)
  }
  lines.push('/** Sound id -> language -> its file in that language ("<name>.<lang>.<ext>"). */')
  lines.push('export const audioLangs: Record<string, Record<string, string>> = {')
  for (const { id, langs } of audio) {
    if (!langs?.length) continue
    const entries = langs.map(({ lang }) => `${lang}: audio_${identifier(id)}__${lang}`)
    lines.push(`  '${id}': { ${entries.join(', ')} },`)
  }
  lines.push('}', '')
  // Versions per VOICE language (music/ja/town.ogg), picked at play time in the player's order.
  for (const { id, voiceLangs } of audio)
    for (const { lang, file } of voiceLangs ?? [])
      lines.push(
        `import audio_${identifier(id)}__voice_${lang} from '@/content/${AUDIO_DIR}/${file}'`,
      )
  lines.push('/** Sound id -> voice language -> its file (music/<voice language>/<name>.<ext>). */')
  lines.push('export const audioVoiceLangs: Record<string, Record<string, string>> = {')
  for (const { id, voiceLangs } of audio) {
    if (!voiceLangs?.length) continue
    const entries = voiceLangs.map(({ lang }) => `${lang}: audio_${identifier(id)}__voice_${lang}`)
    lines.push(`  '${id}': { ${entries.join(', ')} },`)
  }
  lines.push('}', '')

  // Backgrounds: a plain picture (its URL), or a folder with variants (its index.ts, eager like
  // the gallery: it only holds URLs).
  const backgrounds = scan.backgrounds ?? []
  for (const { id, file } of backgrounds) {
    const from = file ?? `${id}/index`
    lines.push(`import bg_${identifier(id)} from '@/content/${BACKGROUNDS_DIR}/${from}'`)
  }
  lines.push('/** Background id -> its picture, or its variants (src/content/backgrounds). */')
  lines.push('export const backgrounds = {')
  for (const { id, file } of backgrounds) {
    const name = `bg_${identifier(id)}`
    lines.push(`  '${id}': ${file ? `{ image: ${name} }` : name},`)
  }
  lines.push('} as const', '')

  // Insets (inset()): pictures in a frame over the background, made like backgrounds.
  const insets = scan.insets ?? []
  for (const { id, file } of insets) {
    const from = file ?? `${id}/index`
    lines.push(`import inset_${identifier(id)} from '@/content/${INSETS_DIR}/${from}'`)
  }
  lines.push('/** Inset id -> its picture, or its variants (src/content/insets). */')
  lines.push('export const insets = {')
  for (const { id, file } of insets) {
    const name = `inset_${identifier(id)}`
    lines.push(`  '${id}': ${file ? `{ image: ${name} }` : name},`)
  }
  lines.push('} as const', '')

  // Dev start marker: the dev server opens straight at it (src/core/dev/start.ts). Builds refuse it.
  lines.push(
    '/** Dev start marker (@start in a .vn event, devStart() in a .ts one), or null. */',
    `export const devStart = ${JSON.stringify(scan.devStart ?? null)} as {
  event: string
  at: string
  box?: string
  way?: (string | boolean)[]
} | null`,
    '',
  )

  // Title screens: every media file in a title's folder, loaded before that title shows.
  const titleAssets = scan.titleAssets ?? {}
  const assetLines: string[] = []
  let assetIndex = 0
  for (const id of Object.keys(titleAssets).sort()) {
    const names = (titleAssets[id] ?? []).map((file) => {
      const name = `title_asset_${assetIndex++}`
      lines.push(`import ${name} from '@/content/${TITLES_DIR}/${id}/${file}'`)
      return name
    })
    assetLines.push(`  ${key(id)}: [${names.join(', ')}],`)
  }
  lines.push('export const titleAssets: Record<string, readonly string[]> = {', ...assetLines)
  lines.push('}', '')

  // Save migrations: v2.ts upgrades a version 1 save to version 2, and so on.
  const migrations = scan.migrations ?? []
  for (const version of migrations) {
    lines.push(`import migration_${version} from '@/content/${MIGRATIONS_DIR}/v${version}'`)
  }
  lines.push(
    '/** Upgrades from version N-1 to N. The current save version is the highest N (or 1). */',
  )
  lines.push('export const saveMigrations = {')
  for (const version of migrations) lines.push(`  ${version}: migration_${version},`)
  lines.push('} as const', '')
  return lines.join('\n')
}

// ---------------------------------------------------------------- save migrations

export const MIGRATIONS_DIR = 'save/migrations'

/** Finds src/content/save/migrations/v<N>.ts files. Returns the versions, sorted. */
export function scanMigrations(root: string, warn: (message: string) => void = console.warn) {
  const dir = path.join(root, CONTENT_DIR, MIGRATIONS_DIR)
  if (!existsSync(dir)) return []
  const versions: number[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || entry.name.endsWith('.test.ts')) continue
    const match = /^v(\d+)\.ts$/.exec(entry.name)
    if (!match) {
      warn(
        `[registry] ${MIGRATIONS_DIR}/${entry.name}: migration files must be named v2.ts, v3.ts, …`,
      )
      continue
    }
    const version = Number(match[1])
    if (version < 2) {
      warn(`[registry] ${MIGRATIONS_DIR}/${entry.name}: the first migration is v2 (from version 1)`)
      continue
    }
    versions.push(version)
  }
  versions.sort((a, b) => a - b)
  versions.forEach((version, i) => {
    if (version !== i + 2) warn(`[registry] ${MIGRATIONS_DIR}: v${i + 2}.ts is missing`)
  })
  return versions
}

// ---------------------------------------------------------------- title screen assets

export const TITLES_DIR = 'titles'
/** Files a title screen may show or play. Source files (.aseprite, .ts) are not listed. */
const TITLE_ASSET = /\.(png|jpe?g|webp|avif|gif|svg|ogg|oga|mp3|wav|flac|opus|m4a|aac|mp4|webm)$/i

/** For each title screen folder: its media files (paths inside the folder, sorted). */
export function scanTitleAssets(root: string, ids: readonly string[]): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  // logo.cn.png: a content variant's version of logo.png (vite/variants.ts swaps it in), not a file
  // of its own (listing it would ship every version).
  const variantNames = variantValues(root)
  for (const id of ids) {
    const files: string[] = []
    const walk = (dir: string, prefix: string[]) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue
        const segments = [...prefix, entry.name]
        if (entry.isDirectory()) walk(path.join(dir, entry.name), segments)
        else if (
          TITLE_ASSET.test(entry.name) &&
          !isVariantName(entry.name.replace(/\.[^.]+$/, ''), variantNames)
        )
          files.push(segments.join('/'))
      }
    }
    walk(path.join(root, CONTENT_DIR, TITLES_DIR, id), [])
    result[id] = files.sort()
  }
  return result
}

// ---------------------------------------------------------------- audio

/** src/content/audio/music/town.ogg -> id 'music/town'. */
export const AUDIO_DIR = 'audio'
// Keep in step with AUDIO_FILE in vite/media/audio.ts (what the build converts).
const AUDIO_EXTENSIONS = [
  '.ogg',
  '.oga',
  '.mp3',
  '.wav',
  '.aif',
  '.aiff',
  '.m4a',
  '.aac',
  '.mp4',
  '.flac',
  '.opus',
  '.webm',
]

export interface AudioFile {
  id: string
  /** Path inside src/content/audio, with extension. */
  file: string
  /** Versions per language: "<name>.<lang>.<ext>" next to the file (hello.ja.wav). */
  langs?: { lang: string; file: string }[]
  /**
   * Versions per VOICE language, from language folders: music/ja/town.ogg is 'music/town' in
   * Japanese. In the order of src/content/scenes.ts voice.languages.
   */
  voiceLangs?: { lang: string; file: string }[]
}

/** src/content/scenes.ts voice.languages, read from its text (first = default). */
export function voiceLanguages(root: string): string[] {
  const file = path.join(root, CONTENT_DIR, 'scenes.ts')
  if (!existsSync(file)) return []
  const source = readFileSync(file, 'utf8')
  const at = source.search(/\bvoice\s*:\s*\{/)
  const list = /\blanguages\s*:\s*\[([^\]]*)\]/.exec(at === -1 ? '' : source.slice(at))?.[1] ?? ''
  return [...list.matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1] as string)
}

/** Top folders of src/content/audio whose sounds may come in voice-language folders. */
export const VOICE_LANGUAGE_AUDIO = ['music']

export function scanAudio(
  root: string,
  warn: (message: string) => void = console.warn,
  langs: readonly string[] = contentLanguages(root),
  voiceLangs: readonly string[] = voiceLanguages(root),
) {
  // music/<voice language>/town.ogg: 'music/town' in that language (picked at play time).
  const byVoice: { id: string; lang: string; file: string }[] = []
  const files: AudioFile[] = []
  const seen = new Map<string, string>()
  const versions: { id: string; lang: string; file: string }[] = []
  const variantNames = variantValues(root)
  const walk = (dir: string, prefix: string[], voiceLang?: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue
      if (
        entry.isDirectory() &&
        !voiceLang &&
        prefix.length === 1 &&
        VOICE_LANGUAGE_AUDIO.includes(prefix[0] as string) &&
        voiceLangs.includes(entry.name)
      ) {
        walk(path.join(dir, entry.name), prefix, entry.name)
        continue
      }
      if (entry.isDirectory()) {
        if (!NAME_PATTERN.test(entry.name)) {
          warn(`[registry] audio/${[...prefix, entry.name].join('/')}: bad folder name, skipped`)
        } else {
          walk(path.join(dir, entry.name), [...prefix, entry.name], voiceLang)
        }
        continue
      }
      const ext = path.extname(entry.name).toLowerCase()
      if (!AUDIO_EXTENSIONS.includes(ext)) continue
      const base = entry.name.slice(0, -ext.length)
      // hello.cn.wav: hello.wav in a content variant (vite/variants.ts swaps it in). hello.cn.ja.wav
      // is reached through hello.ja.wav, so that one must be there too.
      if (isVariantName(base, variantNames)) {
        const parts = base.split('.')
        const lang = parts.at(-1) as string
        const plain = `${parts[0]}.${lang}${ext}`
        if (langs.includes(lang) && !existsSync(path.join(dir, plain)))
          warn(
            `[registry] audio/${[...prefix, entry.name].join('/')}: add ${plain} next to it (the ${lang} version of the plain sound), or it is never played`,
          )
        continue
      }
      if (voiceLang) {
        const inFolder = path.relative(
          path.join(root, CONTENT_DIR, AUDIO_DIR),
          path.join(dir, entry.name),
        )
        if (!NAME_PATTERN.test(base))
          warn(
            `[registry] audio/${inFolder}: use lowercase letters, digits and _ for file names, skipped`,
          )
        else
          byVoice.push({
            id: [...prefix, base].join('/'),
            lang: voiceLang,
            file: inFolder.split(path.sep).join('/'),
          })
        continue
      }
      const file = [...prefix, entry.name].join('/')
      // hello.ja.wav: hello.wav in Japanese.
      const dot = base.lastIndexOf('.')
      const lang = dot > 0 ? base.slice(dot + 1) : ''
      if (langs.includes(lang) && NAME_PATTERN.test(base.slice(0, dot))) {
        versions.push({ id: [...prefix, base.slice(0, dot)].join('/'), lang, file })
        continue
      }
      if (!NAME_PATTERN.test(base)) {
        warn(
          `[registry] audio/${file}: use lowercase letters, digits and _ for file names, skipped`,
        )
        continue
      }
      const id = [...prefix, base].join('/')
      const existing = seen.get(id)
      if (existing) {
        warn(`[registry] audio/${file}: "${id}" already comes from audio/${existing}, skipped`)
        continue
      }
      seen.set(id, file)
      files.push({ id, file })
    }
  }
  const dir = path.join(root, CONTENT_DIR, AUDIO_DIR)
  if (existsSync(dir)) walk(dir, [])
  for (const version of versions) {
    const owner = files.find((f) => f.id === version.id)
    if (!owner) {
      warn(
        `[registry] audio/${version.file}: no "${version.id}" sound next to it to stand in for, ignored`,
      )
      continue
    }
    owner.langs = [...(owner.langs ?? []), { lang: version.lang, file: version.file }].sort(
      (a, b) => a.lang.localeCompare(b.lang),
    )
  }
  // A plain music/town.ogg stays the fallback after every language; without one the default
  // language's file (else the first there is) is the sound's own file.
  const order = (lang: string) => voiceLangs.indexOf(lang)
  for (const id of new Set(byVoice.map((v) => v.id))) {
    const versions = byVoice
      .filter((v) => v.id === id)
      .sort((a, b) => order(a.lang) - order(b.lang))
      .map(({ lang, file }) => ({ lang, file }))
    const owner = files.find((f) => f.id === id)
    if (owner) owner.voiceLangs = versions
    else files.push({ id, file: (versions[0] as { file: string }).file, voiceLangs: versions })
  }
  return files.sort((a, b) => a.id.localeCompare(b.id))
}

// ---------------------------------------------------------------- backgrounds

/**
 * src/content/backgrounds/school/classroom.png -> the background 'school/classroom' (classroom.ja.png
 * next to it = its Japanese version, vite/langFiles.ts). A folder with an index.ts is a background
 * with variants (defineBackground, made from an .aseprite file like a layered CG):
 * backgrounds/town/street/index.ts -> 'town/street'. Other folders group them.
 */
export const BACKGROUNDS_DIR = 'backgrounds'
/** Insets (inset()): the same kinds of files and folders as backgrounds, in src/content/insets. */
export const INSETS_DIR = 'insets'
const BACKGROUND_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.avif',
  '.gif',
  '.svg',
  '.mp4',
  '.webm',
]

export interface BackgroundFile {
  id: string
  /** A plain background: its path inside src/content/backgrounds, with extension. */
  file?: string
  /** A background with variants: its folder holds an index.ts (defineBackground). */
  config?: true
}

export function scanBackgrounds(
  root: string,
  warn: (message: string) => void = console.warn,
  langs: readonly string[] = contentLanguages(root),
  folder: string = BACKGROUNDS_DIR,
): BackgroundFile[] {
  const variantNames = variantValues(root)
  const found = new Map<string, BackgroundFile>()
  const add = (entry: BackgroundFile, label: string) => {
    const taken = found.get(entry.id)
    if (taken) {
      warn(
        `[registry] ${label}: "${entry.id}" already comes from ${folder}/${taken.file ?? `${taken.id}/index.ts`}, skipped`,
      )
      return
    }
    found.set(entry.id, entry)
  }
  const walk = (dir: string, prefix: string[]) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue
      const label = `${folder}/${[...prefix, entry.name].join('/')}`
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!NAME_PATTERN.test(entry.name)) {
          warn(`[registry] ${label}: bad folder name, skipped`)
        } else if (ENTRY_FILES.some((file) => existsSync(path.join(full, file)))) {
          // A background with variants; the files inside (the .aseprite, its .gen files) are its own.
          add({ id: [...prefix, entry.name].join('/'), config: true }, label)
        } else {
          walk(full, [...prefix, entry.name])
        }
        continue
      }
      const ext = path.extname(entry.name).toLowerCase()
      if (!BACKGROUND_EXTENSIONS.includes(ext)) continue
      const parts = entry.name.slice(0, -ext.length).split('.')
      // Generated files and language versions are not backgrounds of their own.
      if (parts.includes('gen')) continue
      if (parts.slice(1).some((part) => variantNames.includes(part))) continue
      if (parts.length === 2 && langs.includes(parts[1] as string)) continue
      const [name] = parts as [string]
      if (parts.length > 1) {
        warn(
          `[registry] ${label}: a background file is <name>.<ext> (or <name>.<language>.<ext>). For variants, make a folder with an .aseprite file and an index.ts (defineBackground), like a layered CG. Skipped`,
        )
        continue
      }
      if (!NAME_PATTERN.test(name)) {
        warn(`[registry] ${label}: use lowercase letters, digits and _ for file names, skipped`)
        continue
      }
      add({ id: [...prefix, name].join('/'), file: [...prefix, entry.name].join('/') }, label)
    }
  }
  const dir = path.join(root, CONTENT_DIR, folder)
  if (existsSync(dir)) walk(dir, [])
  return [...found.values()].sort((a, b) => a.id.localeCompare(b.id))
}

/** Step ids of each quest, from the `steps: { … }` in its file. */
export function scanQuestSteps(root: string, ids: readonly string[]): Record<string, string[]> {
  const steps: Record<string, string[]> = {}
  for (const id of ids) {
    const file = path.join(root, CONTENT_DIR, 'quests', id, 'index.ts')
    steps[id] = existsSync(file) ? keysOf(readFileSync(file, 'utf8'), /\bsteps\s*:\s*\{/) : []
  }
  return steps
}

// ---------------------------------------------------------------- routes

export const ROUTES_DIR = 'routes'

/**
 * Node keys of a route, in file order: `event('town/sign', 'the_sign')` in index.ts, or
 * `event town/sign as the_sign` in index.vn. A box without a name is called after the last part
 * of its event id (`event('town/sign')` -> sign). Line comments are skipped. Duplicates are kept once
 * (the route itself reports them when it runs).
 */
export function routeKeysOf(source: string, vn = false): string[] {
  const keys: string[] = []
  if (vn) {
    // `event common/day1 as morning` -> morning; without `as`: the last part of the id.
    for (const m of source.matchAll(
      /^[ \t]*event[ \t]+([a-z][a-z0-9_/]*)(?:[ \t]+as[ \t]+([a-z][a-z0-9_]*))?[ \t]*$/gm,
    )) {
      keys.push(m[2] ?? ((m[1] as string).split('/').at(-1) as string))
    }
  } else {
    const code = source.replace(/(^|[ \t])\/\/.*$/gm, '$1')
    // event('common/day1', 'morning') -> morning; event('common/day1') -> day1.
    const call = /\bevent\(\s*(['"])([^'"]*)\1\s*(?:,\s*(['"])([^'"]*)\3)?/g
    for (const m of code.matchAll(call))
      keys.push(m[4] ?? ((m[2] as string).split('/').at(-1) as string))
  }
  return [...new Set(keys)]
}

/** Route id -> its node keys, and the routes that have a flow.ts. */
export function scanRoutes(root: string, ids: readonly string[]) {
  const keys: Record<string, string[]> = {}
  const flows: string[] = []
  for (const id of ids) {
    const dir = path.join(root, CONTENT_DIR, ROUTES_DIR, id)
    const ts = path.join(dir, 'index.ts')
    const vn = path.join(dir, VN_ENTRY)
    if (existsSync(ts)) keys[id] = routeKeysOf(readFileSync(ts, 'utf8'))
    else if (existsSync(vn)) keys[id] = routeKeysOf(readFileSync(vn, 'utf8'), true)
    else keys[id] = []
    if (existsSync(path.join(dir, 'flow.ts'))) flows.push(id)
  }
  return { keys, flows }
}

/** Writes the registry file if its content changed. Returns true when it was written. */
/** Windows the engine always opens (src/core/required.ts) that src/content lacks: one message each. */
export function missingRequired(windowIds: readonly string[]): string[] {
  return Object.keys(REQUIRED_WINDOWS)
    .filter((id) => !windowIds.includes(id))
    .map((id) => missingContentMessage('windows', id))
}

export function writeRegistry(root: string): boolean {
  const content = scanContent(root)
  const missing = missingRequired(content.windows)
  if (missing.length > 0) throw new Error(missing.join('\n'))
  const routes = scanRoutes(root, content.routes)
  const source = renderRegistry({
    ...content,
    titleAssets: scanTitleAssets(root, content.titles),
    questSteps: scanQuestSteps(root, content.quests),
    routeKeys: routes.keys,
    routeFlows: routes.flows,
    audio: scanAudio(root),
    backgrounds: scanBackgrounds(root),
    insets: scanBackgrounds(root, console.warn, contentLanguages(root), INSETS_DIR),
    migrations: scanMigrations(root),
    devStart: scanDevStarts(root, content.events),
  })
  const file = path.join(root, OUTPUT_FILE)
  if (existsSync(file) && readFileSync(file, 'utf8') === source) return false
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, source)
  return true
}

/** Regenerates the registry on start and whenever content folders/files are added or removed. */
export function registryPlugin(): Plugin {
  let root = process.cwd()
  let building = false
  return {
    name: 'game-registry',
    configResolved(config) {
      root = config.root
      building = config.command === 'build'
    },
    buildStart() {
      writeRegistry(root)
      // A dev start marker must never ship: it skips the title and jumps into a scene.
      const marker = building ? scanDevStarts(root, scanContent(root).events) : null
      if (marker)
        throw new Error(
          `[dev start] ${marker.at}: remove the @start / devStart() marker before building`,
        )
    },
    configureServer(server) {
      const contentDir = path.join(root, CONTENT_DIR) + path.sep
      let timer: ReturnType<typeof setTimeout> | undefined
      const onChange = (file: string) => {
        if (!file.startsWith(contentDir)) return
        clearTimeout(timer)
        timer = setTimeout(() => {
          // A required window removed while the server runs: say so, keep the server up.
          try {
            if (writeRegistry(root))
              server.config.logger.info('[registry] updated', { timestamp: true })
          } catch (error) {
            server.config.logger.error(
              `[registry] ${error instanceof Error ? error.message : error}`,
            )
          }
        }, 50)
      }
      for (const event of ['add', 'unlink', 'addDir', 'unlinkDir'] as const) {
        server.watcher.on(event, onChange)
      }
      // Quest step ids are read from the quest files themselves: an edit there counts too.
      // So are route node keys (index.ts / index.vn of each route).
      const routeDir = path.join(contentDir, ROUTES_DIR) + path.sep
      const questDir = path.join(contentDir, 'quests') + path.sep
      // Event sources: a dev start marker added or removed (@start / devStart()).
      const eventDir = path.join(contentDir, 'events') + path.sep
      const isEventSource = (file: string) =>
        file.startsWith(eventDir) && /\.(vn|tsx?)$/.test(file) && !file.endsWith('.gen.ts')
      server.watcher.on('change', (file) => {
        if (file.startsWith(questDir) || file.startsWith(routeDir) || isEventSource(file))
          onChange(file)
      })
    },
  }
}
