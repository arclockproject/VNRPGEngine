// Vite plugin: turns every Spine export in src/content (a skeleton <name>.skel or <name>.json next to
// <name>.atlas and its page images) into <name>.gen.ts: the files as URLs plus the typed names of
// its animations and skins, and the box the character fills. It reads the export with Spine's own
// runtime code, so a broken export fails here, not in the game. The Spine editor's project files
// (.spine) must never ship: importing one is an error.
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import {
  AnimationState,
  AnimationStateData,
  AtlasAttachmentLoader,
  Physics,
  Skeleton,
  SkeletonBinary,
  type SkeletonData,
  SkeletonJson,
  TextureAtlas,
  Vector2,
} from '@esotericsoftware/spine-core'
import type { Plugin } from 'vite'

const CONTENT_DIR = 'src/content'
const ATLAS = /\.atlas$/i
/** The Spine editor's own project file: never in game code or a build. */
const PROJECT = /\.spine$/i
/** Frames per second when measuring how far the animations reach. */
const SAMPLE_FPS = 15

/** The runtime's Spine version (major.minor): exports must come from the same Spine version. */
function runtimeVersion(): string {
  const require = createRequire(import.meta.url)
  const pkg = require('@esotericsoftware/spine-pixi-v8/package.json') as { version: string }
  return pkg.version.split('.').slice(0, 2).join('.')
}

function findAtlases(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return findAtlases(full)
    return ATLAS.test(entry.name) ? [full] : []
  })
}

function findProjects(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return findProjects(full)
    return PROJECT.test(entry.name) ? [full] : []
  })
}

/** The skeleton of an export: <name>.skel (binary, what Spine recommends) or <name>.json. */
function skeletonOf(atlas: string): string | null {
  const base = atlas.replace(ATLAS, '')
  for (const ext of ['.skel', '.json']) if (existsSync(base + ext)) return base + ext
  return null
}

const genFile = (atlas: string) => `${atlas.replace(ATLAS, '')}.gen.ts`

function writeIfChanged(file: string, text: string) {
  if (existsSync(file) && readFileSync(file, 'utf8') === text) return false
  writeFileSync(file, text)
  return true
}

/** The box every animation stays inside (Spine units, y up), a little padded. */
function measure(data: SkeletonData) {
  const skeleton = new Skeleton(data)
  const offset = new Vector2()
  const size = new Vector2()
  const temp: number[] = []
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  const take = () => {
    skeleton.updateWorldTransform(Physics.update)
    skeleton.getBounds(offset, size, temp)
    if (!Number.isFinite(offset.x) || size.x <= 0) return
    minX = Math.min(minX, offset.x)
    minY = Math.min(minY, offset.y)
    maxX = Math.max(maxX, offset.x + size.x)
    maxY = Math.max(maxY, offset.y + size.y)
  }
  // Every skin, so a hat or an outfit is never cut off.
  const skins = data.skins.length > 0 ? data.skins : [null]
  for (const skin of skins) {
    skeleton.setSkin(skin)
    skeleton.setupPose()
    take()
    for (const animation of data.animations) {
      const state = new AnimationState(new AnimationStateData(data))
      skeleton.setupPose()
      state.setAnimation(0, animation, false)
      const steps = Math.max(1, Math.ceil(animation.duration * SAMPLE_FPS))
      for (let i = 0; i <= steps; i++) {
        state.apply(skeleton)
        take()
        state.update(animation.duration / steps)
      }
    }
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, width: 1, height: 1 }
  const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.02)
  return {
    x: Math.floor(minX - pad),
    y: Math.floor(minY),
    width: Math.ceil(maxX - minX + 2 * pad),
    height: Math.ceil(maxY - minY + pad),
  }
}

const quote = (s: string) => JSON.stringify(s)

/** Reads one export and writes its .gen.ts. Returns true if it changed. */
export function generateFromSpine(
  atlasFile: string,
  warn: (message: string) => void = console.warn,
) {
  const label = path.basename(atlasFile)
  const skeletonFile = skeletonOf(atlasFile)
  if (!skeletonFile) {
    warn(
      `[spine] ${label}: no skeleton next to it (${path.basename(atlasFile, '.atlas')}.skel or .json)`,
    )
    return false
  }
  // A portrait is made with one tool: an Aseprite file or a Spine export, never both in one folder.
  const dir0 = path.dirname(atlasFile)
  const aseprite = readdirSync(dir0).filter((name) => /\.(aseprite|ase)$/i.test(name))
  if (aseprite.length > 0)
    throw new Error(
      `this folder has both a Spine export and Aseprite files (${aseprite.join(', ')}). A portrait is one or the other: keep one of them.`,
    )
  const atlasText = readFileSync(atlasFile, 'utf8')
  const atlas = new TextureAtlas(atlasText)
  const binary = skeletonFile.endsWith('.skel')
  const loader = new AtlasAttachmentLoader(atlas)
  const data = binary
    ? new SkeletonBinary(loader).readSkeletonData(new Uint8Array(readFileSync(skeletonFile)))
    : new SkeletonJson(loader).readSkeletonData(readFileSync(skeletonFile, 'utf8'))
  const exported = (data.version ?? '').split('.').slice(0, 2).join('.')
  const runtime = runtimeVersion()
  if (exported !== runtime)
    warn(
      `[spine] ${label}: exported with Spine ${data.version ?? '?'}, the game's runtime is ${runtime}. Export it again with Spine ${runtime}.x.`,
    )
  const dir = path.dirname(atlasFile)
  for (const page of atlas.pages)
    if (!existsSync(path.join(dir, page.name)))
      warn(`[spine] ${label}: page image ${page.name} is missing`)
  const box = measure(data)
  const pages = atlas.pages.map((page, i) => ({ name: page.name, id: `page${i}` }))
  const lines = [
    `// AUTO-GENERATED from the Spine export ${path.basename(skeletonFile)} + ${label}. Export again from Spine to change it.`,
    '/* eslint-disable */',
    "import { defineSpineExport } from '@/core/portrait/spine'",
    `import skeleton from './${path.basename(skeletonFile)}?url'`,
    `import atlas from './${label}?url'`,
    ...pages.map((page) => `import ${page.id} from './${page.name}?url'`),
    '',
    'export default defineSpineExport({',
    `  version: ${quote(data.version ?? '')},`,
    '  skeleton,',
    `  binary: ${binary},`,
    '  atlas,',
    `  pages: { ${pages.map((page) => `${quote(page.name)}: ${page.id}`).join(', ')} },`,
    `  animations: [${data.animations.map((a) => quote(a.name)).join(', ')}],`,
    `  skins: [${data.skins.map((s) => quote(s.name)).join(', ')}],`,
    `  // Where it is drawn: every animation and skin fits (Spine units, y up from the root).`,
    `  box: { x: ${box.x}, y: ${box.y}, width: ${box.width}, height: ${box.height} },`,
    '})',
    '',
  ]
  return writeIfChanged(genFile(atlasFile), lines.join('\n'))
}

export function generateAllSpine(root: string, warn: (message: string) => void = console.warn) {
  let changed = false
  for (const atlas of findAtlases(path.join(root, CONTENT_DIR))) {
    try {
      changed = generateFromSpine(atlas, warn) || changed
    } catch (error) {
      warn(
        `[spine] ${path.relative(root, atlas)}: ${error instanceof Error ? error.message : error}`,
      )
    }
  }
  return changed
}

export function spinePlugin(): Plugin {
  let root = process.cwd()
  let publicDir = ''
  return {
    name: 'game-spine',
    enforce: 'pre',
    configResolved(config) {
      root = config.root
      publicDir = config.publicDir
    },
    buildStart() {
      generateAllSpine(root, (message) => this.warn(message))
      const leaked = publicDir ? findProjects(publicDir) : []
      if (leaked.length > 0)
        this.error(
          `Spine project files must not be in public/ (they would ship): ${leaked.join(', ')}`,
        )
    },
    resolveId(source, importer) {
      const file = source.split('?')[0] ?? source
      if (PROJECT.test(file)) {
        const where = importer ? ` (in ${path.relative(root, importer)})` : ''
        this.error(
          `Don't import Spine project files in game code: ${source}${where}. Export the model from Spine (.skel or .json + .atlas + .png) and import its .gen.ts.`,
        )
      }
      return null
    },
    generateBundle(_options, bundle) {
      const leaked = Object.keys(bundle).filter((name) => PROJECT.test(name))
      if (leaked.length > 0)
        this.error(`Spine project files would be in the build: ${leaked.join(', ')}`)
    },
    configureServer(server) {
      const regenerate = (file: string) => {
        const atlas = ATLAS.test(file)
          ? file
          : /\.(skel|json|png)$/i.test(file)
            ? file.replace(/\.(skel|json|png)$/i, '.atlas')
            : null
        if (!atlas || !existsSync(atlas)) return
        try {
          if (generateFromSpine(atlas, (m) => server.config.logger.warn(m)))
            server.config.logger.info(`[spine] updated ${path.relative(root, atlas)}`, {
              timestamp: true,
            })
        } catch (error) {
          server.config.logger.error(`[spine] ${path.relative(root, atlas)}: ${error}`)
        }
      }
      server.watcher.on('add', regenerate)
      server.watcher.on('change', regenerate)
      server.watcher.on('unlink', (file) => {
        if (ATLAS.test(file)) rmSync(genFile(file), { force: true })
      })
    },
  }
}
