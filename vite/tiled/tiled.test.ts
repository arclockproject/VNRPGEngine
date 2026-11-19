import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { deflateSync } from 'node:zlib'
import { afterEach, describe, expect, it } from 'vitest'
import { generateFromTiled, renderMapModule } from './plugin.ts'
import { readTiledMap } from './read.ts'

let dir: string | undefined
function files(map: Record<string, string>) {
  dir = mkdtempSync(path.join(tmpdir(), 'tiled-test-'))
  for (const [name, text] of Object.entries(map)) {
    mkdirSync(path.dirname(path.join(dir, name)), { recursive: true })
    writeFileSync(path.join(dir, name), text)
  }
  return dir
}
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
  dir = undefined
})

const tileset = JSON.stringify({
  name: 'ts',
  tilewidth: 16,
  tileheight: 16,
  tilecount: 8,
  columns: 4,
  spacing: 0,
  margin: 0,
  image: 'ts.png',
  imagewidth: 64,
  imageheight: 32,
  tiles: [
    { id: 1, properties: [{ name: 'solid', type: 'bool', value: true }] },
    {
      id: 2,
      animation: [
        { tileid: 2, duration: 100 },
        { tileid: 3, duration: 200 },
      ],
    },
  ],
})

const base64 = (gids: number[]) => {
  const buf = Buffer.alloc(gids.length * 4)
  gids.forEach((g, i) => {
    buf.writeUInt32LE(g >>> 0, i * 4)
  })
  return deflateSync(buf).toString('base64')
}

const tmx = `<?xml version="1.0" encoding="UTF-8"?>
<map orientation="orthogonal" width="3" height="2" tilewidth="16" tileheight="16" infinite="0">
 <properties><property name="dark" type="bool" value="true"/></properties>
 <tileset firstgid="1" source="tiles/ts.tsj"/>
 <layer id="1" name="Ground" width="3" height="2"><data encoding="csv">1,2,3,
4,0,${(0x80000000 | 1) >>> 0}</data></layer>
 <group id="2" name="Deco" opacity="0.5">
  <layer id="3" name="Flowers" width="3" height="2"><data encoding="base64" compression="zlib">${base64([0, 3, 0, 0, 0, 0])}</data></layer>
 </group>
 <objectgroup id="4" name="Objects">
  <object id="1" name="start" class="spawn" x="24" y="8"><properties><property name="facing" value="left"/></properties><point/></object>
  <object id="2" name="chest" gid="4" x="16" y="32" width="16" height="16"/>
  <object id="3" name="door" type="trigger" x="32" y="0" width="16" height="32"/>
 </objectgroup>
</map>`

describe('readTiledMap', () => {
  it('reads .tmx with an external .tsj tileset, csv + base64/zlib data, groups and objects', () => {
    const root = files({ 'map/town.tmx': tmx, 'map/tiles/ts.tsj': tileset })
    const map = readTiledMap(path.join(root, 'map/town.tmx'))
    expect([map.width, map.height, map.tileWidth]).toEqual([3, 2, 16])
    expect(map.properties).toEqual({ dark: true })
    expect(map.tilesets[0]).toMatchObject({
      firstgid: 1,
      columns: 4,
      image: path.join('tiles', 'ts.png'),
    })
    expect(map.tilesets[0]?.tiles[1]?.properties.solid).toBe(true)
    expect(map.tilesets[0]?.tiles[2]?.animation).toEqual([
      { tile: 2, duration: 100 },
      { tile: 3, duration: 200 },
    ])
    expect(map.layers.map((l) => l.name)).toEqual(['Ground', 'Deco/Flowers', 'Objects'])
    const ground = map.layers[0]
    expect(ground?.kind === 'tiles' && ground.data).toEqual([1, 2, 3, 4, 0, 0x80000001])
    const flowers = map.layers[1]
    expect(flowers?.kind === 'tiles' && [flowers.data, flowers.opacity]).toEqual([
      [0, 3, 0, 0, 0, 0],
      0.5,
    ])
    const objects = map.layers[2]
    expect(
      objects?.kind === 'objects' && objects.objects.map((o) => [o.name, o.type, o.point, o.gid]),
    ).toEqual([
      ['start', 'spawn', true, undefined],
      ['chest', '', false, 4],
      ['door', 'trigger', false, undefined],
    ])
  })

  it('reads the same map as .tmj (JSON)', () => {
    const root = files({
      'm.tmj': JSON.stringify({
        orientation: 'orthogonal',
        width: 2,
        height: 1,
        tilewidth: 16,
        tileheight: 16,
        tilesets: [{ firstgid: 1, source: 'ts.tsj' }],
        layers: [
          { type: 'tilelayer', name: 'G', data: [1, 2] },
          {
            type: 'objectgroup',
            name: 'O',
            objects: [{ id: 1, name: 'a', class: 'spawn', x: 0, y: 0, point: true }],
          },
        ],
      }),
      'ts.tsj': tileset,
    })
    const map = readTiledMap(path.join(root, 'm.tmj'))
    expect(map.layers.map((l) => l.kind)).toEqual(['tiles', 'objects'])
  })

  it('reads tile collision shapes (Tile Collision Editor) from .tsj and embedded tilesets', () => {
    const shapes = {
      objects: [
        { id: 1, x: 0, y: 8, width: 16, height: 8 },
        { id: 2, x: 2, y: 2, width: 4, height: 4, ellipse: true },
        {
          id: 3,
          x: 4,
          y: 0,
          polygon: [
            { x: 0, y: 0 },
            { x: 6, y: 2 },
            { x: 2, y: 5 },
          ],
        },
        { id: 4, x: 1, y: 1, point: true },
      ],
    }
    const withShapes = JSON.stringify({
      ...JSON.parse(tileset),
      tiles: [{ id: 0, objectgroup: shapes }],
    })
    const embedded = `<?xml version="1.0" encoding="UTF-8"?>
<map orientation="orthogonal" width="1" height="1" tilewidth="16" tileheight="16" infinite="0">
 <tileset firstgid="1" name="e" tilewidth="16" tileheight="16" tilecount="1" columns="1">
  <image source="e.png" width="16" height="16"/>
  <tile id="0"><objectgroup draworder="index">
   <object id="1" x="0" y="8" width="16" height="8"/>
   <object id="2" x="4" y="0"><polygon points="0,0 6,2 2,5"/></object>
   <object id="3" x="1" y="1"><point/></object>
  </objectgroup></tile>
 </tileset>
 <layer id="1" name="G" width="1" height="1"><data encoding="csv">1</data></layer>
</map>`
    const root = files({
      'a.tmx': tmx.replace('tiles/ts.tsj', 'ts.tsj'),
      'ts.tsj': withShapes,
      'b.tmx': embedded,
    })
    const half = { x: 0, y: 8, w: 16, h: 8, exact: true }
    const poly = { x: 4, y: 0, w: 6, h: 5, exact: false }
    expect(readTiledMap(path.join(root, 'a.tmx')).tilesets[0]?.tiles[0]?.collision).toEqual([
      half,
      { x: 2, y: 2, w: 4, h: 4, exact: false },
      poly,
    ])
    expect(readTiledMap(path.join(root, 'b.tmx')).tilesets[0]?.tiles[0]?.collision).toEqual([
      half,
      poly,
    ])
  })

  it('explains unsupported setups', () => {
    const root = files({
      'a.tmx': tmx.replace('tiles/ts.tsj', 'ts.tsx'),
      'b.tmx': tmx.replace('infinite="0"', 'infinite="1"'),
    })
    expect(() => readTiledMap(path.join(root, 'a.tmx'))).toThrow('.tsj')
    expect(() => readTiledMap(path.join(root, 'b.tmx'))).toThrow('infinite')
  })
})

describe('generated module', () => {
  it('imports tileset images and types spawn and object names', () => {
    const root = files({ 'map/town.tmx': tmx, 'map/tiles/ts.tsj': tileset })
    const warnings: string[] = []
    const source = renderMapModule('town.tmx', readTiledMap(path.join(root, 'map/town.tmx')), (w) =>
      warnings.push(w),
    )
    expect(source).toContain("import tileset0 from './tiles/ts.png'")
    expect(source).toContain('"image":tileset0')
    expect(source).toContain("TiledMapData<'start', 'chest' | 'door'>")
    expect(warnings).toEqual([])
    expect(generateFromTiled(path.join(root, 'map/town.tmx'), () => {})).toBe(true)
    expect(generateFromTiled(path.join(root, 'map/town.tmx'), () => {})).toBe(false) // unchanged
  })
})
