// Vite plugin for game media (settings: src/content/config/media.ts):
// - `vite build` converts imported images and sounds under src/content (lossless normally; the lite
//   build, `vite build --mode lite`, shrinks big pictures and makes Opus sounds). Dev serves originals.
// - `virtual:gallery-thumbnails` maps every gallery picture's URL (and each event's preview.*) to a
//   small thumbnail (dev + build).
// - Event modules get `export const __media`: the pictures they use, in order (scene/preload.ts).
// Converted files are cached in node_modules/.cache/game-media by content + settings, so a rebuild
// only converts what is new or changed.
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { type Plugin, runnerImport } from 'vite'
import type { MediaConfig } from '../../src/core/media.ts'
import {
  activeVariants,
  isOffFile,
  isVariantName,
  variantFile,
  variantValues,
} from '../variants.ts'
import { AUDIO_FILE, audioPlan, convertAudio } from './audio.ts'
import { pickRule } from './cache.ts'
import { renderEventMedia, scanEventMedia } from './events.ts'
import { convertImage, imagePlan, makeThumbnail } from './images.ts'

const CONTENT_DIR = 'src/content'
const CONFIG_FILE = 'src/content/config/media.ts'
const CONVERTIBLE_IMAGE = /\.(png|jpe?g)$/i
/** Pictures that get a thumbnail. Layer files of layered CGs (*.part.gen.png) are not pictures. */
const PICTURE = /\.(png|jpe?g|webp|avif)$/i
const LAYER_PART = /\.part\.gen\.png$/i
const VIRTUAL = 'virtual:gallery-thumbnails'
const RESOLVED_VIRTUAL = `\0${VIRTUAL}`
const EVENT_MODULE = /[\\/]src[\\/]content[\\/]events[\\/].*\.(ts|tsx|vn)$/
/** Scene card pictures of events (`replay: { preview }`) get a thumbnail too: name them preview.*. */
const PREVIEW = /^preview\.(png|jpe?g|webp|avif)$/i

function findPictures(dir: string, only: RegExp = PICTURE): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return findPictures(full, only)
    return only.test(entry.name) && !LAYER_PART.test(entry.name) ? [full] : []
  })
}

export function mediaPlugin(): Plugin {
  let root = process.cwd()
  let isBuild = false
  let lite = false
  let cacheDir = ''
  let config: Promise<MediaConfig> | undefined
  const contentDir = () => path.join(root, CONTENT_DIR)
  const galleryDir = () => path.join(contentDir(), 'gallery')
  const eventsDir = () => path.join(contentDir(), 'events')
  // Content variants (vite/variants.ts): pictures named for a value are versions, not pictures of
  // their own; each picture is thumbnailed as this build shows it (its variant file, if any).
  const thumbnailed = () => {
    const all = variantValues(root)
    const active = Object.values(activeVariants(root))
    return (
      [...findPictures(galleryDir()), ...findPictures(eventsDir(), PREVIEW)]
        .filter((file) => !isVariantName(path.basename(file).replace(/\.[^.]+$/, ''), all))
        // Nothing of a version this build lacks: an off scene's preview, a CG only it uses.
        .filter((file) => !isOffFile(file))
        .map((file) => variantFile(file, active))
    )
  }

  return {
    name: 'game-media',
    // Before Vite's own asset handling, so the converted file is the one it emits.
    enforce: 'pre',
    configResolved(resolved) {
      root = resolved.root
      isBuild = resolved.command === 'build'
      lite = resolved.mode === 'lite'
      cacheDir = path.join(root, 'node_modules/.cache/game-media')
      // Loaded through Vite so the content file's '@/core/...' import resolves.
      config = runnerImport<{ default: MediaConfig }>(path.join(root, CONFIG_FILE), {
        configFile: false,
        root,
        resolve: { alias: resolved.resolve.alias },
        logLevel: 'silent',
      }).then((result) => result.module.default)
    },
    async resolveId(source, importer, options) {
      if (source === VIRTUAL) return RESOLVED_VIRTUAL
      if (!isBuild || !config || source.includes('?')) return null
      const isImage = CONVERTIBLE_IMAGE.test(source)
      if (!isImage && !AUDIO_FILE.test(source)) return null
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
      if (!resolved || resolved.external) return null
      const relative = path.relative(contentDir(), resolved.id)
      if (relative.startsWith('..') || path.isAbsolute(relative)) return null
      const where = relative.split(path.sep).join('/')
      const settings = await config
      const warn = (message: string) => this.warn(message)
      if (isImage) {
        const plan = imagePlan(pickRule(settings.images.convert, where), resolved.id, lite)
        return convertImage(resolved.id, plan, path.join(cacheDir, 'images'), warn)
      }
      const plan = audioPlan(pickRule(settings.audio.convert, where), resolved.id, lite)
      return convertAudio(resolved.id, plan, path.join(cacheDir, 'audio'), warn)
    },
    async load(id) {
      if (id !== RESOLVED_VIRTUAL || !config) return null
      const { thumbnails } = (await config).images
      const pictures = thumbnailed()
      const thumbs = await Promise.all(
        pictures.map((p) => makeThumbnail(p, thumbnails, path.join(cacheDir, 'thumbnails'))),
      )
      const imports = pictures.map(
        (picture, i) =>
          `import i${i} from ${JSON.stringify(picture)}\nimport t${i} from ${JSON.stringify(thumbs[i])}`,
      )
      const entries = pictures.map((_, i) => `[i${i}]: t${i}`)
      return `${imports.join('\n')}\nexport default { ${entries.join(', ')} }\n`
    },
    transform(code, id) {
      const file = id.split('?')[0] ?? id
      if (!EVENT_MODULE.test(file) || /\.test\.tsx?$/.test(file)) return null
      return { code: code + renderEventMedia(scanEventMedia(code)), map: null }
    },
    configureServer(server) {
      // A gallery picture or event preview added / removed changes the thumbnail list.
      const refresh = (file: string) => {
        const name = path.basename(file)
        const wanted =
          (PICTURE.test(name) && file.startsWith(galleryDir())) ||
          (PREVIEW.test(name) && file.startsWith(eventsDir()))
        if (!wanted) return
        const module = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL)
        if (module) server.moduleGraph.invalidateModule(module)
      }
      server.watcher.on('add', refresh)
      server.watcher.on('unlink', refresh)
      server.watcher.on('change', refresh)
    },
  }
}
