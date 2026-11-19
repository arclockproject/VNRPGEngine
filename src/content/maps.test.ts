// Checks every map in src/content/maps/. New maps are covered automatically.
import { describe, expect, it } from 'vitest'
import { animationStates } from '@/core/sprite/anim'
import { objectSprite, resolveObject } from '@/core/sprite/resolve'
import { isSolid } from '@/core/world/grid'
import { layoutFromTiled, type TiledSource } from '@/core/world/layout'
import { parseTime } from '@/core/world/schedule'
import { mapLoaders, props } from '@/generated/registry.gen'

const entries = Object.entries(mapLoaders) as [string, () => Promise<{ default: TiledSource }>][]

describe.each(entries)('map "%s"', (name, load) => {
  it('is well formed', async () => {
    const layout = layoutFromTiled((await load()).default)
    expect(layout.warnings, 'map warnings').toEqual([])
    const grid = { width: layout.width, height: layout.height, solid: layout.solid }

    for (const raw of layout.objects) {
      if (raw.prop) expect(props, `prop "${raw.prop}" exists`).toHaveProperty(raw.prop)
      const object = resolveObject(raw, name)
      const { w, h } = object.size ?? { w: 1, h: 1 }
      const inside =
        object.at.x >= 0 &&
        object.at.y >= 0 &&
        object.at.x + w <= layout.width &&
        object.at.y + h <= layout.height
      expect(
        inside,
        `object ${object.id ?? object.label ?? JSON.stringify(object.at)} inside map`,
      ).toBe(true)

      // Doors: the target map and spawn must exist.
      if (object.door) {
        const target = mapLoaders[object.door.map as keyof typeof mapLoaders]
        expect(target, `door "${object.id}" -> map "${object.door.map}"`).toBeDefined()
        if (target && object.door.spawn) {
          const targetLayout = layoutFromTiled((await target()).default)
          expect(Object.keys(targetLayout.spawns), `door "${object.id}" spawn`).toContain(
            object.door.spawn,
          )
        }
      }

      // Sprite objects: there must be a sprite, and the start animation must exist.
      if (object.character || object.sprite) {
        const sprite = objectSprite(object)
        const label = object.id ?? object.character
        expect(sprite, `"${label}" has a map sprite`).toBeDefined()
        const states = animationStates(Object.keys(sprite?.animations ?? {}))
        expect(states, `"${label}" animations`).toContain(object.animation ?? 'idle')
        // Schedules: valid times, spots on the map and walkable, animations that exist.
        for (const entry of object.schedule ?? []) {
          expect(() => parseTime(entry.from), `"${label}" schedule time`).not.toThrow()
          if (entry.animation)
            expect(states, `"${label}" schedule animation`).toContain(entry.animation)
          if (!entry.at) continue
          const spot = `"${label}" schedule ${entry.from} at ${entry.at.x},${entry.at.y}`
          expect(isSolid(grid, entry.at.x, entry.at.y), `${spot} walkable`).toBe(false)
        }
      }
    }

    const spawns = Object.entries(layout.spawns)
    expect(spawns.length, 'has at least one spawn').toBeGreaterThan(0)
    for (const [spawn, pos] of spawns) {
      expect(isSolid(grid, pos.x, pos.y), `spawn "${spawn}" on a walkable tile`).toBe(false)
    }
  })
})

import { placementProblem, stampSolid } from '@/core/world/layout'
// Structures (src/content/structures) and where the content places them.
import { structureLoaders } from '@/generated/registry.gen'
import { HOUSE_SPOT } from './events/jack/hello'

const structureEntries = Object.entries(structureLoaders) as [
  string,
  () => Promise<{ default: TiledSource }>,
][]

describe.each(structureEntries)('structure "%s"', (_name, load) => {
  it('is well formed', async () => {
    const layout = layoutFromTiled((await load()).default)
    expect(layout.warnings, 'structure warnings').toEqual([])
  })
})

describe("Jack's house spot", () => {
  it('fits in town, on open ground', async () => {
    const town = layoutFromTiled((await mapLoaders['countryside/town']()).default)
    const house = layoutFromTiled((await structureLoaders.house()).default)
    expect(placementProblem(town, { layout: house, at: HOUSE_SPOT })).toBeNull()
    // Nothing solid in the town under the house (it shouldn't cover trees, water or walls).
    for (let y = 0; y < house.height; y++) {
      for (let x = 0; x < house.width; x++) {
        expect(
          town.solid[(HOUSE_SPOT.y + y) * town.width + HOUSE_SPOT.x + x],
          `town tile ${HOUSE_SPOT.x + x},${HOUSE_SPOT.y + y}`,
        ).toBe(false)
      }
    }
    // And after building it, the spawns are still walkable.
    const solid = stampSolid(town.solid, town.width, town.height, [
      { layout: house, at: HOUSE_SPOT },
    ])
    for (const spawn of Object.values(town.spawns))
      expect(solid[spawn.y * town.width + spawn.x]).toBe(false)
  })
})
