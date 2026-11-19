// Vite plugin: turns every src/content/**/*.tmx / *.tmj (Tiled map) into name.gen.ts next to it,
// with tileset images imported and spawn/object names typed.
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'
import { readTiledMap, type TiledMap } from './read.ts'

const CONTENT_DIR = 'src/content'
const MAP = /\.(tmx|tmj)$/i
const TILESET = /\.tsj$/i
const ID = /^[a-z][a-z0-9_]*$/

function findMaps(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return findMaps(full)
    return MAP.test(entry.name) ? [full] : []
  })
}

const output = (source: string) => source.replace(MAP, '.gen.ts')

/** Spawns = objects with class "spawn"; every other named object can get behaviour in TypeScript. */
export function namesOf(map: TiledMap, warn: (message: string) => void) {
  const spawns = new Set<string>()
  const objects = new Set<string>()
  for (const layer of map.layers) {
    if (layer.kind !== 'objects') continue
    for (const object of layer.objects) {
      if (!object.name) continue
      const isSpawn = object.type.toLowerCase() === 'spawn'
      if (!ID.test(object.name)) {
        warn(
          `object "${object.name}": names need lowercase letters/digits/_ (starting with a letter)`,
        )
        continue
      }
      const set = isSpawn ? spawns : objects
      if (set.has(object.name))
        warn(`two ${isSpawn ? 'spawns' : 'objects'} are called "${object.name}"`)
      set.add(object.name)
    }
  }
  return { spawns: [...spawns], objects: [...objects] }
}

export function renderMapModule(
  sourceName: string,
  map: TiledMap,
  warn: (message: string) => void,
  options: { isStructure?: boolean } = {},
) {
  const { spawns, objects } = namesOf(map, warn)
  // Structures are stamped into other maps, so they have no spawns of their own.
  if (spawns.length === 0 && !options.isStructure) {
    warn('no spawn points: add a point object with class "spawn" and a name')
  }
  const imports: string[] = []
  const tilesets = map.tilesets.map((tileset, i) => {
    const relative = tileset.image.startsWith('.') ? tileset.image : `./${tileset.image}`
    imports.push(`import tileset${i} from '${relative.split(path.sep).join('/')}'`)
    return { ...tileset, image: `__TILESET_IMAGE_${i}__` }
  })
  // Image layers (backdrops, fog): their pictures are imported too.
  let pictures = 0
  const layers = map.layers.map((layer) => {
    if (layer.kind !== 'image') return layer
    const i = pictures++
    const relative = layer.image.startsWith('.') ? layer.image : `./${layer.image}`
    imports.push(`import layerImage${i} from '${relative.split(path.sep).join('/')}'`)
    return { ...layer, image: `__LAYER_IMAGE_${i}__` }
  })
  const body = JSON.stringify({ ...map, layers, tilesets })
    .replace(/"__TILESET_IMAGE_(\d+)__"/g, 'tileset$1')
    .replace(/"__LAYER_IMAGE_(\d+)__"/g, 'layerImage$1')
  const union = (names: string[]) =>
    names.length ? names.map((n) => `'${n}'`).join(' | ') : 'never'
  return [
    `// AUTO-GENERATED from ${sourceName} by vite/tiled. Do not edit: change the map in Tiled instead.`,
    "import type { TiledMapData } from '@/core/world/tiled'",
    ...imports,
    '',
    `const data = ${body}`,
    '',
    `export default data as unknown as TiledMapData<${union(spawns)}, ${union(objects)}>`,
    '',
  ].join('\n')
}

export function generateFromTiled(source: string, warn: (message: string) => void = console.warn) {
  const label = path.basename(source)
  const map = readTiledMap(source)
  const isStructure = source.split(path.sep).includes('structures')
  const text = renderMapModule(label, map, (m) => warn(`[tiled] ${label}: ${m}`), { isStructure })
  const out = output(source)
  if (existsSync(out) && readFileSync(out, 'utf8') === text) return false
  writeFileSync(out, text)
  return true
}

export function generateAllTiled(root: string, warn: (message: string) => void = console.warn) {
  let changed = false
  for (const source of findMaps(path.join(root, CONTENT_DIR))) {
    try {
      changed = generateFromTiled(source, warn) || changed
    } catch (error) {
      warn(
        `[tiled] ${path.relative(root, source)}: ${error instanceof Error ? error.message : error}`,
      )
    }
  }
  return changed
}

export function tiledPlugin(): Plugin {
  let root = process.cwd()
  return {
    name: 'game-tiled',
    configResolved(config) {
      root = config.root
    },
    buildStart() {
      generateAllTiled(root, (message) => this.warn(message))
    },
    configureServer(server) {
      const log = server.config.logger
      const onChange = (file: string) => {
        // A tileset change can affect any map that uses it: regenerate them all (it's quick).
        if (TILESET.test(file)) {
          if (generateAllTiled(root, (m) => log.warn(m)))
            log.info('[tiled] updated maps', { timestamp: true })
          return
        }
        if (!MAP.test(file)) return
        try {
          if (generateFromTiled(file, (m) => log.warn(m))) {
            log.info(`[tiled] updated ${path.relative(root, file)}`, { timestamp: true })
          }
        } catch (error) {
          log.error(
            `[tiled] ${path.relative(root, file)}: ${error instanceof Error ? error.message : error}`,
          )
        }
      }
      server.watcher.on('add', onChange)
      server.watcher.on('change', onChange)
      server.watcher.on('unlink', (file) => {
        if (MAP.test(file)) rmSync(output(file), { force: true })
      })
    },
  }
}
