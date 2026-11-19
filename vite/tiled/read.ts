// Reads Tiled maps (.tmx XML or .tmj JSON) and tilesets (embedded, or external .tsj JSON).
// Format reference: https://doc.mapeditor.org/en/stable/reference/tmx-map-format/
// Note: external XML tilesets (.tsx) are not supported: the extension clashes with TypeScript.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { gunzipSync, inflateSync } from 'node:zlib'
import { XMLParser } from 'fast-xml-parser'

export type PropertyValue = string | number | boolean
export type Properties = Record<string, PropertyValue>

/** A collision shape drawn on a tile in Tiled's Tile Collision Editor (pixels from the tile's top-left). */
export interface TiledTileShape {
  x: number
  y: number
  w: number
  h: number
  /** False for ellipses and polygons: only their bounding box is used. */
  exact: boolean
}

export interface TiledTileInfo {
  type?: string
  properties: Properties
  animation?: { tile: number; duration: number }[]
  /** Collision shapes (Tile Collision Editor). Point objects are skipped. */
  collision?: TiledTileShape[]
}

export interface TiledTileset {
  firstgid: number
  name: string
  tileWidth: number
  tileHeight: number
  columns: number
  tileCount: number
  spacing: number
  margin: number
  /** Image path relative to the MAP file's folder. */
  image: string
  imageWidth: number
  imageHeight: number
  /** By local tile id. */
  tiles: Record<number, TiledTileInfo>
}

export interface TiledObject {
  id: number
  name: string
  /** Tiled "class" (called "type" before Tiled 1.9). */
  type: string
  x: number
  y: number
  width: number
  height: number
  /** Tile objects: the tile's global id (with flip flags). */
  gid?: number
  point: boolean
  visible: boolean
  properties: Properties
}

export type TiledLayer =
  | {
      kind: 'tiles'
      name: string
      visible: boolean
      opacity: number
      data: number[]
      properties: Properties
    }
  | {
      kind: 'objects'
      name: string
      visible: boolean
      objects: TiledObject[]
      properties: Properties
    }
  | TiledImageLayer

/** A Tiled image layer: one picture behind or over the map (sky, far hills, fog, clouds). */
export interface TiledImageLayer {
  kind: 'image'
  name: string
  visible: boolean
  opacity: number
  /** Image path relative to the MAP file's folder. */
  image: string
  /** Offset in map pixels. */
  x: number
  y: number
  /** Tiled's "Parallax Factor": 1 = moves with the map, 0 = stays on screen, 0.5 = half as fast. */
  parallaxX: number
  parallaxY: number
  repeatX: boolean
  repeatY: boolean
  properties: Properties
}

export interface TiledMap {
  width: number
  height: number
  tileWidth: number
  tileHeight: number
  /** Group layers are flattened (names become "Group/Layer"), in drawing order. */
  layers: TiledLayer[]
  tilesets: TiledTileset[]
  properties: Properties
}

// ---------------------------------------------------------------- tiny XML tree

interface XmlNode {
  name: string
  attrs: Record<string, string>
  children: XmlNode[]
  text: string
}

type Ordered = Record<string, unknown>[]

function toTree(items: Ordered): XmlNode[] {
  const nodes: XmlNode[] = []
  for (const item of items) {
    const name = Object.keys(item).find((k) => k !== ':@')
    if (!name || name === '#text') continue
    const children = toTree((item[name] as Ordered) ?? [])
    const text = ((item[name] as Ordered) ?? [])
      .map((c) =>
        typeof c['#text'] === 'string' || typeof c['#text'] === 'number' ? String(c['#text']) : '',
      )
      .join('')
    nodes.push({ name, attrs: (item[':@'] as Record<string, string>) ?? {}, children, text })
  }
  return nodes
}

function parseXml(text: string): XmlNode {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    preserveOrder: true,
    parseAttributeValue: false,
    parseTagValue: false,
    trimValues: true,
  })
  const root = toTree(parser.parse(text) as Ordered).find((n) => n.name !== '?xml')
  if (!root) throw new Error('empty XML file')
  return root
}

const child = (node: XmlNode, name: string) => node.children.find((c) => c.name === name)
const num = (value: unknown, fallback = 0) =>
  value === undefined || value === '' ? fallback : Number(value)

/** Bounding box of a shape: rectangles as they are, polygons/polylines by their points. */
function shapeOf(
  x: number,
  y: number,
  w: number,
  h: number,
  points: { x: number; y: number }[] | undefined,
  exact: boolean,
): TiledTileShape | undefined {
  if (points && points.length > 0) {
    const xs = points.map((p) => p.x)
    const ys = points.map((p) => p.y)
    const x0 = Math.min(...xs)
    const y0 = Math.min(...ys)
    const box = { x: x + x0, y: y + y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 }
    return box.w > 0 && box.h > 0 ? { ...box, exact: false } : undefined
  }
  return w > 0 && h > 0 ? { x, y, w, h, exact } : undefined
}

const parsePoints = (text: string | undefined) =>
  text
    ?.trim()
    .split(/\s+/)
    .map((pair) => {
      const [px, py] = pair.split(',')
      return { x: Number(px), y: Number(py) }
    })

function xmlShapes(group: XmlNode | undefined): TiledTileShape[] | undefined {
  if (!group) return undefined
  const shapes: TiledTileShape[] = []
  for (const o of group.children.filter((c) => c.name === 'object')) {
    if (child(o, 'point')) continue
    const poly = child(o, 'polygon') ?? child(o, 'polyline')
    const shape = shapeOf(
      num(o.attrs.x),
      num(o.attrs.y),
      num(o.attrs.width),
      num(o.attrs.height),
      parsePoints(poly?.attrs.points),
      !child(o, 'ellipse'),
    )
    if (shape) shapes.push(shape)
  }
  return shapes.length ? shapes : undefined
}

function jsonShapes(group: unknown): TiledTileShape[] | undefined {
  const objects = (group as { objects?: Record<string, unknown>[] } | undefined)?.objects
  if (!objects) return undefined
  const shapes: TiledTileShape[] = []
  for (const o of objects) {
    if (o.point === true) continue
    const points = (o.polygon ?? o.polyline) as { x: number; y: number }[] | undefined
    const shape = shapeOf(
      num(o.x),
      num(o.y),
      num(o.width),
      num(o.height),
      points,
      o.ellipse !== true,
    )
    if (shape) shapes.push(shape)
  }
  return shapes.length ? shapes : undefined
}

// ---------------------------------------------------------------- properties

function convert(type: string | undefined, value: unknown): PropertyValue {
  if (type === 'bool') return value === true || value === 'true'
  if (type === 'int' || type === 'float' || type === 'object') return Number(value)
  return String(value ?? '')
}

function xmlProperties(node: XmlNode | undefined): Properties {
  const result: Properties = {}
  for (const p of child(node ?? { name: '', attrs: {}, children: [], text: '' }, 'properties')
    ?.children ?? []) {
    if (p.name !== 'property' || !p.attrs.name) continue
    result[p.attrs.name] = convert(p.attrs.type, p.attrs.value ?? p.text)
  }
  return result
}

function jsonProperties(list: unknown): Properties {
  const result: Properties = {}
  for (const p of (list as { name: string; type?: string; value: unknown }[] | undefined) ?? []) {
    result[p.name] = convert(p.type, p.value)
  }
  return result
}

// ---------------------------------------------------------------- tile data

function decodeData(
  encoding: string | undefined,
  compression: string | undefined,
  text: string,
): number[] {
  if (!encoding || encoding === 'csv') {
    return text
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((v) => Number(v) >>> 0)
  }
  if (encoding !== 'base64') throw new Error(`unsupported tile encoding "${encoding}"`)
  let bytes = Buffer.from(text.trim(), 'base64')
  if (compression === 'zlib') bytes = inflateSync(bytes)
  else if (compression === 'gzip') bytes = gunzipSync(bytes)
  else if (compression)
    throw new Error(`unsupported tile compression "${compression}" (use zlib, gzip or none)`)
  const gids: number[] = []
  for (let i = 0; i + 3 < bytes.length; i += 4) gids.push(bytes.readUInt32LE(i))
  return gids
}

// ---------------------------------------------------------------- tilesets

const withShapes = (collision: TiledTileShape[] | undefined) => (collision ? { collision } : {})

/** Reads an embedded (XML) tileset. `baseDir` = folder its image path is relative to. */
function xmlTileset(
  node: XmlNode,
  firstgid: number,
  baseDir: string,
  mapDir: string,
): TiledTileset {
  const image = child(node, 'image')
  if (!image)
    throw new Error(
      `tileset "${node.attrs.name}" has no single image (image collections are not supported)`,
    )
  const tiles: Record<number, TiledTileInfo> = {}
  for (const tile of node.children.filter((c) => c.name === 'tile')) {
    const animation = child(tile, 'animation')
    tiles[num(tile.attrs.id)] = {
      type: tile.attrs.class ?? tile.attrs.type,
      properties: xmlProperties(tile),
      animation: animation?.children
        .filter((f) => f.name === 'frame')
        .map((f) => ({ tile: num(f.attrs.tileid), duration: num(f.attrs.duration, 100) })),
      ...withShapes(xmlShapes(child(tile, 'objectgroup'))),
    }
  }
  return {
    firstgid,
    name: node.attrs.name ?? '',
    tileWidth: num(node.attrs.tilewidth),
    tileHeight: num(node.attrs.tileheight),
    columns: num(node.attrs.columns),
    tileCount: num(node.attrs.tilecount),
    spacing: num(node.attrs.spacing),
    margin: num(node.attrs.margin),
    image: path.relative(mapDir, path.resolve(baseDir, image.attrs.source ?? '')),
    imageWidth: num(image.attrs.width),
    imageHeight: num(image.attrs.height),
    tiles,
  }
}

type Json = Record<string, unknown>

function jsonTileset(t: Json, firstgid: number, baseDir: string, mapDir: string): TiledTileset {
  if (typeof t.image !== 'string') {
    throw new Error(`tileset "${t.name}" has no single image (image collections are not supported)`)
  }
  const tiles: Record<number, TiledTileInfo> = {}
  for (const tile of (t.tiles as Json[] | undefined) ?? []) {
    tiles[num(tile.id)] = {
      type: (tile.class ?? tile.type) as string | undefined,
      properties: jsonProperties(tile.properties),
      animation: (tile.animation as Json[] | undefined)?.map((f) => ({
        tile: num(f.tileid),
        duration: num(f.duration, 100),
      })),
      ...withShapes(jsonShapes(tile.objectgroup)),
    }
  }
  return {
    firstgid,
    name: String(t.name ?? ''),
    tileWidth: num(t.tilewidth),
    tileHeight: num(t.tileheight),
    columns: num(t.columns),
    tileCount: num(t.tilecount),
    spacing: num(t.spacing),
    margin: num(t.margin),
    image: path.relative(mapDir, path.resolve(baseDir, t.image)),
    imageWidth: num(t.imagewidth),
    imageHeight: num(t.imageheight),
    tiles,
  }
}

function externalTileset(source: string, firstgid: number, mapDir: string): TiledTileset {
  const file = path.resolve(mapDir, source)
  if (/\.tsx$/i.test(file)) {
    throw new Error(
      `external tileset ${source}: save tilesets as .tsj (JSON) or embed them; .tsx clashes with TypeScript`,
    )
  }
  return jsonTileset(
    JSON.parse(readFileSync(file, 'utf8')) as Json,
    firstgid,
    path.dirname(file),
    mapDir,
  )
}

// ---------------------------------------------------------------- maps

function xmlObject(o: XmlNode): TiledObject {
  return {
    id: num(o.attrs.id),
    name: o.attrs.name ?? '',
    type: o.attrs.class ?? o.attrs.type ?? '',
    x: num(o.attrs.x),
    y: num(o.attrs.y),
    width: num(o.attrs.width),
    height: num(o.attrs.height),
    gid: o.attrs.gid === undefined ? undefined : Number(o.attrs.gid) >>> 0,
    point: child(o, 'point') !== undefined,
    visible: o.attrs.visible !== '0',
    properties: xmlProperties(o),
  }
}

function readTmx(file: string): TiledMap {
  const map = parseXml(readFileSync(file, 'utf8'))
  if (map.name !== 'map') throw new Error('not a Tiled map')
  const mapDir = path.dirname(file)
  if ((map.attrs.orientation ?? 'orthogonal') !== 'orthogonal')
    throw new Error('only orthogonal maps are supported')
  if (map.attrs.infinite === '1')
    throw new Error('infinite maps are not supported (Map > Map Properties > Infinite)')

  const tilesets = map.children
    .filter((c) => c.name === 'tileset')
    .map((t) =>
      t.attrs.source
        ? externalTileset(t.attrs.source, num(t.attrs.firstgid), mapDir)
        : xmlTileset(t, num(t.attrs.firstgid), mapDir, mapDir),
    )

  const layers: TiledLayer[] = []
  const walk = (nodes: XmlNode[], prefix: string, visible: boolean, opacity: number) => {
    for (const node of nodes) {
      const name = prefix + (node.attrs.name ?? '')
      const isVisible = visible && node.attrs.visible !== '0'
      const layerOpacity = opacity * num(node.attrs.opacity, 1)
      if (node.name === 'layer') {
        const data = child(node, 'data')
        const gids = data?.attrs.encoding
          ? decodeData(data.attrs.encoding, data.attrs.compression, data.text)
          : (data?.children.filter((c) => c.name === 'tile').map((c) => num(c.attrs.gid) >>> 0) ??
            [])
        layers.push({
          kind: 'tiles',
          name,
          visible: isVisible,
          opacity: layerOpacity,
          data: gids,
          properties: xmlProperties(node),
        })
      } else if (node.name === 'objectgroup') {
        layers.push({
          kind: 'objects',
          name,
          visible: isVisible,
          objects: node.children.filter((c) => c.name === 'object').map(xmlObject),
          properties: xmlProperties(node),
        })
      } else if (node.name === 'imagelayer') {
        const source = child(node, 'image')?.attrs.source
        if (source)
          layers.push({
            kind: 'image',
            name,
            visible: isVisible,
            opacity: layerOpacity,
            image: source,
            x: num(node.attrs.offsetx),
            y: num(node.attrs.offsety),
            parallaxX: num(node.attrs.parallaxx, 1),
            parallaxY: num(node.attrs.parallaxy, 1),
            repeatX: node.attrs.repeatx === '1',
            repeatY: node.attrs.repeaty === '1',
            properties: xmlProperties(node),
          })
      } else if (node.name === 'group') {
        walk(node.children, `${name}/`, isVisible, layerOpacity)
      }
    }
  }
  walk(map.children, '', true, 1)

  return {
    width: num(map.attrs.width),
    height: num(map.attrs.height),
    tileWidth: num(map.attrs.tilewidth),
    tileHeight: num(map.attrs.tileheight),
    layers,
    tilesets,
    properties: xmlProperties(map),
  }
}

function readTmj(file: string): TiledMap {
  const map = JSON.parse(readFileSync(file, 'utf8')) as Json
  const mapDir = path.dirname(file)
  if ((map.orientation ?? 'orthogonal') !== 'orthogonal')
    throw new Error('only orthogonal maps are supported')
  if (map.infinite === true)
    throw new Error('infinite maps are not supported (Map > Map Properties > Infinite)')

  const tilesets = ((map.tilesets as Json[]) ?? []).map((t) =>
    typeof t.source === 'string'
      ? externalTileset(t.source, num(t.firstgid), mapDir)
      : jsonTileset(t, num(t.firstgid), mapDir, mapDir),
  )

  const layers: TiledLayer[] = []
  const walk = (list: Json[], prefix: string, visible: boolean, opacity: number) => {
    for (const layer of list) {
      const name = prefix + String(layer.name ?? '')
      const isVisible = visible && layer.visible !== false
      const layerOpacity = opacity * num(layer.opacity, 1)
      if (layer.type === 'tilelayer') {
        const data =
          typeof layer.data === 'string'
            ? decodeData(layer.encoding as string, layer.compression as string, layer.data)
            : ((layer.data as number[]) ?? []).map((v) => v >>> 0)
        layers.push({
          kind: 'tiles',
          name,
          visible: isVisible,
          opacity: layerOpacity,
          data,
          properties: jsonProperties(layer.properties),
        })
      } else if (layer.type === 'objectgroup') {
        layers.push({
          kind: 'objects',
          name,
          visible: isVisible,
          properties: jsonProperties(layer.properties),
          objects: ((layer.objects as Json[]) ?? []).map((o) => ({
            id: num(o.id),
            name: String(o.name ?? ''),
            type: String(o.class ?? o.type ?? ''),
            x: num(o.x),
            y: num(o.y),
            width: num(o.width),
            height: num(o.height),
            gid: o.gid === undefined ? undefined : Number(o.gid) >>> 0,
            point: o.point === true,
            visible: o.visible !== false,
            properties: jsonProperties(o.properties),
          })),
        })
      } else if (layer.type === 'imagelayer') {
        if (typeof layer.image === 'string' && layer.image)
          layers.push({
            kind: 'image',
            name,
            visible: isVisible,
            opacity: layerOpacity,
            image: layer.image,
            x: num(layer.offsetx),
            y: num(layer.offsety),
            parallaxX: num(layer.parallaxx, 1),
            parallaxY: num(layer.parallaxy, 1),
            repeatX: layer.repeatx === true,
            repeatY: layer.repeaty === true,
            properties: jsonProperties(layer.properties),
          })
      } else if (layer.type === 'group') {
        walk((layer.layers as Json[]) ?? [], `${name}/`, isVisible, layerOpacity)
      }
    }
  }
  walk((map.layers as Json[]) ?? [], '', true, 1)

  return {
    width: num(map.width),
    height: num(map.height),
    tileWidth: num(map.tilewidth),
    tileHeight: num(map.tileheight),
    layers,
    tilesets,
    properties: jsonProperties(map.properties),
  }
}

export function readTiledMap(file: string): TiledMap {
  return /\.tmj$|\.json$/i.test(file) ? readTmj(file) : readTmx(file)
}
