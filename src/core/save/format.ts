// Pure save-file logic: parse, validate and migrate. No storage, no game state.
import { APP } from '../appInfo'
import type { Migration, SaveFile } from './define'

/** src/content/config/app.ts saveFormat: only save files with it load. */
export const SAVE_FORMAT = APP.saveFormat

export type SaveErrorCode = 'invalid' | 'newer' | 'missing-migration' | 'migration-failed'

export class SaveError extends Error {
  constructor(
    readonly code: SaveErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'SaveError'
  }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Checks the outer shape of a save (not the game data inside it). */
export function validateSave(value: unknown): SaveFile<unknown> {
  if (!isObject(value) || value.format !== SAVE_FORMAT) {
    throw new SaveError('invalid', 'This is not a save file for this game.')
  }
  if (!Number.isInteger(value.version) || (value.version as number) < 1) {
    throw new SaveError('invalid', 'The save file has no valid version.')
  }
  if (value.gameVersion !== undefined && typeof value.gameVersion !== 'string') {
    throw new SaveError('invalid', 'The save file has an invalid game version.')
  }
  if (!isObject(value.engine) || !isObject(value.data)) {
    throw new SaveError('invalid', 'The save file is damaged (missing engine or data).')
  }
  return value as unknown as SaveFile<unknown>
}

export function parseSave(text: string): SaveFile<unknown> {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new SaveError('invalid', 'The save file is not valid JSON.')
  }
  return validateSave(value)
}

/**
 * Upgrades a save step by step (v2 → v3 → v4 …) to `currentVersion`.
 * Never changes the input object.
 */
export function migrateSave(
  save: SaveFile<unknown>,
  currentVersion: number,
  migrations: Record<number, Migration>,
): SaveFile<unknown> {
  if (save.version > currentVersion) {
    const from = save.gameVersion ? ` (${save.gameVersion})` : ''
    throw new SaveError(
      'newer',
      `This save is from a newer version of the game${from}. Please update the game to load it.`,
    )
  }
  let result = structuredClone(save)
  for (let version = save.version + 1; version <= currentVersion; version++) {
    const migration = migrations[version]
    if (!migration) {
      throw new SaveError(
        'missing-migration',
        `No migration to save version ${version} (v${version}.ts).`,
      )
    }
    try {
      const upgraded = migration({
        engine: result.engine,
        data: result.data as Record<string, unknown>,
      })
      result = validateSave({ ...result, ...upgraded, version, format: SAVE_FORMAT })
    } catch (error) {
      if (error instanceof SaveError) throw error
      throw new SaveError('migration-failed', `Migration v${version}.ts failed: ${String(error)}`)
    }
  }
  return result
}
