// Content variants at build time (src/content/config/variants.ts; core/variants.ts reads the
// result). One value per group is ACTIVE in a build: GAME_VARIANTS="rating=adult,region=cn" (the
// build script sets it from --variant), else each group's default.
//   - A file "<name>.<value>.<ext>" next to "<name>.<ext>" (or a folder "<name>.<value>" next to
//     "<name>") replaces it when <value> is active: every import of the plain one gets it instead.
//     Generated files follow: "x.adult.vn" -> x.adult.gen.ts replaces x.gen.ts.
//   - Content whose index.ts says `only: '<value>'` for a value that is not active becomes an empty
//     stand-in (its pictures are never imported, so they are not in the build).
//   - `virtual:variants` = { groups: { rating: 'adult' }, strings: { …reworded lines } } (only the
//     active values' src/content/variants/<value>/strings.ts files are bundled).
// Files named for any value (active or not) are never content of their own (vite/registry.ts).
import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'
import { contentLanguages } from './aseprite/lang.ts'
import { computeGuard, type Guard, withoutEntries } from './variantGuard.ts'

const CONFIG = 'src/content/config/variants.ts'
const VIRTUAL = 'virtual:variants'
const RESOLVED = `\0${VIRTUAL}`

export interface VariantGroups {
  /** group -> its values, in order. */
  groups: Record<string, string[]>
  /** group -> its default value. */
  defaults: Record<string, string>
}

/** Reads src/content/config/variants.ts as text (group: { values: [...], default: '...' }). */
export function readVariants(root: string): VariantGroups {
  const file = path.join(root, CONFIG)
  const source = existsSync(file) ? readFileSync(file, 'utf8') : ''
  const groups: Record<string, string[]> = {}
  const defaults: Record<string, string> = {}
  const group =
    /\b([a-z][a-z0-9_]*)\s*:\s*\{\s*values\s*:\s*\[([^\]]*)\]\s*,\s*default\s*:\s*['"]([a-z0-9_]+)['"]/g
  for (const m of source.matchAll(group)) {
    const values = [...(m[2] as string).matchAll(/['"]([a-z0-9_]+)['"]/g)].map(
      (v) => v[1] as string,
    )
    groups[m[1] as string] = values
    defaults[m[1] as string] = m[3] as string
  }
  return { groups, defaults }
}

/** Every value of every group (files named with any of them are versions, not content). */
export function variantValues(root: string): string[] {
  return Object.values(readVariants(root).groups).flat()
}

/**
 * The value each group has in this build: GAME_VARIANTS ("rating=adult,region=cn"), else its
 * default. An unknown group or value is an error (a typo must not build the wrong version).
 */
export function activeVariants(
  root: string,
  env: string | undefined = process.env.GAME_VARIANTS,
): Record<string, string> {
  const { groups, defaults } = readVariants(root)
  const active = { ...defaults }
  for (const pair of (env ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)) {
    const [group, value] = pair.split('=').map((p) => p.trim()) as [string, string | undefined]
    const values = groups[group]
    if (!values) throw new Error(`[variants] no group "${group}" in ${CONFIG}`)
    if (!value || !values.includes(value))
      throw new Error(`[variants] "${group}" has no value "${value}" (${values.join(', ')})`)
    active[group] = value
  }
  return active
}

/** Does a file / folder name carry a variant value ("logo.cn.png", "park.adult.vn", "park.adult")? */
export function isVariantName(name: string, values: readonly string[]): boolean {
  return name
    .split('.')
    .slice(1)
    .some((part) => values.includes(part))
}

/** "a/b/logo.png" -> "a/b/logo.cn.png"; "x.gen.ts" -> "x.cn.gen.ts". */
export function versionPath(file: string, value: string): string {
  const dir = path.dirname(file)
  const [first, ...rest] = path.basename(file).split('.')
  return path.join(dir, [first, value, ...rest].join('.'))
}

/**
 * The file this build uses for `file`: its version for an active value, if there is one. A
 * language version ("logo.ja.png", `langs` = the language folders) follows the same order the
 * game uses: logo.cn.ja.png, else logo.cn.png when there is one (a variant beats a language:
 * a censored picture stays censored in every language), else the language file itself.
 */
export function variantFile(
  file: string,
  active: readonly string[],
  langs: readonly string[] = [],
): string {
  const parts = path.basename(file).split('.')
  const lang = parts.length >= 3 && langs.includes(parts.at(-2) as string) ? parts.at(-2) : null
  const plain = lang
    ? path.join(path.dirname(file), [...parts.slice(0, -2), parts.at(-1)].join('.'))
    : null
  for (const value of active) {
    const version = versionPath(file, value)
    if (existsSync(version)) return version
    if (plain) {
      const base = versionPath(plain, value)
      if (existsSync(base)) return base
    }
    // A whole folder: events/park.adult/index.ts for events/park/index.ts.
    const dir = path.dirname(file)
    const folder = path.join(
      path.dirname(dir),
      `${path.basename(dir)}.${value}`,
      path.basename(file),
    )
    if (/^index\./.test(path.basename(file)) && existsSync(folder)) return folder
  }
  return file
}

/** `only: 'adult'` at the top level of a content file, if any. */
export function onlyValue(source: string): string | null {
  return /^\s{2}only\s*:\s*['"]([a-z0-9_]+)['"]/m.exec(source)?.[1] ?? null
}

/** An import that names a file (relative, @/…, /src/…, absolute) -> its absolute path, or null. */
function importPath(source: string, importer: string, root: string): string | null {
  if (source.startsWith('.')) {
    const from = importer.split('?')[0] as string
    return from.startsWith('\0') ? null : path.resolve(path.dirname(from), source)
  }
  if (source.startsWith('@/')) return path.join(root, 'src', source.slice(2))
  if (source.startsWith('/src/')) return path.join(root, source.slice(1))
  return path.isAbsolute(source) ? source : null
}

/** The file an import means: as written, or with .ts / .tsx / index.* (extension-less imports). */
function existing(file: string): string | null {
  for (const candidate of [file, `${file}.ts`, `${file}.tsx`]) {
    if (existsSync(candidate) && !statSync(candidate).isDirectory()) return candidate
  }
  for (const index of ['index.ts', 'index.tsx']) {
    const candidate = path.join(file, index)
    if (existsSync(candidate)) return candidate
  }
  return null
}

const OFF = '\0variant-off:'
/** Texts shorter than this may appear in other code by chance: the leak check skips them. */
const CHECK_MIN_TEXT = 8

let current: { guard: Guard; content: string; all: string[]; values: string[] } | null = null

/**
 * A content file this build must not contain: named for a value it lacks, inside a folder left out
 * (`only:`, or only a variant scene uses it), or a file the leak guard left out. For other plugins
 * that find files themselves (gallery thumbnails, event previews).
 */
export function isOffFile(file: string): boolean {
  if (!current || !file.startsWith(current.content)) return false
  const { guard, content, all, values } = current
  if (guard.files.has(file) || guard.offSources.has(file)) return true
  for (const part of path.relative(content, file).split(path.sep)) {
    const marks = part
      .replace(/\.[^.]+$/, '')
      .split('.')
      .slice(1)
    if (marks.some((mark) => all.includes(mark) && !values.includes(mark))) return true
  }
  for (const entry of guard.entries.keys())
    if (file.startsWith(path.dirname(entry) + path.sep)) return true
  return false
}

export function variantsPlugin(root = process.cwd()): Plugin {
  const content = path.join(root, 'src/content') + path.sep
  let active: Record<string, string> = {}
  let values: string[] = []
  let all: string[] = []
  let langs: string[] = []
  let guard: Guard = {
    files: new Set(),
    entries: new Map(),
    texts: new Set(),
    offSources: new Set(),
  }
  let isBuild = false
  /** Content entries this build replaced with an empty stand-in (their real code is not in it). */
  const stubbed = new Set<string>()
  const load = () => {
    active = activeVariants(root)
    values = Object.values(active)
    all = variantValues(root)
    langs = contentLanguages(root)
    guard = computeGuard(root, all, values)
    current = { guard, content, all, values }
  }
  load()
  return {
    name: 'game-variants',
    enforce: 'pre',
    configResolved(config) {
      isBuild = config.command === 'build'
    },
    // From the import path itself, before any other plugin: the build's media converter (vite/media)
    // must convert the variant file, not the plain one (it resolves pictures and sounds itself).
    async resolveId(source, importer, options) {
      if (source === VIRTUAL) return RESOLVED
      if (!importer || source.startsWith('\0')) return null
      const [bare, query] = source.split('?') as [string, string | undefined]
      const wanted = importPath(bare, importer, root)
      const file = wanted?.startsWith(content) ? existing(wanted) : null
      // Only a variant scene this build lacks uses it (vite/variantGuard.ts): an empty stand-in.
      if (file && guard.files.has(file)) return `${OFF}${file}`
      if (!file || isVariantName(path.basename(file), all)) return null
      const used = variantFile(file, values, langs)
      if (used === file) return null
      return this.resolve(query ? `${used}?${query}` : used, importer, {
        ...options,
        skipSelf: true,
      })
    },
    load(id) {
      if (id === RESOLVED) {
        const strings = values
          .map((value) => path.join(content, 'variants', value, 'strings.ts'))
          .filter((file) => existsSync(file))
        return [
          ...strings.map((file, i) => `import s${i} from ${JSON.stringify(file)}`),
          `export default { groups: ${JSON.stringify(active)}, strings: Object.assign({}, ${strings.map((_, i) => `s${i}`).join(', ')}) }`,
          '',
        ].join('\n')
      }
      if (id.startsWith(OFF)) return 'export default ""\n'
      // Content only for a value this build leaves out (its own `only:`, or only a variant scene this
      // build lacks uses it): an empty stand-in, nothing it imports.
      const file = id.split('?')[0] as string
      if (!file.startsWith(content) || !/[\\/]index\.tsx?$/.test(file)) return null
      const only = guard.entries.get(file) ?? onlyValue(readFileSync(file, 'utf8'))
      if (!only || values.includes(only) || !all.includes(only)) return null
      stubbed.add(file)
      return `export default { only: ${JSON.stringify(only)}, title: '' }\n`
    },
    // Translations of lines only a variant this build lacks has: out of the language files.
    transform(code, id) {
      if (guard.texts.size === 0) return null
      const file = id.split('?')[0] as string
      if (!file.startsWith(path.join(content, 'lang') + path.sep)) return null
      const out = withoutEntries(code, guard.texts)
      return out === code ? null : { code: out, map: null }
    },
    // The promise, checked: nothing of a variant this build lacks is in it. Fails the build.
    generateBundle(_options, bundle) {
      if (!isBuild || values.length === all.length) return
      const problems: string[] = []
      const texts = [...guard.texts].filter((text) => text.length >= CHECK_MIN_TEXT)
      for (const item of Object.values(bundle)) {
        if (item.type === 'chunk') {
          for (const module of item.moduleIds) {
            const file = module.split('?')[0] as string
            if (stubbed.has(file)) continue // the empty stand-in, not its content
            if (isOffFile(file)) problems.push(`${item.fileName}: ${path.relative(root, file)}`)
          }
          for (const text of texts)
            if (item.code.includes(text)) problems.push(`${item.fileName}: text "${text}"`)
        } else {
          for (const original of item.originalFileNames ?? []) {
            const file = path.resolve(root, original)
            if (isOffFile(file)) problems.push(`${item.fileName}: ${original}`)
          }
        }
      }
      if (problems.length > 0)
        this.error(
          `[variants] this build (${values.join(', ')}) would contain another version's content:\n  ${problems.join('\n  ')}`,
        )
    },
    configureServer(server) {
      // A new variant file or a changed config: start over (imports are resolved once).
      server.watcher.on('add', (file) => {
        if (isVariantName(path.basename(file), all)) server.restart()
      })
      server.watcher.on('change', (file) => {
        if (file.endsWith(path.join('config', 'variants.ts'))) {
          load()
          server.restart()
          return
        }
        // A scene or content file changed: what only variant scenes use may have changed too.
        if (!file.startsWith(content) || !/\.(ts|tsx|vn)$/.test(file) || /\.gen\.ts$/.test(file))
          return
        const before = JSON.stringify([[...guard.files], [...guard.entries.keys()]])
        load()
        if (JSON.stringify([[...guard.files], [...guard.entries.keys()]]) !== before)
          server.restart()
      })
    },
  }
}
