// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  type FileBackend,
  flushStorage,
  keyToPath,
  loadStorage,
  onStorageError,
  pathToKey,
  setBackendForTests,
  storage,
  storageFailing,
  storageKind,
} from './storage'

/** localStorage whose setItem goes through `write` (to refuse some or all writes). */
function stubSetItem(write: (key: string, value: string, real: Storage) => void) {
  const real = localStorage
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => real.getItem(key),
    setItem: (key: string, value: string) => write(key, value, real),
    removeItem: (key: string) => real.removeItem(key),
    key: (index: number) => real.key(index),
    clear: () => real.clear(),
    get length() {
      return real.length
    },
  })
}

function fakeFiles(initial: Record<string, string> = {}) {
  const files = new Map(Object.entries(initial))
  const backend: FileBackend = {
    readAll: vi.fn(async () => Object.fromEntries(files)),
    write: vi.fn(async (key: string, text: string) => {
      files.set(key, text)
    }),
    remove: vi.fn(async (key: string) => {
      files.delete(key)
    }),
  }
  return { files, backend }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  setBackendForTests(null)
  delete window.electron
  localStorage.clear()
})

describe('file names', () => {
  it('maps keys to files and back', () => {
    expect(keyToPath('save:slot1')).toBe('game/saves/slot1.json')
    expect(keyToPath('settings')).toBe('game/settings.json')
    expect(pathToKey('game/saves/slot1.json')).toBe('save:slot1')
    expect(pathToKey('game/settings.json')).toBe('settings')
    expect(pathToKey('game/saves/slot1.json.tmp')).toBeNull()
    expect(pathToKey('Preferences')).toBeNull()
  })
})

describe('in the browser', () => {
  it('uses localStorage', async () => {
    await loadStorage()
    expect(storageKind()).toBe('browser')
    storage.set('settings', '{}')
    expect(localStorage.getItem('INSERTGAMENAMEHERE:settings')).toBe('{}')
  })

  it('keeps data in memory when the browser stores nothing', async () => {
    stubSetItem(() => {
      throw new Error('blocked')
    })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    await loadStorage()
    expect(storageKind()).toBe('memory')
    expect(storage.set('save:slot1', 'one')).toBe(true)
    expect(storage.get('save:slot1')).toBe('one')
    storage.remove('save:slot1')
    expect(storage.get('save:slot1')).toBeNull()
  })

  it('reports a full storage as a failed write, not as memory mode', async () => {
    await loadStorage()
    stubSetItem(() => {
      throw new Error('quota')
    })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(storageKind()).toBe('browser')
    expect(storage.set('save:slot1', 'one')).toBe(false)
    expect(storageFailing()).toBe(true) // the Saves window warns while this is true
    storage.remove('save:slot1')
    expect(storageFailing()).toBe(false)
  })
})

describe('with files (desktop)', () => {
  it('reads files at start, writes and deletes in the background', async () => {
    const { files, backend } = fakeFiles({ 'save:slot1': 'one' })
    window.electron = { storage: backend } as unknown as typeof window.electron
    await loadStorage()
    expect(storageKind()).toBe('files')
    expect(storage.get('save:slot1')).toBe('one')

    storage.set('save:slot2', 'two')
    expect(storage.get('save:slot2')).toBe('two') // at once, from memory
    storage.remove('save:slot1')
    await flushStorage()
    expect(Object.fromEntries(files)).toEqual({ 'save:slot2': 'two' })
    expect(localStorage.length).toBe(0)
  })

  it('moves old localStorage data into files once', async () => {
    localStorage.setItem('INSERTGAMENAMEHERE:save:auto', 'old')
    localStorage.setItem('INSERTGAMENAMEHERE:settings', 'old settings')
    const { files, backend } = fakeFiles({ settings: 'file settings' })
    window.electron = { storage: backend } as unknown as typeof window.electron
    await loadStorage()
    expect(files.get('save:auto')).toBe('old')
    expect(files.get('settings')).toBe('file settings') // files win
    expect(localStorage.length).toBe(0)
  })

  it('keeps the newer save when a slot is in localStorage and in a file', async () => {
    const older = JSON.stringify({ savedAt: '2026-01-01T00:00:00.000Z' })
    const newer = JSON.stringify({ savedAt: '2026-02-01T00:00:00.000Z' })
    localStorage.setItem('INSERTGAMENAMEHERE:save:slot1', newer)
    localStorage.setItem('INSERTGAMENAMEHERE:save:slot2', older)
    const { files, backend } = fakeFiles({ 'save:slot1': older, 'save:slot2': newer })
    window.electron = { storage: backend } as unknown as typeof window.electron
    await loadStorage()
    expect(storage.get('save:slot1')).toBe(newer)
    expect(files.get('save:slot1')).toBe(newer)
    expect(storage.get('save:slot2')).toBe(newer)
    expect(localStorage.length).toBe(0)
  })

  it('tells listeners when a file write fails, until a later write works', async () => {
    const { backend } = fakeFiles()
    setBackendForTests(backend)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const failedKeys: string[] = []
    onStorageError((key) => failedKeys.push(key))
    vi.mocked(backend.write).mockRejectedValueOnce(new Error('disk full'))
    expect(storage.set('save:slot1', 'one')).toBe(true) // queued: the failure comes later
    await flushStorage()
    expect(failedKeys).toEqual(['save:slot1'])
    expect(storageFailing()).toBe(true)
    storage.set('save:slot1', 'two')
    await flushStorage()
    expect(storageFailing()).toBe(false)
  })

  it('keeps writes to one key in order', async () => {
    const { files, backend } = fakeFiles()
    setBackendForTests(backend)
    storage.set('settings', 'a')
    storage.set('settings', 'b')
    storage.clear()
    storage.set('settings', 'c')
    await flushStorage()
    expect(files.get('settings')).toBe('c')
  })
})
