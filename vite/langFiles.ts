// Pictures and videos per language, by file name: "<name>.<lang>.<ext>" next to "<name>.<ext>"
// (logo.ja.svg next to logo.svg) is that file in the language <lang> (a folder in src/content/lang).
// `virtual:lang-files` maps each file's URL to its versions, so the game swaps them (lang.image)
// and only ever asks for files that exist. Aseprite files use layers instead (aseprite/lang.ts);
// sounds are listed by the registry (vite/registry.ts). Generated files (*.gen.*) are skipped.
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'
import { contentLanguages } from './aseprite/lang.ts'
import { voiceLanguages } from './registry.ts'
import { activeVariants, isVariantName, variantValues } from './variants.ts'

const VIRTUAL = 'virtual:lang-files'
const RESOLVED = `\0${VIRTUAL}`
/** Pictures and videos (what lang.image is used for). */
export const LANG_FILE = /\.(png|jpe?g|webp|avif|gif|svg|mp4|webm)$/i

export interface LangFile {
  lang: string
  /** Absolute paths. */
  base: string
  file: string
}

/** "logo.ja.svg" -> { name: "logo", lang: "ja", ext: ".svg" } when ja is a language. */
export function langFileName(file: string, langs: readonly string[]) {
  const ext = path.extname(file)
  const stem = file.slice(0, -ext.length)
  const dot = stem.lastIndexOf('.')
  if (dot <= 0) return null
  const lang = stem.slice(dot + 1)
  return langs.includes(lang) ? { name: stem.slice(0, dot), lang, ext } : null
}

/** Content variants (vite/variants.ts): every value, and the ones this build uses. */
export interface LangVariants {
  all: readonly string[]
  active: readonly string[]
}

/**
 * Every "<name>.<lang>.<ext>" picture / video under `dir`, with the file it stands in for. With
 * content variants: "<name>.<value>.<lang>.<ext>" is the language version of the build's variant
 * (the plain "<name>.<ext>" import becomes "<name>.<value>.<ext>" in vite/variants.ts, so it keys
 * the map); a plain "<name>.<lang>.<ext>" is left out when the build has "<name>.<value>.<ext>" (a
 * variant beats a language), and other values' files are never listed (never shipped).
 */
export function findLangFiles(
  dir: string,
  langs: readonly string[],
  warn: (message: string) => void = console.warn,
  variants: LangVariants = { all: [], active: [] },
): LangFile[] {
  if (!existsSync(dir) || langs.length === 0) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return findLangFiles(full, langs, warn, variants)
    if (!LANG_FILE.test(entry.name) || entry.name.includes('.gen.')) return []
    const parsed = langFileName(entry.name, langs)
    if (!parsed) return []
    const [first, ...marks] = parsed.name.split('.')
    const own = marks.filter((part) => variants.all.includes(part))
    if (own.some((value) => !variants.active.includes(value))) return []
    if (own.length > 0) {
      // logo.cn.ja.png: the plain logo.png (made logo.cn.png by the build), or logo.cn.png itself.
      const plain = path.join(dir, `${first}${parsed.ext}`)
      const versioned = path.join(dir, `${parsed.name}${parsed.ext}`)
      const base = existsSync(plain) ? plain : versioned
      if (!existsSync(base)) {
        warn(`[lang] ${entry.name}: no ${first}${parsed.ext} next to it to stand in for, ignored`)
        return []
      }
      return [{ lang: parsed.lang, base, file: full }]
    }
    // logo.ja.png while this build has logo.cn.png: the variant wins (logo.cn.ja.png, if any, is
    // listed by its own entry).
    if (
      variants.active.some(
        (value) =>
          existsSync(path.join(dir, `${parsed.name}.${value}${parsed.ext}`)) ||
          existsSync(path.join(dir, `${parsed.name}.${value}.${parsed.lang}${parsed.ext}`)),
      )
    )
      return []
    const base = path.join(dir, `${parsed.name}${parsed.ext}`)
    if (!existsSync(base)) {
      warn(
        `[lang] ${entry.name}: no ${parsed.name}${parsed.ext} next to it to stand in for, ignored`,
      )
      return []
    }
    return [{ lang: parsed.lang, base, file: full }]
  })
}

/** The module: { ja: { [url of logo.svg]: url of logo.ja.svg } }. */
export function renderLangFiles(files: LangFile[]): string {
  const ids = new Map<string, string>()
  const imports: string[] = []
  const id = (file: string) => {
    let name = ids.get(file)
    if (!name) {
      name = `f${ids.size}`
      ids.set(file, name)
      imports.push(`import ${name} from ${JSON.stringify(file)}`)
    }
    return name
  }
  const byLang = new Map<string, string[]>()
  for (const { lang, base, file } of files) {
    const entries = byLang.get(lang) ?? []
    entries.push(`[${id(base)}]: ${id(file)}`)
    byLang.set(lang, entries)
  }
  const langs = [...byLang].map(([lang, entries]) => `  ${lang}: { ${entries.join(', ')} },`)
  return [...imports, 'export default {', ...langs, '}', ''].join('\n')
}

export function langFilesPlugin(): Plugin {
  let root = process.cwd()
  const contentDir = () => path.join(root, 'src/content')
  return {
    name: 'game-lang-files',
    configResolved(config) {
      root = config.root
    },
    resolveId(source) {
      return source === VIRTUAL ? RESOLVED : null
    },
    load(id) {
      if (id !== RESOLVED) return null
      const warn = (message: string) => this.warn(message)
      const variants = { all: variantValues(root), active: Object.values(activeVariants(root)) }
      return renderLangFiles(findLangFiles(contentDir(), contentLanguages(root), warn, variants))
    },
    configureServer(server) {
      // A language version added or removed (or a new language folder) changes the list.
      const refresh = (file: string) => {
        if (!file.startsWith(contentDir())) return
        const name = path.basename(file)
        const langFolder = path.dirname(path.dirname(file)) === path.join(contentDir(), 'lang')
        const langFile =
          LANG_FILE.test(name) &&
          !name.includes('.gen.') &&
          langFileName(name, contentLanguages(root)) !== null
        if (!langFile && !langFolder) return
        const module = server.moduleGraph.getModuleById(RESOLVED)
        if (!module) return
        server.moduleGraph.invalidateModule(module)
        server.ws.send({ type: 'full-reload' })
      }
      server.watcher.on('add', refresh)
      server.watcher.on('unlink', refresh)
    },
  }
}

// Movies per VOICE language, by folder: src/content/movies/<id>/<voice language>/<file> (the
// languages of src/content/scenes.ts voice.languages). `virtual:voice-lang-files` lists each
// file's versions, so the player picks the voice language set now, then the next language that
// has it (lang/ja/ may be there while en/ is missing).
const VOICE_VIRTUAL = 'virtual:voice-lang-files'
const VOICE_RESOLVED = `\0${VOICE_VIRTUAL}`
/** Folders under src/content whose videos may come in voice-language folders. */
export const VOICE_LANGUAGE_MEDIA = ['movies']

/** Each video found in voice-language folders: its versions, { ja: absolute path, en: … }. */
export function findVoiceLangFiles(
  dir: string,
  voiceLangs: readonly string[],
  /** Content variant values: their files are versions (vite/variants.ts swaps them in), not videos. */
  variantNames: readonly string[] = [],
): Record<string, string>[] {
  const groups = new Map<string, Record<string, string>>()
  const walk = (folder: string, lang: string | null, rest: string[]) => {
    if (!existsSync(folder)) return
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const full = path.join(folder, entry.name)
      if (entry.isDirectory()) {
        if (!lang && voiceLangs.includes(entry.name)) walk(full, entry.name, rest)
        else walk(full, lang, [...rest, entry.name])
      } else if (
        lang &&
        LANG_FILE.test(entry.name) &&
        !entry.name.includes('.gen.') &&
        !isVariantName(entry.name.replace(/\.[^.]+$/, ''), variantNames)
      ) {
        // The same file without its language folder names the group.
        const key = [...rest, entry.name].join('/')
        groups.set(key, { ...groups.get(key), [lang]: full })
      }
    }
  }
  walk(dir, null, [])
  return [...groups.values()]
}

/** The module: [{ ja: url, en: url }, …], one entry per video. */
export function renderVoiceLangFiles(groups: Record<string, string>[]): string {
  const imports: string[] = []
  const entries = groups.map((group) => {
    const parts = Object.entries(group).map(([lang, file]) => {
      const name = `v${imports.length}`
      imports.push(`import ${name} from ${JSON.stringify(file)}`)
      return `${lang}: ${name}`
    })
    return `  { ${parts.join(', ')} },`
  })
  return [...imports, 'export default [', ...entries, ']', ''].join('\n')
}

export function voiceLangFilesPlugin(): Plugin {
  let root = process.cwd()
  const dirs = () => VOICE_LANGUAGE_MEDIA.map((name) => path.join(root, 'src/content', name))
  return {
    name: 'game-voice-lang-files',
    configResolved(config) {
      root = config.root
    },
    resolveId(source) {
      return source === VOICE_VIRTUAL ? VOICE_RESOLVED : null
    },
    load(id) {
      if (id !== VOICE_RESOLVED) return null
      const langs = voiceLanguages(root)
      return renderVoiceLangFiles(
        dirs().flatMap((dir) => findVoiceLangFiles(dir, langs, variantValues(root))),
      )
    },
    configureServer(server) {
      const scenesFile = path.join(root, 'src/content/scenes.ts')
      let known = JSON.stringify(voiceLanguages(root))
      const refresh = (file: string) => {
        if (file === scenesFile) {
          // Only a change of voice.languages matters here.
          const now = JSON.stringify(voiceLanguages(root))
          if (now === known) return
          known = now
        } else if (!dirs().some((dir) => file.startsWith(dir)) || !LANG_FILE.test(file)) return
        const module = server.moduleGraph.getModuleById(VOICE_RESOLVED)
        if (!module) return
        server.moduleGraph.invalidateModule(module)
        server.ws.send({ type: 'full-reload' })
      }
      server.watcher.on('add', refresh)
      server.watcher.on('unlink', refresh)
      server.watcher.on('change', (file) => {
        if (file === scenesFile) refresh(file)
      })
    },
  }
}
