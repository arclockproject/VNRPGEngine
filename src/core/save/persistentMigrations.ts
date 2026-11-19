// Upgrades for the persistent data, from src/content/save/persistent_migrations/vN.ts.
// Loaded with import.meta.glob, not the generated registry: the registry imports content that
// uses the game, and the persistent store is imported before the game exists (import cycle).
import type { PersistentMigration } from './define'
import { SaveError } from './format'

const files = import.meta.glob<{ default: PersistentMigration }>(
  '../../content/save/persistent_migrations/v*.ts',
  { eager: true },
)

export const persistentMigrations: Record<number, PersistentMigration> = {}
for (const [path, module] of Object.entries(files)) {
  const match = /\/v(\d+)\.ts$/.exec(path)
  const version = Number(match?.[1])
  if (match && version >= 2) persistentMigrations[version] = module.default
  else console.warn(`[persistent] ${path}: name upgrade files v2.ts, v3.ts, …`)
}

/** The version persistent data is written as: the highest file number, or 1 without files. */
export const PERSISTENT_VERSION = Math.max(1, ...Object.keys(persistentMigrations).map(Number))

/** Upgrades persistent data step by step from `from` to PERSISTENT_VERSION. */
export function migratePersistent(
  data: Record<string, unknown>,
  from: number,
  migrations: Record<number, PersistentMigration> = persistentMigrations,
  current: number = PERSISTENT_VERSION,
): Record<string, unknown> {
  if (from > current) {
    throw new SaveError('newer', 'This progress data is from a newer version of the game.')
  }
  let result = structuredClone(data)
  for (let version = from + 1; version <= current; version++) {
    const migration = migrations[version]
    if (!migration) {
      throw new SaveError('missing-migration', `No persistent_migrations/v${version}.ts.`)
    }
    try {
      result = migration(result)
    } catch (error) {
      throw new SaveError(
        'migration-failed',
        `persistent_migrations/v${version}.ts failed: ${String(error)}`,
      )
    }
  }
  return result
}
