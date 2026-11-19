// Checks the real migrations in src/content/save/ against data.ts and the persistent store:
// an old save (or old persistent data), upgraded to the current version, must have the same shape
// as a new game. When you add a migration vN.ts, add an example of the old data below.
import { describe, expect, it } from 'vitest'
import type { Migration, SaveFile } from '@/core/save/define'
import { migrateSave, SAVE_FORMAT } from '@/core/save/format'
import {
  migratePersistent,
  PERSISTENT_VERSION,
  persistentMigrations,
} from '@/core/save/persistentMigrations'
import { saveMigrations } from '@/generated/registry.gen'
import { initialData } from './save/data'

const migrations = saveMigrations as Record<number, Migration>
const current = Math.max(1, ...Object.keys(migrations).map(Number))

/**
 * Example saves from older versions: { version, data } as an old game wrote it. E.g. after adding
 * v2.ts (which adds `inventory`):
 *   { version: 1, data: { stats: { health: 100, hunger: 0 }, flags: {} } },
 */
const OLD_SAVES: { version: number; data: Record<string, unknown> }[] = []

/** Same for persistent data (read lines, unlocks, achievements), see persistent_migrations/. */
const OLD_PERSISTENT: { version: number; data: Record<string, unknown> }[] = []

/** The keys of an object, recursively (values are ignored). */
function shape(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return typeof value
  return Object.fromEntries(
    Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, shape(v)]),
  )
}

describe('save migrations', () => {
  it('has no gaps (v2 … vN)', () => {
    for (let v = 2; v <= current; v++) expect(migrations[v], `v${v}.ts`).toBeTypeOf('function')
  })

  it('has an example old save for every migration', () => {
    for (let v = 2; v <= current; v++) {
      expect(
        OLD_SAVES.some((save) => save.version === v - 1),
        `add a version ${v - 1} save to OLD_SAVES`,
      ).toBe(true)
    }
  })

  it.each(OLD_SAVES)('upgrades the version $version example to the current shape', (old) => {
    const save: SaveFile<unknown> = {
      format: SAVE_FORMAT,
      version: old.version,
      savedAt: '2026-01-01T00:00:00.000Z',
      engine: { map: null, playtimeMs: 0 },
      data: old.data,
    }
    expect(shape(migrateSave(save, current, migrations).data)).toEqual(shape(initialData()))
  })
})

describe('persistent migrations', () => {
  it('has no gaps and an example for every migration', () => {
    for (let v = 2; v <= PERSISTENT_VERSION; v++) {
      expect(persistentMigrations[v], `persistent_migrations/v${v}.ts`).toBeTypeOf('function')
      expect(
        OLD_PERSISTENT.some((old) => old.version === v - 1),
        `add version ${v - 1} data to OLD_PERSISTENT`,
      ).toBe(true)
    }
  })

  it.each(OLD_PERSISTENT)('upgrades the version $version example', async (old) => {
    const { usePersistentStore } = await import('@/core/stores/persistent')
    const fresh = shape(usePersistentStore.getInitialState())
    expect(Object.keys(shape(migratePersistent(old.data, old.version)) as object).sort()).toEqual(
      Object.keys(fresh as object).sort(),
    )
  })
})
