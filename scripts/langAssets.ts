// pnpm lang --assets: which pictures, videos, sounds and Aseprite files have a version per language.
// Not part of the normal report: most files need no translation (only those with text in them).
// - Pictures / videos / sounds: "<name>.<lang>.<ext>" next to "<name>.<ext>".
// - Aseprite files: layers named "<name>.<lang>" (vite/aseprite/lang.ts).
// Tileset images (named by Tiled files) and generated files are left out.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { contentLanguages, languageViews } from '../vite/aseprite/lang.ts'
import { readAseprite } from '../vite/aseprite/read.ts'
import { LANG_FILE, langFileName } from '../vite/langFiles.ts'

const SOUND = /\.(ogg|oga|mp3|wav|aiff?|m4a|aac|flac|opus)$/i
const ASEPRITE = /\.(aseprite|ase)$/i
const TILED = /\.(tsj|tsx|tmx|tmj|json)$/i

function walk(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith('.') || entry.name.startsWith('_')) return []
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })
}

/** Images that Tiled files use as tilesets (always one picture for every language). */
function tilesetImages(all: string[]): Set<string> {
  const used = new Set<string>()
  for (const file of all.filter((f) => TILED.test(f) && !f.endsWith('.gen.json'))) {
    const text = readFileSync(file, 'utf8')
    const names = [
      ...text.matchAll(/"image"\s*:\s*"([^"]+)"/g),
      ...text.matchAll(/<image\b[^>]*\bsource="([^"]+)"/g),
    ]
    for (const [, name] of names) if (name) used.add(path.resolve(path.dirname(file), name))
  }
  return used
}

export function reportAssets(root: string, log: (line: string) => void = console.log) {
  const content = path.join(root, 'src/content')
  const langs = contentLanguages(root)
  const all = walk(content).filter((f) => !f.startsWith(path.join(content, 'lang') + path.sep))
  const tilesets = tilesetImages(all)
  const isAsset = (f: string) => {
    const name = path.basename(f)
    if (name.includes('.gen.') || tilesets.has(f)) return false
    return LANG_FILE.test(name) || SOUND.test(name) || ASEPRITE.test(name)
  }
  // Language versions by file name count for their file, not as files of their own.
  const versions = new Map<string, Set<string>>()
  const assets: string[] = []
  for (const file of all.filter(isAsset)) {
    const parsed = ASEPRITE.test(file) ? null : langFileName(path.basename(file), langs)
    if (parsed) {
      const base = path.join(path.dirname(file), `${parsed.name}${parsed.ext}`)
      const set = versions.get(base) ?? new Set<string>()
      set.add(parsed.lang)
      versions.set(base, set)
    } else assets.push(file)
  }
  const rel = (f: string) => path.relative(content, f).split(path.sep).join('/')
  log(
    `[lang] assets: ${assets.length} pictures, videos, sounds and Aseprite files (tilesets left out)`,
  )
  if (langs.length === 0)
    return log('[lang] no languages yet: add src/content/lang/<code>/index.ts')
  // Aseprite files: languages of their "<name>.<lang>" layers.
  const layered = new Map<string, string[]>()
  for (const file of assets.filter((f) => ASEPRITE.test(f))) {
    try {
      layered.set(file, languageViews(readAseprite(readFileSync(file)), langs, () => {}).langs)
    } catch {
      // unreadable: the build warns about it
    }
  }
  for (const lang of langs) {
    const has = assets.filter((f) => versions.get(f)?.has(lang) || layered.get(f)?.includes(lang))
    log(`[lang] ${lang}: ${has.length} of ${assets.length} have a ${lang} version`)
    for (const file of has) log(`  has: ${rel(file)}${ASEPRITE.test(file) ? ' (layers)' : ''}`)
    for (const file of assets.filter((f) => !has.includes(f))) log(`  without: ${rel(file)}`)
  }
}
