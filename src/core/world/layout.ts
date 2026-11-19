// One format for everything the world draws: Tiled maps and structures (small maps stamped into
// the current one) both become a Layout.
import type {
  DoorTarget,
  Facing,
  MapObject,
  MapTransition,
  PropertyValue,
  TilePos,
} from '../define'
import type { AudioId, EnemyId, PropId, TroopId } from '../registry'
import { addSolidObjects, type Box, hasOffset, isActor } from './grid'
import {
  decodeGid,
  type TiledMapData,
  type TiledTileShapeData,
  type TiledTilesetData,
} from './tiled'

/** A rectangle of an image. w/h 0 = the whole image. */
export interface TexRef {
  image: string
  x: number
  y: number
  w: number
  h: number
}

export interface DrawTile {
  tex: TexRef
  flipH: boolean
  flipV: boolean
  flipD: boolean
  /** Animated tiles: the frames to cycle through. */
  frames?: { tex: TexRef; duration: number }[]
}

export type DrawLayer = { kind: 'tiles'; tiles: (DrawTile | null)[]; opacity: number }

/**
 * Tiles from a "sorted" layer that touch each other: drawn as one piece among the objects and the
 * player, in front of whoever stands above its bottom edge (a house: walk behind it, or in front).
 */
export interface SortedPiece {
  /** Row-major cell index -> tile. */
  cells: { i: number; tile: DrawTile }[]
  /** Its bottom edge, in tiles (row of its lowest tile + 1). */
  bottom: number
  opacity: number
}

/** A map object plus, for Tiled tile objects, the tile it is drawn with. */
export interface LayoutObject extends MapObject {
  tile?: DrawTile
}

export interface Layout {
  width: number
  height: number
  /** Pixel size of one tile in the art. */
  tileSize: number
  /** Row-major collision grid (tiles and solid objects). */
  solid: boolean[]
  /** Drawn below the player and objects. */
  below: DrawLayer[]
  /** Drawn above them (roofs, treetops). */
  above: DrawLayer[]
  /** Sorted with the objects and the player by their bottom edge (houses, walls, fences). */
  sorted: SortedPiece[]
  /** Collision smaller than a tile, in tiles (Tile Collision Editor shapes). */
  boxes: Box[]
  objects: LayoutObject[]
  spawns: Record<string, TilePos & { facing?: Facing }>
  /** Nearest-neighbour scaling (pixel art). */
  pixelated: boolean
  warnings: string[]
  /**
   * Row-major: what the ground is at each cell (a name from src/content/terrain.ts), from the
   * tile property `terrain` or a layer property `terrain`. Later layers win. Missing = none.
   */
  terrain?: (string | undefined)[]
  /** Pictures behind or over the map (Tiled image layers): far hills, fog, clouds. */
  pictures?: PictureLayer[]
}

/** One Tiled image layer, as the World draws it. */
export interface PictureLayer {
  image: string
  /** Drawn over the map and the player (it came after the first object layer, or above=true). */
  above: boolean
  /** Offset in map pixels. */
  x: number
  y: number
  /** 1 = moves with the map, 0 = fixed on screen. */
  parallax: { x: number; y: number }
  repeat: { x: boolean; y: boolean }
  /** Moves by itself, map pixels per second (clouds, fog): layer properties driftx / drifty. */
  drift: { x: number; y: number }
  opacity: number
  /** Layer property blend: 'add' or 'multiply' (light shafts, shadows of clouds). */
  blend?: 'add' | 'multiply' | 'screen'
}

// ---------------------------------------------------------------- Tiled maps

/** Behaviour (and overrides) for a Tiled object, keyed by its name in Tiled. */
export type ObjectBehaviour = Omit<MapObject, 'at' | 'size' | 'id'>

export interface TiledSource {
  tiled: TiledMapData
  objects?: Record<string, ObjectBehaviour | undefined>
  /** Extra objects that are not in the Tiled map. */
  extraObjects?: MapObject[]
}

function tilesetFor(data: TiledMapData, gid: number): TiledTilesetData | undefined {
  let found: TiledTilesetData | undefined
  for (const tileset of data.tilesets) if (tileset.firstgid <= gid) found = tileset
  return found
}

function texFor(tileset: TiledTilesetData, local: number): TexRef {
  const columns = Math.max(1, tileset.columns)
  return {
    image: tileset.image,
    x: tileset.margin + (local % columns) * (tileset.tileWidth + tileset.spacing),
    y: tileset.margin + Math.floor(local / columns) * (tileset.tileHeight + tileset.spacing),
    w: tileset.tileWidth,
    h: tileset.tileHeight,
  }
}

/** A drawable tile for a raw gid (with flip flags), or null for empty. */
export function tileForGid(data: TiledMapData, raw: number): DrawTile | null {
  const { gid, flipH, flipV, flipD } = decodeGid(raw)
  if (gid === 0) return null
  const tileset = tilesetFor(data, gid)
  if (!tileset) return null
  const local = gid - tileset.firstgid
  const animation = tileset.tiles[local]?.animation
  return {
    tex: texFor(tileset, local),
    flipH,
    flipV,
    flipD,
    frames: animation?.length
      ? animation.map((frame) => ({ tex: texFor(tileset, frame.tile), duration: frame.duration }))
      : undefined,
  }
}

function tileInfo(data: TiledMapData, raw: number) {
  const { gid } = decodeGid(raw)
  const tileset = gid ? tilesetFor(data, gid) : undefined
  return tileset ? { tileset, info: tileset.tiles[gid - tileset.firstgid] } : undefined
}

/**
 * A tile's collision shapes as boxes in tiles. The tile is drawn in the area left/top/w/h (pixels),
 * flipped like Tiled does it (diagonal first, then horizontal, then vertical).
 */
export function shapeBoxes(
  shapes: readonly TiledTileShapeData[],
  tile: { w: number; h: number; flipH: boolean; flipV: boolean; flipD: boolean },
  area: { left: number; top: number; w: number; h: number },
  tileSize: number,
): Box[] {
  return shapes.map((shape) => {
    let { x, y, w, h } = shape
    let [dw, dh] = [tile.w, tile.h]
    if (tile.flipD) {
      ;[x, y, w, h] = [y, x, h, w]
      ;[dw, dh] = [dh, dw]
    }
    if (tile.flipH) x = dw - x - w
    if (tile.flipV) y = dh - y - h
    const sx = area.w / dw
    const sy = area.h / dh
    return {
      x0: (area.left + x * sx) / tileSize,
      y0: (area.top + y * sy) / tileSize,
      x1: (area.left + (x + w) * sx) / tileSize,
      y1: (area.top + (y + h) * sy) / tileSize,
    }
  })
}

/** Touching non-empty cells (4-way) grouped into pieces, each with its bottom row. */
function sortedPieces(tiles: (DrawTile | null)[], width: number, opacity: number): SortedPiece[] {
  const seen = new Set<number>()
  const pieces: SortedPiece[] = []
  tiles.forEach((first, start) => {
    if (!first || seen.has(start)) return
    const cells: SortedPiece['cells'] = []
    let bottom = 0
    const queue = [start]
    seen.add(start)
    for (let head = 0; head < queue.length; head++) {
      const i = queue[head] as number
      const tile = tiles[i] as DrawTile
      cells.push({ i, tile })
      const x = i % width
      const y = Math.floor(i / width)
      bottom = Math.max(bottom, y + 1)
      const next = [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, i - width, i + width]
      for (const n of next) {
        if (n < 0 || n >= tiles.length || seen.has(n) || !tiles[n]) continue
        seen.add(n)
        queue.push(n)
      }
    }
    pieces.push({ cells, bottom, opacity })
  })
  return pieces
}

export function layoutFromTiled(source: TiledSource): Layout {
  const data = source.tiled
  const { width, height, tileWidth: tw, tileHeight: th } = data
  const warnings: string[] = []
  if (tw !== th)
    warnings.push(`tiles are ${tw}×${th}; only square tiles are supported, using ${tw}`)

  const solid: boolean[] = new Array(width * height).fill(false)
  const below: DrawLayer[] = []
  const above: DrawLayer[] = []
  const sorted: SortedPiece[] = []
  const boxes: Box[] = []
  const objects: LayoutObject[] = []
  const spawns: Layout['spawns'] = {}
  const terrain: (string | undefined)[] = []
  const pictures: PictureLayer[] = []
  let passedObjects = false
  const behaviour = source.objects ?? {}
  const warnedApprox = new Set<string>()
  const warnApprox = (shapes: readonly TiledTileShapeData[], tileset: string, raw: number) => {
    const key = `${tileset}#${decodeGid(raw).gid}`
    if (shapes.every((shape) => shape.exact) || warnedApprox.has(key)) return
    warnedApprox.add(key)
    warnings.push(
      `tileset "${tileset}", tile gid ${decodeGid(raw).gid}: ellipse/polygon collision uses its bounding box (draw rectangles)`,
    )
  }
  const used = new Set<string>()

  for (const layer of data.layers) {
    if (layer.kind === 'image') {
      if (!layer.visible) continue
      const blend = layer.properties.blend
      pictures.push({
        image: layer.image,
        above: passedObjects || layer.properties.above === true,
        x: layer.x,
        y: layer.y,
        parallax: { x: layer.parallaxX, y: layer.parallaxY },
        repeat: { x: layer.repeatX, y: layer.repeatY },
        drift: {
          x: typeof layer.properties.driftx === 'number' ? layer.properties.driftx : 0,
          y: typeof layer.properties.drifty === 'number' ? layer.properties.drifty : 0,
        },
        opacity: layer.opacity,
        ...(blend === 'add' || blend === 'multiply' || blend === 'screen' ? { blend } : {}),
      })
      continue
    }
    if (layer.kind === 'tiles') {
      const collisionOnly = layer.properties.collision === true
      // A whole layer can name the ground (also an invisible "marker" layer painted for it).
      const layerTerrain =
        typeof layer.properties.terrain === 'string' ? layer.properties.terrain : undefined
      layer.data.forEach((raw, i) => {
        if (raw === 0) return
        if (layerTerrain !== undefined) terrain[i] = layerTerrain || undefined
        else if (!collisionOnly) {
          const named = tileInfo(data, raw)?.info?.properties.terrain
          if (typeof named === 'string') terrain[i] = named || undefined
        }
        if (collisionOnly) {
          solid[i] = true
          return
        }
        const found = tileInfo(data, raw)
        // Shapes drawn in the Tile Collision Editor win over solid=true (the whole tile).
        const shapes = found?.info?.collision
        if (shapes?.length && found) {
          const { tileWidth: w, tileHeight: h } = found.tileset
          const { flipH, flipV, flipD } = decodeGid(raw)
          // Tiles are drawn anchored bottom-left in their cell, like Tiled.
          const area = { left: (i % width) * tw, top: (Math.floor(i / width) + 1) * th - h, w, h }
          boxes.push(...shapeBoxes(shapes, { w, h, flipH, flipV, flipD }, area, tw))
          warnApprox(shapes, found.tileset.name, raw)
        } else if (found?.info?.properties.solid === true) solid[i] = true
      })
      if (collisionOnly || !layer.visible) continue
      const drawn: DrawLayer = {
        kind: 'tiles',
        tiles: layer.data.map((raw) => tileForGid(data, raw)),
        opacity: layer.opacity,
      }
      if (layer.properties.sorted === true) {
        sorted.push(...sortedPieces(drawn.tiles, width, layer.opacity))
        continue
      }
      // Layers after the first object layer (or marked above: true) are drawn over the player.
      if (passedObjects || layer.properties.above === true) above.push(drawn)
      else below.push(drawn)
      continue
    }

    passedObjects = true
    for (const o of layer.objects) {
      if (!o.visible || !layer.visible) continue
      // Tile objects are anchored at their bottom-left corner in Tiled.
      const top = o.gid !== undefined ? o.y - o.height : o.y
      if (o.type.toLowerCase() === 'spawn') {
        const cx = o.point ? o.x : o.x + o.width / 2
        const cy = o.point ? top : top + o.height / 2
        const facing = o.properties.facing
        spawns[o.name] = {
          x: Math.floor(cx / tw),
          y: Math.floor(cy / th),
          facing: typeof facing === 'string' ? (facing as Facing) : undefined,
        }
        continue
      }
      const extra = o.name ? behaviour[o.name] : undefined
      if (o.name) used.add(o.name)
      const props = o.properties
      const kind = o.type.trim()
      const where = `object "${o.name || o.id}"`
      // Class "door": an exit to another map. Any other class: a prop of that name.
      const door = kind.toLowerCase() === 'door' ? doorFrom(props, where, warnings) : undefined
      // Class "zone": an area with its own music/ambient sound.
      const zone = kind.toLowerCase() === 'zone'
      // Class "encounter": random battles in this area.
      const encounter = kind.toLowerCase() === 'encounter'
      // Class "enemy": an enemy standing here (property "enemy"), fought by interacting.
      const enemy = kind.toLowerCase() === 'enemy' ? enemyFrom(props, where, warnings) : undefined
      const prop = !door && !zone && !encounter && !enemy && kind ? kind : undefined
      // Objects placed between tiles keep their exact spot (offset); `at` is the nearest tile.
      const exact = { x: o.x / tw, y: top / th }
      const at = { x: Math.round(exact.x), y: Math.round(exact.y) }
      const offset = { x: round4(exact.x - at.x), y: round4(exact.y - at.y) }
      const tileShapes = o.gid !== undefined ? tileInfo(data, o.gid)?.info?.collision : undefined
      const shapeSolid = !prop && !enemy && typeof props.solid !== 'boolean' && !!tileShapes?.length
      if (shapeSolid && tileShapes && o.gid !== undefined) {
        const found = tileInfo(data, o.gid)
        const { flipH, flipV, flipD } = decodeGid(o.gid)
        const w = found?.tileset.tileWidth ?? tw
        const h = found?.tileset.tileHeight ?? th
        const area = { left: o.x, top, w: o.width || w, h: o.height || h }
        boxes.push(...shapeBoxes(tileShapes, { w, h, flipH, flipV, flipD }, area, tw))
        warnApprox(tileShapes, found?.tileset.name ?? '', o.gid)
      }
      objects.push({
        // Props need an id (for scripts and their saved memory): the name, or class + tile.
        id: o.name || (prop ? `${prop}_${at.x}_${at.y}` : undefined),
        at,
        ...(offset.x || offset.y ? { offset } : {}),
        size: o.point
          ? { w: 1, h: 1 }
          : { w: Math.max(1, Math.round(o.width / tw)), h: Math.max(1, Math.round(o.height / th)) },
        // Props keep their own defaults unless Tiled sets these.
        ...(prop || enemy ? {} : { solid: props.solid === true }),
        ...((prop || enemy) && typeof props.solid === 'boolean' ? { solid: props.solid } : {}),
        ...(typeof props.pushable === 'boolean' ? { pushable: props.pushable } : {}),
        ...(props.pushReset === true ? { pushReset: true } : {}),
        ...(typeof props.label === 'string' ? { label: props.label } : {}),
        ...(typeof props.color === 'string' ? { color: props.color } : {}),
        ...(typeof props.facing === 'string' ? { facing: props.facing as Facing } : {}),
        tile: o.gid !== undefined ? (tileForGid(data, o.gid) ?? undefined) : undefined,
        ...(door ? { door } : {}),
        ...(zone ? zoneFrom(props, where, warnings) : {}),
        ...(encounter ? encounterFrom(props, where, warnings) : {}),
        ...(enemy ?? {}),
        ...(prop ? { prop: prop as PropId, properties: { ...props } } : {}),
        ...extra,
      })
    }
  }

  for (const name of Object.keys(behaviour)) {
    if (!used.has(name))
      warnings.push(`objects.${name}: there is no object called "${name}" in the Tiled map`)
  }
  const all = [...objects, ...(source.extraObjects ?? [])].map(withTexture)
  const grid = { width, height, solid }
  addSolidObjects(grid, all)
  return {
    width,
    height,
    tileSize: tw,
    solid,
    below,
    above,
    sorted,
    boxes,
    objects: all,
    spawns,
    pixelated: true,
    warnings,
    ...(terrain.length > 0 ? { terrain } : {}),
    ...(pictures.length > 0 ? { pictures } : {}),
  }
}

const round4 = (n: number) => Math.round(n * 10000) / 10000

/** Objects with a `texture` (image URL) and no tile are drawn with that whole image. */
function withTexture(object: LayoutObject): LayoutObject {
  if (object.tile || !object.texture) return object
  const tex = { image: object.texture, x: 0, y: 0, w: 0, h: 0 }
  return { ...object, tile: { tex, flipH: false, flipV: false, flipD: false } }
}

/** Every image a layout draws (to preload them). */
export function layoutImages(layout: Layout): string[] {
  const images = new Set<string>()
  const add = (tile: DrawTile | null | undefined) => {
    if (!tile) return
    images.add(tile.tex.image)
    for (const frame of tile.frames ?? []) images.add(frame.tex.image)
  }
  for (const layer of [...layout.below, ...layout.above]) layer.tiles.forEach(add)
  for (const piece of layout.sorted) for (const cell of piece.cells) add(cell.tile)
  for (const object of layout.objects) add(object.tile)
  for (const picture of layout.pictures ?? []) images.add(picture.image)
  return [...images]
}

// ---------------------------------------------------------------- structures (stamped layouts)

/** A structure layout placed at a tile position of the current map. */
export interface Stamp {
  layout: Layout
  at: TilePos
}

/** Cells a layout "owns": anything drawn there, or solid. Empty cells leave the map underneath alone. */
export function ownedCells(layout: Layout): boolean[] {
  const owned = layout.solid.slice()
  for (const layer of [...layout.below, ...layout.above]) {
    for (const [i, cell] of layer.tiles.entries()) if (cell) owned[i] = true
  }
  for (const piece of layout.sorted) for (const { i } of piece.cells) owned[i] = true
  for (const box of layout.boxes) {
    for (const i of boxCells(box, layout.width, layout.height)) owned[i] = true
  }
  for (const object of layout.objects) {
    if (!object.solid || isActor(object) || hasOffset(object)) continue
    const { w, h } = object.size ?? { w: 1, h: 1 }
    for (let y = object.at.y; y < object.at.y + h; y++) {
      for (let x = object.at.x; x < object.at.x + w; x++) owned[y * layout.width + x] = true
    }
  }
  return owned
}

/** The map's collision with structures stamped on top (each owns its cells; later stamps win). */
export function stampSolid(
  base: boolean[],
  width: number,
  height: number,
  stamps: Stamp[],
): boolean[] {
  const solid = base.slice()
  for (const { layout, at } of stamps) {
    const owned = ownedCells(layout)
    for (let y = 0; y < layout.height; y++) {
      for (let x = 0; x < layout.width; x++) {
        const mx = at.x + x
        const my = at.y + y
        if (mx < 0 || my < 0 || mx >= width || my >= height || !owned[y * layout.width + x])
          continue
        solid[my * width + mx] = layout.solid[y * layout.width + x] === true
      }
    }
  }
  return solid
}

/** Cells (row-major indices) a box covers, inside a width × height grid. */
export function boxCells(box: Box, width: number, height: number): number[] {
  const cells: number[] = []
  const x0 = Math.max(0, Math.floor(box.x0))
  const y0 = Math.max(0, Math.floor(box.y0))
  const x1 = Math.min(width - 1, Math.ceil(box.x1) - 1)
  const y1 = Math.min(height - 1, Math.ceil(box.y1) - 1)
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) cells.push(y * width + x)
  return cells
}

/**
 * The map's collision boxes with structures stamped on top: a structure removes the map's boxes in
 * cells it owns and adds its own (moved to where it was placed).
 */
export function stampBoxes(base: Box[], width: number, height: number, stamps: Stamp[]): Box[] {
  let boxes = base
  for (const { layout, at } of stamps) {
    const owned = ownedCells(layout)
    const ownedHere = (box: Box) =>
      boxCells(box, width, height).some((i) => {
        const x = (i % width) - at.x
        const y = Math.floor(i / width) - at.y
        return (
          x >= 0 && y >= 0 && x < layout.width && y < layout.height && owned[y * layout.width + x]
        )
      })
    boxes = boxes.filter((box) => !ownedHere(box))
    boxes = boxes.concat(
      layout.boxes.map((b) => ({
        x0: b.x0 + at.x,
        y0: b.y0 + at.y,
        x1: b.x1 + at.x,
        y1: b.y1 + at.y,
      })),
    )
  }
  return boxes
}

/** The collision grid with every cell a box touches marked solid (for pathfinding and unsticking). */
export function blockedCells(
  solid: readonly boolean[],
  width: number,
  height: number,
  boxes: Box[],
) {
  const blocked = solid.slice()
  for (const box of boxes) for (const i of boxCells(box, width, height)) blocked[i] = true
  return blocked
}

/** A structure's objects, moved to where it was placed. */
export function stampObjects(stamp: Stamp): LayoutObject[] {
  return stamp.layout.objects.map((o) => ({
    ...o,
    at: { x: o.at.x + stamp.at.x, y: o.at.y + stamp.at.y },
  }))
}

/** Why a structure can't go at `at` (null = it can). */
export function placementProblem(
  map: { width: number; height: number },
  stamp: Stamp,
  player?: { x: number; y: number },
): string | null {
  const { at, layout } = stamp
  if (
    at.x < 0 ||
    at.y < 0 ||
    at.x + layout.width > map.width ||
    at.y + layout.height > map.height
  ) {
    return `it doesn't fit: ${layout.width}×${layout.height} at ${at.x},${at.y} on a ${map.width}×${map.height} map`
  }
  if (player) {
    const px = Math.floor(player.x) - at.x
    const py = Math.floor(player.y) - at.y
    const inside = px >= 0 && py >= 0 && px < layout.width && py < layout.height
    if (inside && layout.solid[py * layout.width + px])
      return 'the player is standing where it would be solid'
    const lx = player.x - at.x
    const ly = player.y - at.y
    if (layout.boxes.some((b) => lx >= b.x0 && lx < b.x1 && ly >= b.y0 && ly < b.y1))
      return 'the player is standing where it would be solid'
  }
  return null
}

/**
 * Removes the parts of a structure that would land outside the map (forced placements).
 * Cells outside become empty, and objects that start outside are dropped.
 */
export function clipLayout(
  layout: Layout,
  at: TilePos,
  map: { width: number; height: number },
): Layout {
  const inside = (i: number) => {
    const x = at.x + (i % layout.width)
    const y = at.y + Math.floor(i / layout.width)
    return x >= 0 && y >= 0 && x < map.width && y < map.height
  }
  const clipLayer = (layer: DrawLayer): DrawLayer => ({
    ...layer,
    tiles: layer.tiles.map((t, i) => (inside(i) ? t : null)),
  })
  return {
    ...layout,
    solid: layout.solid.map((s, i) => s && inside(i)),
    below: layout.below.map(clipLayer),
    above: layout.above.map(clipLayer),
    sorted: layout.sorted
      .map((piece) => ({ ...piece, cells: piece.cells.filter(({ i }) => inside(i)) }))
      .filter((piece) => piece.cells.length > 0),
    boxes: layout.boxes.filter((b) => {
      const x = at.x + (b.x0 + b.x1) / 2
      const y = at.y + (b.y0 + b.y1) / 2
      return x >= 0 && y >= 0 && x < map.width && y < map.height
    }),
    objects: layout.objects.filter((o) => inside(o.at.y * layout.width + o.at.x)),
  }
}

/**
 * The walkable tile closest to `from` (by steps, searching outward), or null if the whole map is solid.
 * Used to move the player out of a wall that appeared on top of them.
 */
export function nearestFree(
  solid: boolean[],
  width: number,
  height: number,
  from: TilePos,
): TilePos | null {
  const start = {
    x: Math.min(width - 1, Math.max(0, from.x)),
    y: Math.min(height - 1, Math.max(0, from.y)),
  }
  const seen = new Set<number>([start.y * width + start.x])
  const queue: TilePos[] = [start]
  for (let head = 0; head < queue.length; head++) {
    const tile = queue[head] as TilePos
    if (!solid[tile.y * width + tile.x]) return tile
    for (const [dx, dy] of [
      [0, 1],
      [0, -1],
      [-1, 0],
      [1, 0],
    ] as const) {
      const x = tile.x + dx
      const y = tile.y + dy
      const key = y * width + x
      if (x < 0 || y < 0 || x >= width || y >= height || seen.has(key)) continue
      seen.add(key)
      queue.push({ x, y })
    }
  }
  return null
}

/**
 * A Tiled "encounter" object's properties: enemies = groups separated by ";", enemies in a group by
 * "," ("slime,slime;bat"), and / or troops = troop ids ("wolf_pack;slimes"), rate = chance per tile
 * (default 0.08), background = battle background.
 */
function encounterFrom(props: Record<string, unknown>, where: string, warnings: string[]) {
  const list = typeof props.enemies === 'string' ? props.enemies : ''
  const named = (typeof props.troops === 'string' ? props.troops : '')
    .split(/[;,]/)
    .map((t) => t.trim())
    .filter(Boolean) as TroopId[]
  const lists = list
    .split(';')
    .map(
      (g) =>
        g
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean) as EnemyId[],
    )
    .filter((g) => g.length > 0)
  const groups = [...named, ...lists]
  if (groups.length === 0) {
    warnings.push(
      `${where}: an encounter needs an "enemies" property, e.g. "slime,slime;bat" (or "troops")`,
    )
    return {}
  }
  const rate = typeof props.rate === 'number' ? props.rate : undefined
  const background = typeof props.background === 'string' ? props.background : undefined
  return {
    encounters: {
      groups,
      ...(rate !== undefined ? { rate } : {}),
      ...(background ? { background } : {}),
    },
  }
}

/**
 * A Tiled "enemy" object's properties: enemy = its id; optional enemies = who fights ("wolf,wolf")
 * or troop = a troop id, background, canFlee, respawn.
 */
function enemyFrom(props: Record<string, unknown>, where: string, warnings: string[]) {
  if (typeof props.enemy !== 'string' || !props.enemy.trim()) {
    warnings.push(`${where}: an enemy object needs an "enemy" property, e.g. "wolf"`)
    return undefined
  }
  const list =
    typeof props.enemies === 'string'
      ? (props.enemies
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean) as EnemyId[])
      : []
  const fight = {
    ...(list.length ? { enemies: list } : {}),
    ...(typeof props.troop === 'string' && props.troop.trim()
      ? { troop: props.troop.trim() as TroopId }
      : {}),
    ...(typeof props.background === 'string' ? { background: props.background } : {}),
    ...(typeof props.canFlee === 'boolean' ? { canFlee: props.canFlee } : {}),
    ...(typeof props.respawn === 'boolean' ? { respawn: props.respawn } : {}),
  }
  return { enemy: props.enemy.trim() as EnemyId, ...(Object.keys(fight).length ? { fight } : {}) }
}

/** A Tiled "zone" object's properties -> its sounds ('' = silence). */
function zoneFrom(props: Record<string, unknown>, where: string, warnings: string[]) {
  const sound = (key: 'music' | 'ambient') => {
    const value = props[key]
    if (value === undefined) return {}
    if (typeof value !== 'string') {
      warnings.push(`${where}: zone property "${key}" must be a string (an audio id, or empty)`)
      return {}
    }
    return { [key]: value.trim() === '' ? null : (value.trim() as AudioId) }
  }
  const result = { ...sound('music'), ...sound('ambient') }
  if (Object.keys(result).length === 0)
    warnings.push(`${where}: a zone needs a "music" or "ambient" property`)
  return result
}

/** A Tiled "door" object's properties -> where it leads. */
function doorFrom(
  props: Record<string, PropertyValue>,
  where: string,
  warnings: string[],
): DoorTarget | undefined {
  if (typeof props.map !== 'string' || !props.map) {
    warnings.push(`${where}: a door needs a "map" property (the map id, e.g. countryside/forest)`)
    return undefined
  }
  const transition = props.transition
  return {
    map: props.map,
    ...(typeof props.spawn === 'string' && props.spawn ? { spawn: props.spawn } : {}),
    ...(transition === 'instant' || transition === 'fade'
      ? { transition: transition as MapTransition }
      : {}),
    ...(props.interact === true ? { interact: true } : {}),
  }
}
