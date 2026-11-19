// Where the game keeps its data (save slots, settings, progress). The API is synchronous and never
// throws: everything is kept in memory and written in the background.
//   Web:      localStorage, keys '<app id>:<key>' (src/content/config/app.ts).
//   Desktop:  files in Electron's userData folder (see electron/main.ts).
//   Android:  files in the app's private data folder (@capacitor/filesystem, Directory.Data).
//   No storage at all (a browser with site data blocked): memory only, gone when the page closes.
// loadStorage() must finish before anything reads (main.tsx waits for it).
import { Capacitor } from '@capacitor/core'
import { type FileBackend, KEY_PATTERN, keyToPath, pathToKey } from '../../../electron/bridge'
import { APP } from '../appInfo'

export { type FileBackend, KEY_PATTERN, keyToPath, pathToKey }

const PREFIX = `${APP.id}:`

/** Where the data goes: 'files' (desktop, Android), 'browser' (localStorage) or 'memory' (nowhere). */
export type StorageKind = 'files' | 'browser' | 'memory'

let backend: FileBackend | null = null
/** localStorage can't be used (blocked or missing): everything stays in `cache` only. */
let memoryOnly = false
/** Keys whose last write failed: a file that can't be written, or a browser storage that is full. */
const failed = new Set<string>()
const errorListeners = new Set<(key: string, error: unknown) => void>()
const cache = new Map<string, string>()
// One write at a time per key, in order, so an older write never lands after a newer one.
const queues = new Map<string, Promise<void>>()

function queue(key: string, job: () => Promise<void>): void {
  const next = (queues.get(key) ?? Promise.resolve())
    .then(job)
    .then(() => {
      failed.delete(key)
    })
    .catch((error: unknown) => {
      console.error('[storage] could not write', key, error)
      failed.add(key)
      for (const listener of errorListeners) listener(key, error)
    })
  queues.set(key, next)
}

/** Whether localStorage really takes data (it can exist and still refuse every write). */
function localStorageWorks(): boolean {
  try {
    const probe = `${PREFIX}probe`
    localStorage.setItem(probe, '1')
    localStorage.removeItem(probe)
    return true
  } catch {
    return false
  }
}

/** The `savedAt` of stored text if it has one (save files do), else ''. */
function savedAt(text: string): string {
  try {
    const value = (JSON.parse(text) as { savedAt?: unknown }).savedAt
    return typeof value === 'string' ? value : ''
  } catch {
    return ''
  }
}

function localKeys(): string[] {
  const keys: string[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(PREFIX)) keys.push(key.slice(PREFIX.length))
    }
  } catch {
    // storage disabled
  }
  return keys
}

async function androidBackend(): Promise<FileBackend> {
  const { Directory, Encoding, Filesystem } = await import('@capacitor/filesystem')
  const directory = Directory.Data
  return {
    async readAll() {
      const result: Record<string, string> = {}
      const walk = async (folder: string): Promise<void> => {
        let entries: { name: string; type: 'file' | 'directory' }[]
        try {
          entries = (await Filesystem.readdir({ path: folder, directory })).files
        } catch {
          return // folder doesn't exist yet
        }
        const names = new Set(entries.map((entry) => entry.name))
        for (const entry of entries) {
          const path = `${folder}/${entry.name}`
          if (entry.type === 'directory') {
            await walk(path)
            continue
          }
          // A '.tmp' without its real file: the app stopped between the two steps of write().
          const orphan = entry.name.endsWith('.json.tmp') && !names.has(entry.name.slice(0, -4))
          const key = pathToKey(orphan ? path.slice(0, -4) : path)
          if (!key) continue
          // One unreadable file must not hide every other save.
          try {
            const file = await Filesystem.readFile({ path, directory, encoding: Encoding.UTF8 })
            if (typeof file.data === 'string') result[key] = file.data
          } catch (error) {
            console.error('[storage] could not read', path, error)
          }
        }
      }
      await walk('game')
      return result
    },
    async write(key, text) {
      // Write a temporary file first, so a crash mid-write never leaves half a save.
      const path = keyToPath(key)
      const temp = `${path}.tmp`
      await Filesystem.writeFile({
        path: temp,
        data: text,
        directory,
        encoding: Encoding.UTF8,
        recursive: true,
      })
      // Not sure rename() replaces an existing file on every Android version, so delete it first.
      await Filesystem.deleteFile({ path, directory }).catch(() => {})
      await Filesystem.rename({ from: temp, to: path, directory, toDirectory: directory })
    },
    async remove(key) {
      try {
        await Filesystem.deleteFile({ path: keyToPath(key), directory })
      } catch {
        // already gone
      }
    },
  }
}

function pickBackend(): Promise<FileBackend | null> {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (window.electron?.storage) return Promise.resolve(window.electron.storage)
  if (Capacitor.getPlatform() === 'android') return androidBackend()
  return Promise.resolve(null)
}

/**
 * Reads everything stored into memory. On desktop and Android, data that an older version left in
 * localStorage is moved into files the first time.
 */
export async function loadStorage(): Promise<void> {
  memoryOnly = false
  failed.clear()
  try {
    backend = await pickBackend()
    if (backend) {
      for (const [key, text] of Object.entries(await backend.readAll())) cache.set(key, text)
      for (const key of localKeys()) {
        const text = localStorage.getItem(PREFIX + key)
        if (text !== null && KEY_PATTERN.test(key)) {
          // In both places (the files could not be read on an earlier start): the newer save wins.
          const file = cache.get(key)
          if (file === undefined || savedAt(text) > savedAt(file)) {
            cache.set(key, text)
            await backend.write(key, text)
          }
        }
        localStorage.removeItem(PREFIX + key)
      }
      return
    }
  } catch (error) {
    // Fall back to localStorage rather than not starting at all.
    console.error('[storage] could not read save files, using localStorage', error)
    backend = null
    cache.clear()
  }
  if (typeof window !== 'undefined' && !localStorageWorks()) {
    console.warn('[storage] localStorage is not available: nothing will be kept after closing')
    memoryOnly = true
  }
}

/** 'files' on desktop and Android, 'browser' on the web, 'memory' when the browser stores nothing. */
export function storageKind(): StorageKind {
  return backend ? 'files' : memoryOnly ? 'memory' : 'browser'
}

/**
 * True while something could not be stored: with files, a write failed (the data is only in
 * memory); in the browser, its storage is full (the data was not stored at all).
 */
export function storageFailing(): boolean {
  return failed.size > 0
}

/** Calls `listener` whenever a background write to a file fails. Returns an unsubscribe. */
export function onStorageError(listener: (key: string, error: unknown) => void): () => void {
  errorListeners.add(listener)
  return () => {
    errorListeners.delete(listener)
  }
}

/** Waits until every background write has finished (tests, quitting). */
export async function flushStorage(): Promise<void> {
  await Promise.all(queues.values())
}

export const storage = {
  get(key: string): string | null {
    if (backend || memoryOnly) return cache.get(key) ?? null
    try {
      return localStorage.getItem(PREFIX + key)
    } catch {
      return null
    }
  },

  set(key: string, value: string): boolean {
    if (backend) {
      const files = backend
      cache.set(key, value)
      queue(key, () => files.write(key, value))
      return true
    }
    if (memoryOnly) {
      cache.set(key, value)
      return true
    }
    try {
      localStorage.setItem(PREFIX + key, value)
      failed.delete(key)
      return true
    } catch (error) {
      console.warn('[storage] could not write', key, error)
      failed.add(key) // the browser's storage is full
      return false
    }
  },

  remove(key: string): void {
    if (backend) {
      const files = backend
      cache.delete(key)
      queue(key, () => files.remove(key))
      return
    }
    if (memoryOnly) {
      cache.delete(key)
      return
    }
    failed.delete(key)
    try {
      localStorage.removeItem(PREFIX + key)
    } catch {
      // nothing to do
    }
  },

  /** Removes every key this game stored (all save slots, settings, progress). */
  clear(): void {
    if (backend || memoryOnly) {
      for (const key of [...cache.keys()]) storage.remove(key)
      return
    }
    for (const key of localKeys()) storage.remove(key)
  },
}

/** Tests only: use a fake file backend (null = localStorage). */
export function setBackendForTests(files: FileBackend | null): void {
  backend = files
  memoryOnly = false
  failed.clear()
  errorListeners.clear()
  cache.clear()
  queues.clear()
}
