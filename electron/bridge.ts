// Shape of window.electron: everything the game may ask the desktop app to do.
// Shared by the preload script and the game (src/core/platform.ts). Keep it small.
export interface ElectronBridge {
  isElectron: true
  platform: string
  /** Native "Save as…" dialog. Resolves false if the player cancelled. */
  saveFile(options: { defaultName: string; text: string }): Promise<boolean>
  /** Native "Open…" dialog for .json files. Resolves null if cancelled. */
  openFile(): Promise<{ name: string; text: string } | null>
  setFullscreen(on: boolean): Promise<void>
  isFullscreen(): Promise<boolean>
  /** Called whenever fullscreen changes (also via F11). Returns an unsubscribe. */
  onFullscreenChange(callback: (on: boolean) => void): () => void
  quit(): void
  /**
   * The window is about to close (X button, Alt+F4, quit): `callback` gets time to save and to
   * finish writing files. The window closes when its promise settles (or after a few seconds).
   */
  onBeforeClose(callback: () => Promise<void>): void
  /** Save slots, settings and progress as files in the userData folder. */
  storage: FileBackend
  /** Opens the folder holding the save files in the system file manager. */
  showSaveFolder(): Promise<void>
  /**
   * Writes a picture (png / jpeg data URL) into Pictures/<game name>/. Resolves with the file's
   * path, or null if it could not be written.
   */
  saveImage(options: { name: string; dataUrl: string }): Promise<string | null>
}

/**
 * Stored data as files, one per key (desktop and Android).
 * 'save:slot1' -> 'game/saves/slot1.json', 'settings' -> 'game/settings.json'.
 */
export interface FileBackend {
  /** Every stored key with its text. */
  readAll(): Promise<Record<string, string>>
  write(key: string, text: string): Promise<void>
  remove(key: string): Promise<void>
}

/** Keys are the only thing that becomes a file name, so keep them simple. */
export const KEY_PATTERN = /^[a-z0-9_-]+(:[a-z0-9_-]+)?$/

export function keyToPath(key: string): string {
  const [first, second] = key.split(':')
  return second === undefined ? `game/${first}.json` : `game/${first}s/${second}.json`
}

export function pathToKey(path: string): string | null {
  const match = /^game\/(?:([a-z0-9_-]+)s\/)?([a-z0-9_-]+)\.json$/.exec(path)
  if (!match) return null
  return match[1] ? `${match[1]}:${match[2]}` : (match[2] ?? null)
}

/** IPC channel names, shared by main and preload. */
export const CHANNELS = {
  saveFile: 'game:save-file',
  openFile: 'game:open-file',
  setFullscreen: 'game:set-fullscreen',
  isFullscreen: 'game:is-fullscreen',
  fullscreenChanged: 'game:fullscreen-changed',
  quit: 'game:quit',
  beforeClose: 'game:before-close',
  readyToClose: 'game:ready-to-close',
  storageReadAll: 'game:storage-read-all',
  storageWrite: 'game:storage-write',
  storageRemove: 'game:storage-remove',
  showSaveFolder: 'game:show-save-folder',
  saveImage: 'game:save-image',
} as const
