// Vite plugin: turns every src/content/**/*.aseprite into <name>.gen.png + <name>.gen.ts next to it,
// and makes sure .aseprite files themselves can never end up in a build.
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'
import { buildCg, cgFileNames, cgLanguage, isCgSource, renderCgModule } from './cg.ts'
import { contentLanguages, languageViews, variantLayers } from './lang.ts'
import { encodePng } from './png.ts'
import {
  addLanguageSlots,
  buildSlots,
  findFace,
  pack,
  renderModule,
  slotBitmaps,
} from './portrait.ts'
import { readAseprite } from './read.ts'
import { buildSprite, packSprite, renderSpriteModule } from './sprite.ts'

/** Files inside a `sprites/` or `battle_sprite/` folder are animated sprite sheets; all others are portraits. */
export const isSpriteSource = (file: string) =>
  file.split(/[\\/]/).some((part) => part === 'sprites' || part === 'battle_sprite')

const CONTENT_DIR = 'src/content'
const SOURCE = /\.(aseprite|ase)$/i

function findSources(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return findSources(full)
    return SOURCE.test(entry.name) ? [full] : []
  })
}

const outputs = (source: string) => {
  const base = source.replace(SOURCE, '')
  return { png: `${base}.gen.png`, ts: `${base}.gen.ts` }
}

/** Writes only when the content changed (keeps dev reloads and git quiet). */
function writeIfChanged(file: string, data: Buffer | string) {
  const buffer = typeof data === 'string' ? Buffer.from(data) : data
  if (existsSync(file) && readFileSync(file).equals(buffer)) return false
  writeFileSync(file, buffer)
  return true
}

/** The project root of a file under src/content (for the language list). */
const rootOf = (source: string) => {
  const at = source.split(path.sep).join('/').lastIndexOf(`/${CONTENT_DIR}/`)
  return at < 0 ? process.cwd() : source.slice(0, at)
}

/** Language sheets of a sprite / CG that are no longer made (a language layer was removed). */
function removeStale(dir: string, base: string, langs: readonly string[], keep: Set<string>) {
  for (const lang of langs) {
    const name = `${base}.${lang}.gen.png`
    if (!keep.has(name)) rmSync(path.join(dir, name), { force: true })
  }
}

/** Converts one .aseprite file. Returns true if a generated file changed. */
export function generateFromAseprite(
  source: string,
  warn: (message: string) => void = console.warn,
  allLangs: readonly string[] = contentLanguages(rootOf(source)),
) {
  const label = path.basename(source)
  const raw = readAseprite(readFileSync(source))
  for (const warning of raw.warnings) warn(`[aseprite] ${label}: ${warning}`)
  const say = (message: string) => warn(`[aseprite] ${label}: ${message}`)
  // Layers named "<name>.<value>" are a content variant's version of "<name>" (vite/variants.ts):
  // the build's value takes the layer's place, the other values' layers are left out.
  const read = variantLayers(raw, rootOf(source), say)
  const quiet = () => {}
  // Layers named "<name>.<lang>" are that language's version of "<name>" (lang.ts).
  const views = languageViews(read, allLangs, say)
  const file = views.view(null)
  const out = outputs(source)
  const dir = path.dirname(source)
  const base = path.basename(out.png, '.gen.png')
  if (isCgSource(source)) {
    // Layered CG (gallery): flattened picture + one trimmed PNG per toggle.
    const build = buildCg(file, say)
    const files = cgFileNames(base, build)
    let changed = writeIfChanged(out.png, encodePng(build.width, build.height, build.flat))
    const writePart = (
      name: string | null,
      part: { image: { width: number; height: number; pixels: Uint8Array } },
    ) => {
      if (name)
        changed =
          writeIfChanged(
            path.join(dir, name),
            encodePng(part.image.width, part.image.height, part.image.pixels),
          ) || changed
    }
    build.parts.forEach((part, i) => {
      writePart(files[i] ?? null, part)
    })
    const languages = views.langs.flatMap((lang) => {
      const version = cgLanguage(base, build, lang, buildCg(views.view(lang), quiet), say)
      return version ? [version] : []
    })
    const keep = new Set<string>(files.filter((f): f is string => f !== null))
    for (const version of languages) {
      if (version.flat) {
        keep.add(version.flat)
        changed =
          writeIfChanged(
            path.join(dir, version.flat),
            encodePng(version.build.width, version.build.height, version.build.flat),
          ) || changed
      }
      version.build.parts.forEach((part, i) => {
        const name = version.files[i] ?? null
        if (name) keep.add(name)
        writePart(name, part)
      })
    }
    // Parts of toggles (or languages) that were renamed or removed.
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith(`${base}.`) && entry.endsWith('.part.gen.png') && !keep.has(entry))
        rmSync(path.join(dir, entry))
    }
    removeStale(dir, base, allLangs, keep)
    const module = renderCgModule(label, path.basename(out.png), build, files, languages)
    return writeIfChanged(out.ts, module) || changed
  }
  if (isSpriteSource(source)) {
    // Animated sprite sheet (map characters, objects): every frame + tags.
    const sheet = buildSprite(
      file,
      say,
      views.langs.map((lang) => ({ lang, file: views.view(lang) })),
    )
    const packedSprite = packSprite(sheet)
    const png = encodePng(packedSprite.width, packedSprite.height, packedSprite.pixels)
    let changed = writeIfChanged(out.png, png)
    const langSheets: Record<string, string> = {}
    for (const [lang, cells] of Object.entries(sheet.langCells)) {
      const own = packSprite(sheet, cells)
      const name = `${base}.${lang}.gen.png`
      langSheets[lang] = name
      changed =
        writeIfChanged(path.join(dir, name), encodePng(own.width, own.height, own.pixels)) ||
        changed
    }
    removeStale(dir, base, allLangs, new Set(Object.values(langSheets)))
    const module = renderSpriteModule(
      label,
      path.basename(out.png),
      sheet,
      packedSprite,
      langSheets,
    )
    return writeIfChanged(out.ts, module) || changed
  }
  const slots = buildSlots(file, say)
  for (const lang of views.langs)
    addLanguageSlots(slots, lang, buildSlots(views.view(lang), quiet), say)
  const packed = pack(slotBitmaps(slots))
  const pngChanged = writeIfChanged(out.png, encodePng(packed.width, packed.height, packed.pixels))
  const tsChanged = writeIfChanged(
    out.ts,
    renderModule(label, path.basename(out.png), file, slots, packed, findFace(file, say)),
  )
  return pngChanged || tsChanged
}

export function generateAllAseprite(root: string, warn: (message: string) => void = console.warn) {
  let changed = false
  for (const source of findSources(path.join(root, CONTENT_DIR))) {
    try {
      changed = generateFromAseprite(source, warn) || changed
    } catch (error) {
      warn(
        `[aseprite] ${path.relative(root, source)}: ${error instanceof Error ? error.message : error}`,
      )
    }
  }
  return changed
}

export function asepritePlugin(): Plugin {
  let root = process.cwd()
  let publicDir = ''
  return {
    name: 'game-aseprite',
    // Run before Vite's own asset handling, which would otherwise serve ?url / ?raw imports first.
    enforce: 'pre',
    configResolved(config) {
      root = config.root
      publicDir = config.publicDir
    },
    buildStart() {
      generateAllAseprite(root, (message) => this.warn(message))
      // public/ is copied into the build as-is, so source files must never live there.
      const leaked = publicDir ? findSources(publicDir) : []
      if (leaked.length > 0) {
        this.error(
          `Aseprite source files must not be in public/ (they would ship): ${leaked.join(', ')}`,
        )
      }
    },
    // Guard 1: game code may never import a source file, in any form (?url, ?raw, ?inline…).
    // Small files would otherwise be inlined into the JavaScript, not emitted as a file.
    resolveId(source, importer) {
      const file = source.split('?')[0] ?? source
      if (SOURCE.test(file)) {
        const where = importer ? ` (in ${path.relative(root, importer)})` : ''
        this.error(
          `Don't import Aseprite source files in game code: ${source}${where}. ` +
            'Import the generated .gen.ts next to it instead. Source files must never ship.',
        )
      }
      return null
    },
    load(id) {
      const file = id.split('?')[0] ?? id
      if (SOURCE.test(file))
        this.error(`Aseprite source files must never ship: ${path.relative(root, file)}`)
      return null
    },
    // Guard 2 (belt and braces): no emitted file may be an Aseprite source.
    generateBundle(_options, bundle) {
      // Guard: an accidental `import x from './jack.aseprite'` must never ship the source file.
      const leaked = Object.keys(bundle).filter((name) => SOURCE.test(name))
      if (leaked.length > 0)
        this.error(`Aseprite source files would be in the build: ${leaked.join(', ')}`)
    },
    configureServer(server) {
      const regenerate = (file: string) => {
        if (!SOURCE.test(file)) return
        try {
          if (generateFromAseprite(file, (m) => server.config.logger.warn(m))) {
            server.config.logger.info(`[aseprite] updated ${path.relative(root, file)}`, {
              timestamp: true,
            })
          }
        } catch (error) {
          server.config.logger.error(`[aseprite] ${path.relative(root, file)}: ${error}`)
        }
      }
      server.watcher.on('add', regenerate)
      server.watcher.on('change', regenerate)
      server.watcher.on('unlink', (file) => {
        if (!SOURCE.test(file)) return
        const out = outputs(file)
        rmSync(out.png, { force: true })
        rmSync(out.ts, { force: true })
        // A layered CG's toggle layers too.
        const dir = path.dirname(file)
        const base = path.basename(out.png, '.gen.png')
        for (const entry of existsSync(dir) ? readdirSync(dir) : []) {
          if (entry.startsWith(`${base}.`) && entry.endsWith('.part.gen.png'))
            rmSync(path.join(dir, entry))
        }
        // Its language sheets ("<name>.<lang>" layers).
        removeStale(dir, base, contentLanguages(root), new Set())
      })
    },
  }
}
