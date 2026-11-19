// Types for generated Tiled map modules (name.gen.ts, made by vite/tiled from .tmx/.tmj files).

export type PropertyValue = string | number | boolean
export type Properties = Record<string, PropertyValue>

export interface TiledTilesetData {
  firstgid: number
  name: string
  tileWidth: number
  tileHeight: number
  columns: number
  tileCount: number
  spacing: number
  margin: number
  /** URL of the tileset image. */
  image: string
  imageWidth: number
  imageHeight: number
  tiles: Record<number, TiledTileInfoData>
}

/** A collision shape from Tiled's Tile Collision Editor, in pixels from the tile's top-left. */
export interface TiledTileShapeData {
  x: number
  y: number
  w: number
  h: number
  /** False for ellipses/polygons (only their bounding box is used). */
  exact: boolean
}

export interface TiledTileInfoData {
  type?: string
  properties: Properties
  animation?: { tile: number; duration: number }[]
  collision?: TiledTileShapeData[]
}

export interface TiledObjectData {
  id: number
  name: string
  type: string
  x: number
  y: number
  width: number
  height: number
  gid?: number
  point: boolean
  visible: boolean
  properties: Properties
}

export type TiledLayerData =
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
      objects: TiledObjectData[]
      properties: Properties
    }
  | {
      /** A Tiled image layer: a picture behind or over the map (sky, far hills, fog). */
      kind: 'image'
      name: string
      visible: boolean
      opacity: number
      /** URL of the picture. */
      image: string
      /** Offset in map pixels. */
      x: number
      y: number
      /** 1 = moves with the map, 0 = fixed on screen. */
      parallaxX: number
      parallaxY: number
      repeatX: boolean
      repeatY: boolean
      properties: Properties
    }

declare const names: unique symbol

/** A Tiled map. `S` = spawn names, `O` = names of other objects (for behaviour in TypeScript). */
export interface TiledMapData<S extends string = string, O extends string = string> {
  width: number
  height: number
  tileWidth: number
  tileHeight: number
  layers: TiledLayerData[]
  tilesets: TiledTilesetData[]
  properties: Properties
  readonly [names]?: { spawns: S; objects: O }
}

export type TiledSpawns<T> = T extends { readonly [names]?: { spawns: infer S } } ? S : never
export type TiledObjects<T> = T extends { readonly [names]?: { objects: infer O } } ? O : never

// Global tile ids carry flip flags in their top 4 bits.
const FLIP_H = 0x80000000
const FLIP_V = 0x40000000
const FLIP_D = 0x20000000
const ID_BITS = 0x0fffffff

export function decodeGid(raw: number) {
  return {
    gid: (raw & ID_BITS) >>> 0,
    flipH: (raw & FLIP_H) !== 0,
    flipV: (raw & FLIP_V) !== 0,
    flipD: (raw & FLIP_D) !== 0,
  }
}
