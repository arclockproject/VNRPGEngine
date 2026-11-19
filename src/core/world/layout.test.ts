import { describe, expect, it } from 'vitest'
import type { MapObject } from '../define'
import { objectPos, offsetBoxes } from './grid'
import {
  blockedCells,
  boxCells,
  clipLayout,
  layoutFromTiled,
  layoutImages,
  nearestFree,
  ownedCells,
  placementProblem,
  shapeBoxes,
  stampBoxes,
  stampObjects,
  stampSolid,
} from './layout'
import type { TiledMapData } from './tiled'

const tileset = {
  firstgid: 1,
  name: 'ts',
  tileWidth: 16,
  tileHeight: 16,
  columns: 4,
  tileCount: 8,
  spacing: 0,
  margin: 0,
  image: 'ts.png',
  imageWidth: 64,
  imageHeight: 32,
  tiles: {
    1: { properties: { solid: true } },
    2: {
      properties: {},
      animation: [
        { tile: 2, duration: 100 },
        { tile: 3, duration: 200 },
      ],
    },
  },
}
const obj = (o: Partial<TiledMapData['layers'][number] & object> & Record<string, unknown>) => ({
  id: 1,
  name: '',
  type: '',
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  point: false,
  visible: true,
  properties: {},
  ...o,
})
const map: TiledMapData = {
  width: 3,
  height: 2,
  tileWidth: 16,
  tileHeight: 16,
  properties: {},
  tilesets: [tileset],
  layers: [
    {
      kind: 'tiles',
      name: 'Ground',
      visible: true,
      opacity: 1,
      properties: {},
      data: [1, 2, 3, 0x80000001, 0, 1],
    },
    {
      kind: 'tiles',
      name: 'Walls',
      visible: false,
      opacity: 1,
      properties: { collision: true },
      data: [0, 0, 0, 0, 1, 0],
    },
    {
      kind: 'objects',
      name: 'Objects',
      visible: true,
      properties: {},
      objects: [
        obj({
          name: 'start',
          type: 'spawn',
          x: 40,
          y: 8,
          point: true,
          properties: { facing: 'left' },
        }),
        obj({
          id: 2,
          name: 'chest',
          gid: 4,
          x: 16,
          y: 32,
          width: 16,
          height: 16,
          properties: { solid: true, label: 'Chest' },
        }),
        obj({ id: 3, name: 'exit', x: 32, y: 0, width: 16, height: 32 }),
      ] as never,
    },
    {
      kind: 'tiles',
      name: 'Roofs',
      visible: true,
      opacity: 1,
      properties: {},
      data: [3, 0, 0, 0, 0, 0],
    },
  ],
}

describe('layoutFromTiled', () => {
  const layout = layoutFromTiled({
    tiled: map,
    objects: { exit: { onEnter: () => {} }, chest: { label: 'Treasure' } },
  })

  it('collision: solid tiles, collision layers and solid objects', () => {
    // gid 2 = tile 1 (solid) at index 1; collision layer at index 4; the solid chest at (1, 1).
    expect(layout.solid).toEqual([false, true, false, false, true, false])
  })

  it('layers after the first object layer are drawn above the player', () => {
    expect([layout.below.length, layout.above.length]).toEqual([1, 1]) // the collision layer isn't drawn
  })

  it('tiles: texture rectangles, flips and animations', () => {
    const ground = layout.below[0]
    if (ground?.kind !== 'tiles') throw new Error('expected tiles')
    expect(ground.tiles[2]?.tex).toEqual({ image: 'ts.png', x: 32, y: 0, w: 16, h: 16 })
    expect(ground.tiles[2]?.frames?.map((f) => [f.tex.x, f.duration])).toEqual([
      [32, 100],
      [48, 200],
    ])
    expect(ground.tiles[3]).toMatchObject({ flipH: true, flipV: false, tex: { x: 0, y: 0 } })
    expect(ground.tiles[4]).toBeNull()
  })

  it('spawns and objects (tile objects are anchored bottom-left; code overrides Tiled properties)', () => {
    expect(layout.spawns).toEqual({ start: { x: 2, y: 0, facing: 'left' } })
    const chest = layout.objects.find((o) => o.id === 'chest')
    expect(chest).toMatchObject({ at: { x: 1, y: 1 }, solid: true, label: 'Treasure' })
    expect(chest?.tile?.tex).toMatchObject({ x: 48, y: 0 })
    expect(layout.objects.find((o) => o.id === 'exit')).toMatchObject({
      at: { x: 2, y: 0 },
      size: { w: 1, h: 2 },
    })
    expect(layout.warnings).toEqual([])
  })

  it('warns about behaviour for objects that are not in the map', () => {
    expect(layoutFromTiled({ tiled: map, objects: { gone: {} } }).warnings[0]).toContain('"gone"')
  })
})

/** A small one-layer Tiled map from rows of text: '#' = solid tile, '.' = floor, ' ' = empty. */
function fromRows(rows: string[], extraObjects: MapObject[] = []) {
  const data = rows.flatMap((row) => [...row].map((c) => (c === '#' ? 2 : c === '.' ? 1 : 0)))
  const layer = {
    kind: 'tiles',
    name: 'G',
    visible: true,
    opacity: 1,
    properties: {},
    data,
  } as const
  const tiled: TiledMapData = {
    ...map,
    width: rows[0]?.length ?? 0,
    height: rows.length,
    layers: [layer],
  }
  return layoutFromTiled({ tiled, extraObjects })
}

describe('object textures', () => {
  it('draws an object with a texture and no tile from that whole image', () => {
    const layout = fromRows(['..'], [{ at: { x: 1, y: 0 }, texture: 'chest.png' }])
    expect(layout.objects[0]?.tile?.tex).toEqual({ image: 'chest.png', x: 0, y: 0, w: 0, h: 0 })
  })
})

describe('structures (stamping)', () => {
  // A 2×2 structure: a solid wall tile at (0,0), a floor tile at (1,0), nothing in the bottom row,
  // and a solid "chest" object at (1,1).
  const structure = fromRows(['#.', '  '], [{ id: 'chest', at: { x: 1, y: 1 }, solid: true }])
  // The map: 4×3, everything solid in column 3.
  const base = [false, false, false, true, false, false, false, true, false, false, false, true]

  it('owns cells it draws on or makes solid; empty cells are left alone', () => {
    expect(ownedCells(structure)).toEqual([true, true, false, true])
  })

  it('decides collision where it owns cells', () => {
    // Placed at (2,0): its floor at (3,0) clears the map's solid column there; (2,1) stays as it was.
    const solid = stampSolid(base, 4, 3, [{ layout: structure, at: { x: 2, y: 0 } }])
    expect(solid).toEqual([
      false,
      false,
      true,
      false,
      false,
      false,
      false,
      true,
      false,
      false,
      false,
      true,
    ])
  })

  it('moves its objects with it', () => {
    expect(stampObjects({ layout: structure, at: { x: 2, y: 1 } })[0]?.at).toEqual({ x: 3, y: 2 })
  })

  it('refuses spots where it does not fit or would trap the player', () => {
    const map = { width: 4, height: 3 }
    expect(placementProblem(map, { layout: structure, at: { x: 3, y: 0 } })).toContain(
      "doesn't fit",
    )
    expect(
      placementProblem(map, { layout: structure, at: { x: 0, y: 0 } }, { x: 0.5, y: 0.5 }),
    ).toContain('player')
    expect(
      placementProblem(map, { layout: structure, at: { x: 0, y: 0 } }, { x: 0.5, y: 1.5 }),
    ).toBeNull()
  })
})

describe('forced placement helpers', () => {
  const block = fromRows(
    ['##', '##'],
    [
      { id: 'a', at: { x: 0, y: 0 } },
      { id: 'b', at: { x: 1, y: 1 } },
    ],
  )

  it('clipLayout cuts off what hangs over the map edge', () => {
    const clipped = clipLayout(block, { x: 3, y: 0 }, { width: 4, height: 4 }) // only column 0 is inside
    expect(clipped.solid).toEqual([true, false, true, false])
    expect(clipped.below[0]?.tiles.map(Boolean)).toEqual([true, false, true, false])
    expect(clipped.objects.map((o) => o.id)).toEqual(['a'])
  })

  it('nearestFree finds the closest walkable tile, searching outward', () => {
    // 3×3, all solid except the bottom-right corner.
    const solid = [true, true, true, true, true, true, true, true, false]
    expect(nearestFree(solid, 3, 3, { x: 1, y: 1 })).toEqual({ x: 2, y: 2 })
    expect(nearestFree(solid, 3, 3, { x: 2, y: 2 })).toEqual({ x: 2, y: 2 }) // already free
    expect(nearestFree([true, true], 2, 1, { x: 0, y: 0 })).toBeNull()
  })
})

describe('Tiled doors and props', () => {
  const withObjects = (objects: unknown[]): TiledMapData => ({
    ...map,
    layers: [
      map.layers[0] as TiledMapData['layers'][number],
      { kind: 'objects', name: 'O', visible: true, properties: {}, objects: objects as never },
    ],
  })

  it('class "door" becomes a door; a missing map property is a warning', () => {
    const layout = layoutFromTiled({
      tiled: withObjects([
        obj({
          id: 5,
          name: 'out',
          type: 'door',
          x: 0,
          y: 0,
          width: 16,
          height: 16,
          properties: { map: 'forest', spawn: 'east', interact: true },
        }),
        obj({ id: 6, name: 'broken', type: 'door', x: 16, y: 0, width: 16, height: 16 }),
      ]),
    })
    expect(layout.objects[0]?.door).toEqual({ map: 'forest', spawn: 'east', interact: true })
    expect(layout.objects[1]?.door).toBeUndefined()
    expect(layout.warnings.join()).toContain('needs a "map" property')
  })

  it('class "zone" gives an area its own music/ambient ("" = silence), and is not a prop', () => {
    const zone = (id: number, properties: Record<string, string>) =>
      obj({ id, name: '', type: 'zone', x: 0, y: 0, width: 32, height: 48, properties })
    const layout = layoutFromTiled({
      tiled: withObjects([zone(8, { music: 'music/forest', ambient: '' }), zone(9, {})]),
    })
    expect(layout.objects[0]).toMatchObject({
      size: { w: 2, h: 3 },
      music: 'music/forest',
      ambient: null,
    })
    expect(layout.objects[0]?.prop).toBeUndefined()
    expect(layout.warnings.join()).toContain('a zone needs a "music" or "ambient" property')
  })

  it('class "encounter" reads enemy groups ("a,a;b") and the rate', () => {
    const layout = layoutFromTiled({
      tiled: withObjects([
        obj({
          id: 10,
          name: '',
          type: 'encounter',
          x: 0,
          y: 0,
          width: 16,
          height: 16,
          properties: { enemies: 'slime, slime; bat', rate: 0.2 },
        }),
        obj({ id: 11, name: '', type: 'encounter', x: 0, y: 0, width: 16, height: 16 }),
      ]),
    })
    expect(layout.objects[0]?.encounters).toEqual({
      groups: [['slime', 'slime'], ['bat']],
      rate: 0.2,
    })
    expect(layout.objects[0]?.prop).toBeUndefined()
    expect(layout.warnings.join()).toContain('an encounter needs an "enemies" property')
  })

  it('class "enemy" places an enemy with its fight; solid only if set', () => {
    const layout = layoutFromTiled({
      tiled: withObjects([
        obj({
          id: 12,
          name: 'boss',
          type: 'enemy',
          x: 16,
          y: 0,
          width: 16,
          height: 16,
          properties: { enemy: 'wolf', enemies: 'wolf, bat', background: 'forest', respawn: true },
        }),
        obj({ id: 13, name: '', type: 'enemy', x: 0, y: 0, width: 16, height: 16 }),
      ]),
    })
    const boss = layout.objects[0]
    expect(boss?.enemy).toBe('wolf')
    expect(boss?.fight).toEqual({ enemies: ['wolf', 'bat'], background: 'forest', respawn: true })
    expect(boss?.prop).toBeUndefined()
    expect(boss?.solid).toBeUndefined()
    expect(layout.warnings.join()).toContain('an enemy object needs an "enemy" property')
  })

  it('any other class is a prop: id from the tile when unnamed, properties kept, solid only if set', () => {
    const layout = layoutFromTiled({
      tiled: withObjects([
        obj({
          id: 7,
          type: 'chest',
          x: 32,
          y: 16,
          width: 16,
          height: 16,
          properties: { item: 'apple' },
        }),
        obj({
          id: 8,
          name: 'gate',
          type: 'barrel',
          x: 0,
          y: 16,
          width: 16,
          height: 16,
          properties: { solid: false },
        }),
      ]),
    })
    expect(layout.objects[0]).toMatchObject({
      id: 'chest_2_1',
      prop: 'chest',
      properties: { item: 'apple' },
    })
    expect(layout.objects[0]).not.toHaveProperty('solid')
    expect(layout.objects[1]).toMatchObject({ id: 'gate', prop: 'barrel', solid: false })
  })
})

describe('tile collision shapes, sorted layers and off-grid objects', () => {
  // Tile 0 (gid 1): a fence, solid in its bottom half only. Tile 1 (gid 2): solid=true too, but
  // its shape (left quarter) wins.
  const fenceSet = {
    ...tileset,
    tiles: {
      0: { properties: {}, collision: [{ x: 0, y: 8, w: 16, h: 8, exact: true }] },
      1: { properties: { solid: true }, collision: [{ x: 0, y: 0, w: 4, h: 16, exact: true }] },
    },
  }
  const tiles = (data: number[], properties = {}) =>
    ({ kind: 'tiles', name: 'T', visible: true, opacity: 1, properties, data }) as const
  const make = (layers: TiledMapData['layers'], width = 3, height = 2) =>
    layoutFromTiled({ tiled: { ...map, width, height, tilesets: [fenceSet], layers } })

  it('turns shapes into boxes (in tiles) instead of solid cells', () => {
    const layout = make([tiles([1, 0, 2, 0, 0, 0])])
    expect(layout.solid).toEqual([false, false, false, false, false, false])
    expect(layout.boxes).toEqual([
      { x0: 0, y0: 0.5, x1: 1, y1: 1 },
      { x0: 2, y0: 0, x1: 2.25, y1: 1 },
    ])
  })

  it('flips shapes with the tile', () => {
    const flipH = (0x80000000 | 2) >>> 0
    const flipV = (0x40000000 | 1) >>> 0
    const flipD = (0x20000000 | 1) >>> 0
    const layout = make([tiles([flipH, flipV, flipD, 0, 0, 0])])
    expect(layout.boxes).toEqual([
      { x0: 0.75, y0: 0, x1: 1, y1: 1 }, // left quarter, mirrored to the right
      { x0: 1, y0: 0, x1: 2, y1: 0.5 }, // bottom half, flipped to the top
      { x0: 2.5, y0: 0, x1: 3, y1: 1 }, // bottom half, transposed to the right half
    ])
    const box = shapeBoxes(
      [{ x: 0, y: 0, w: 4, h: 4, exact: true }],
      { w: 16, h: 16, flipH: false, flipV: false, flipD: false },
      { left: 32, top: 16, w: 32, h: 32 }, // drawn twice as big
      16,
    )
    expect(box).toEqual([{ x0: 2, y0: 1, x1: 2.5, y1: 1.5 }])
  })

  it('warns once per tile when an ellipse or polygon is approximated', () => {
    const approx = {
      ...fenceSet,
      tiles: { 0: { properties: {}, collision: [{ x: 0, y: 0, w: 8, h: 8, exact: false }] } },
    }
    const layout = layoutFromTiled({
      tiled: { ...map, tilesets: [approx], layers: [tiles([1, 1, 0, 0, 0, 0])] },
    })
    expect(layout.warnings.filter((w) => w.includes('bounding box'))).toHaveLength(1)
  })

  it('groups touching tiles of a sorted layer into pieces with their bottom edge', () => {
    // Two pieces: a 1×2 column on the left (rows 0-1) and a single tile at the top right.
    const layout = make([tiles([3, 0, 3, 3, 0, 0], { sorted: true })])
    expect(layout.below).toHaveLength(0)
    expect(layout.above).toHaveLength(0)
    expect(layout.sorted.map((p) => [p.cells.map((c) => c.i), p.bottom])).toEqual([
      [[0, 3], 2],
      [[2], 1],
    ])
    expect(layoutImages(layout)).toContain('ts.png')
    expect(ownedCells(layout)).toEqual([true, false, true, true, false, false])
  })

  it('keeps objects placed between tiles at their exact spot', () => {
    const objects: TiledMapData['layers'][number] = {
      kind: 'objects',
      name: 'O',
      visible: true,
      properties: {},
      objects: [
        obj({ name: 'god', x: 22, y: 3.5, width: 16, height: 16 }),
        obj({ id: 2, name: 'rock', x: 16, y: 16, width: 16, height: 16 }),
        obj({
          id: 3,
          name: 'stone',
          x: 4,
          y: 0,
          width: 16,
          height: 16,
          properties: { solid: true },
        }),
      ],
    }
    const layout = make([tiles([0, 0, 0, 0, 0, 0]), objects])
    const [god, rock, stone] = layout.objects
    expect(god).toMatchObject({ at: { x: 1, y: 0 }, offset: { x: 0.375, y: 0.2188 } })
    expect(rock?.offset).toBeUndefined()
    expect(stone).toMatchObject({ at: { x: 0, y: 0 }, offset: { x: 0.25, y: 0 }, solid: true })
    // Off-grid solid objects block with a box, not whole tiles.
    expect(layout.solid.every((s) => !s)).toBe(true)
    expect(offsetBoxes(layout.objects)).toEqual([{ x0: 0.25, y0: 0, x1: 1.25, y1: 1 }])
    expect(objectPos(god as MapObject)).toEqual({ x: 1.375, y: 0.2188 })
  })

  it('tile objects whose tile has shapes block with those shapes (unless solid is set)', () => {
    const objects: TiledMapData['layers'][number] = {
      kind: 'objects',
      name: 'O',
      visible: true,
      properties: {},
      objects: [
        obj({ name: 'fence', gid: 1, x: 16, y: 32, width: 16, height: 16 }),
        obj({
          id: 2,
          name: 'open',
          gid: 1,
          x: 0,
          y: 32,
          width: 16,
          height: 16,
          properties: { solid: false },
        }),
      ],
    }
    const layout = make([tiles([0, 0, 0, 0, 0, 0]), objects])
    expect(layout.boxes).toEqual([{ x0: 1, y0: 1.5, x1: 2, y1: 2 }])
  })

  it('structures replace the map boxes in cells they own and bring their own', () => {
    const structure = make([tiles([1, 0, 0, 0])], 2, 2)
    const base = [
      { x0: 0, y0: 0.5, x1: 1, y1: 1 }, // stays: outside the structure
      { x0: 2, y0: 0.5, x1: 3, y1: 1 }, // removed: cell (2,0) is drawn by the structure
      { x0: 3, y0: 0, x1: 4, y1: 1 }, // stays: the structure leaves (3,0) empty
    ]
    const stamped = stampBoxes(base, 4, 2, [{ layout: structure, at: { x: 2, y: 0 } }])
    expect(stamped).toEqual([base[0], base[2], { x0: 2, y0: 0.5, x1: 3, y1: 1 }])
    expect(
      blockedCells([false, false, false, false], 2, 2, [{ x0: 0.5, y0: 0.5, x1: 1.5, y1: 1 }]),
    ).toEqual([true, true, false, false])
    expect(boxCells({ x0: 1, y0: 0, x1: 2, y1: 1 }, 4, 2)).toEqual([1])
    // The player standing in the structure's fence box can't have it placed on them.
    expect(
      placementProblem(
        { width: 4, height: 2 },
        { layout: structure, at: { x: 2, y: 0 } },
        { x: 2.5, y: 0.8 },
      ),
    ).toContain('solid')
    expect(
      placementProblem(
        { width: 4, height: 2 },
        { layout: structure, at: { x: 2, y: 0 } },
        { x: 2.5, y: 0.2 },
      ),
    ).toBeNull()
    expect(clipLayout(structure, { x: 3, y: 0 }, { width: 3, height: 2 }).boxes).toEqual([])
  })
})

describe('terrain and pictures', () => {
  const tiles = (name: string, data: number[], properties: Record<string, unknown> = {}) =>
    ({ kind: 'tiles', name, visible: true, opacity: 1, properties, data }) as never
  const picture = (name: string, properties: Record<string, unknown> = {}) =>
    ({
      kind: 'image',
      name,
      visible: true,
      opacity: 0.5,
      image: `${name}.png`,
      x: 4,
      y: 8,
      parallaxX: 0.5,
      parallaxY: 1,
      repeatX: true,
      repeatY: false,
      properties,
    }) as never
  const withTerrain: TiledMapData = {
    ...map,
    tilesets: [
      { ...tileset, tiles: { ...tileset.tiles, 2: { properties: { terrain: 'grass' } } } } as never,
    ],
    layers: [
      picture('hills'),
      tiles('Ground', [3, 3, 1, 0, 0, 0]),
      // A marker layer names every cell it paints; '' clears what a lower layer said.
      tiles('Mud', [0, 1, 0, 0, 1, 0], { terrain: 'mud', visible: false }),
      tiles('Clear', [1, 0, 0, 0, 0, 0], { terrain: '' }),
      { kind: 'objects', name: 'Objects', visible: true, properties: {}, objects: [] },
      picture('fog', { driftx: 6, blend: 'add' }),
      picture('sky', { above: true, blend: 'nonsense' }),
    ],
  }
  const layout = layoutFromTiled({ tiled: withTerrain })

  it('terrain comes from tile properties; marker layers win, later layers last', () => {
    expect(layout.terrain?.[0]).toBeUndefined()
    expect(layout.terrain?.[1]).toBe('mud')
    expect(layout.terrain?.[2]).toBeUndefined()
    expect(layout.terrain?.[4]).toBe('mud')
  })

  it('a plain tile with a terrain property names its cell', () => {
    const plain = layoutFromTiled({
      tiled: { ...withTerrain, layers: [tiles('Ground', [3, 0, 0, 0, 0, 0])] },
    })
    expect(plain.terrain?.[0]).toBe('grass')
  })

  it('image layers become pictures: behind the map, or above after the objects', () => {
    expect(layout.pictures?.map((p) => [p.image, p.above])).toEqual([
      ['hills.png', false],
      ['fog.png', true],
      ['sky.png', true],
    ])
    expect(layout.pictures?.[0]).toMatchObject({
      x: 4,
      y: 8,
      parallax: { x: 0.5, y: 1 },
      repeat: { x: true, y: false },
      drift: { x: 0, y: 0 },
      opacity: 0.5,
    })
    expect(layout.pictures?.[1]).toMatchObject({ drift: { x: 6, y: 0 }, blend: 'add' })
    expect(layout.pictures?.[2]?.blend).toBeUndefined()
    expect(layoutImages(layout)).toEqual(expect.arrayContaining(['hills.png', 'fog.png']))
  })
})
