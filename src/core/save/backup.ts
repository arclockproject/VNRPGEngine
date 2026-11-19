// Backup files: every save slot plus the persistent data (read lines, unlocks, achievements) in
// one file. Pure logic here; reading/writing the slots is in manager.ts.
import { APP } from '../appInfo'
import type { PersistentState } from '../stores/persistent'
import type { SaveFile } from './define'
import { SAVE_FORMAT, SaveError } from './format'
import { migratePersistent, PERSISTENT_VERSION } from './persistentMigrations'

export const BACKUP_FORMAT = APP.backupFormat

export interface BackupFile {
  format: string
  /** Layout of the backup file itself. The saves and the persistent data have their own versions. */
  version: number
  /** Version of `persistent` (see persistentMigrations.ts). Missing = 1. */
  persistentVersion: number
  /** Game version that wrote it (semver), for information. */
  gameVersion?: string
  savedAt: string
  /** Slot name -> save file, as stored. */
  saves: Record<string, SaveFile<unknown>>
  persistent: PersistentState
}

/**
 * Layout of the file (format, saves, persistent...). Game content changes never touch it: saves
 * and persistent data are upgraded by their own migration files. Only an engine change to this
 * layout would bump it, together with code in parseBackup() that reads the old layout.
 */
export const BACKUP_VERSION = 1

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** 'backup', 'save' or null, judged by the file's format field only. */
export function fileKind(text: string): 'backup' | 'save' | null {
  try {
    const value: unknown = JSON.parse(text)
    if (!isObject(value)) return null
    if (value.format === BACKUP_FORMAT) return 'backup'
    if (value.format === SAVE_FORMAT) return 'save'
  } catch {
    // not JSON
  }
  return null
}

/**
 * Keeps only well-formed entries of the known fields, so a hand-edited file can't break the store.
 * Other fields (added to PersistentState later) pass through as they are.
 */
function cleanPersistent(value: unknown): PersistentState {
  const source = isObject(value) ? value : {}
  const flags = (input: unknown) => {
    const result: Record<string, true> = {}
    if (isObject(input)) for (const [k, v] of Object.entries(input)) if (v === true) result[k] = v
    return result
  }
  const achievements: Record<string, string> = {}
  if (isObject(source.achievements)) {
    for (const [k, v] of Object.entries(source.achievements)) {
      if (typeof v === 'string' && !Number.isNaN(Date.parse(v))) achievements[k] = v
    }
  }
  return {
    ...source,
    read: flags(source.read),
    unlocked: flags(source.unlocked),
    achievements,
  } as PersistentState
}

/** Parses and checks a backup, and upgrades its persistent data (not the saves inside). */
export function parseBackup(text: string): BackupFile {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new SaveError('invalid', 'The backup file is not valid JSON.')
  }
  if (!isObject(value) || value.format !== BACKUP_FORMAT) {
    throw new SaveError('invalid', 'This is not a backup file for this game.')
  }
  const version = value.version
  if (!Number.isInteger(version) || (version as number) < 1) {
    throw new SaveError('invalid', 'The backup file has no valid version.')
  }
  if ((version as number) > BACKUP_VERSION) {
    const from = typeof value.gameVersion === 'string' ? ` (${value.gameVersion})` : ''
    throw new SaveError(
      'newer',
      `This backup is from a newer version of the game${from}. Please update the game to load it.`,
    )
  }
  if (!isObject(value.saves)) {
    throw new SaveError('invalid', 'The backup file is damaged (no saves).')
  }
  const from = Number.isInteger(value.persistentVersion) ? (value.persistentVersion as number) : 1
  const persistent = isObject(value.persistent) ? value.persistent : {}
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    persistentVersion: PERSISTENT_VERSION,
    gameVersion: typeof value.gameVersion === 'string' ? value.gameVersion : undefined,
    savedAt: typeof value.savedAt === 'string' ? value.savedAt : '',
    saves: value.saves as Record<string, SaveFile<unknown>>,
    persistent: cleanPersistent(migratePersistent(persistent, from)),
  }
}
