// Things that work differently in the browser, the desktop (Electron) app and Android (Capacitor).
import { Capacitor } from '@capacitor/core'
import type { ElectronBridge } from '../../electron/bridge'

declare global {
  interface Window {
    electron?: ElectronBridge
  }
}

const bridge = typeof window === 'undefined' ? undefined : window.electron
export const isElectron = bridge?.isElectron === true
export const isAndroid = Capacitor.getPlatform() === 'android'

/** Android: writes the file to the app's cache and opens the share sheet ("Save to Files", Drive, …). */
async function shareTextFile(name: string, text: string): Promise<boolean> {
  const { Directory, Encoding, Filesystem } = await import('@capacitor/filesystem')
  const { Share } = await import('@capacitor/share')
  const { uri } = await Filesystem.writeFile({
    path: `exports/${name}`,
    data: text,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
    recursive: true,
  })
  try {
    await Share.share({ title: name, files: [uri] })
    return true
  } catch {
    return false // the player closed the share sheet
  }
}

/**
 * Lets the player save a text file: native "Save as…" dialog on desktop, the share sheet on
 * Android, a download in the browser. Resolves false if the player cancelled.
 */
export async function saveTextFile(defaultName: string, text: string): Promise<boolean> {
  if (bridge) return bridge.saveFile({ defaultName, text })
  if (isAndroid) return shareTextFile(defaultName, text)
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = defaultName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}

/**
 * Saves a picture (a data URL). Desktop: into Pictures/<game name>/, resolves with the file's
 * path. Android: the share sheet (resolves ''). Browser: a download (resolves ''). Null = it was
 * not saved (cancelled, or it failed).
 */
export async function saveImageFile(name: string, dataUrl: string): Promise<string | null> {
  if (bridge) return bridge.saveImage({ name, dataUrl })
  if (isAndroid) {
    const { Directory, Filesystem } = await import('@capacitor/filesystem')
    const { Share } = await import('@capacitor/share')
    const { uri } = await Filesystem.writeFile({
      path: `exports/${name}`,
      data: dataUrl.slice(dataUrl.indexOf(',') + 1), // base64
      directory: Directory.Cache,
      recursive: true,
    })
    try {
      await Share.share({ title: name, files: [uri] })
      return ''
    } catch {
      return null // the player closed the share sheet
    }
  }
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = name
  link.click()
  return ''
}

/**
 * Lets the player pick a .json file: native "Open…" dialog on desktop, the file picker in the
 * browser. Resolves null if nothing was picked. Call it from a click/key handler.
 */
export function openTextFile(): Promise<{ name: string; text: string } | null> {
  if (bridge) return bridge.openFile()
  return new Promise((resolve) => {
    const picker = document.createElement('input')
    picker.type = 'file'
    // Android's picker filters by file type, and save files shared through apps often lose
    // theirs, so show every file there. The save is checked when it is read anyway.
    if (!isAndroid) picker.accept = '.json,application/json'
    picker.addEventListener('change', () => {
      const file = picker.files?.[0]
      if (!file) return resolve(null)
      file.text().then(
        (text) => resolve({ name: file.name, text }),
        () => resolve(null),
      )
    })
    picker.addEventListener('cancel', () => resolve(null))
    picker.click()
  })
}

export function isFullscreen(): Promise<boolean> {
  if (bridge) return bridge.isFullscreen()
  return Promise.resolve(document.fullscreenElement !== null)
}

/** Browsers only allow this during a click or key press. */
export async function setFullscreen(on: boolean): Promise<void> {
  if (bridge) return bridge.setFullscreen(on)
  try {
    if (on && !document.fullscreenElement) await document.documentElement.requestFullscreen()
    if (!on && document.fullscreenElement) await document.exitFullscreen()
  } catch {
    // Not allowed right now (no user gesture) or not supported: ignore.
  }
}

/** Calls back when fullscreen changes (F11, Esc in the browser, the settings toggle). */
export function onFullscreenChange(callback: (on: boolean) => void): () => void {
  if (bridge) return bridge.onFullscreenChange(callback)
  const listener = () => callback(document.fullscreenElement !== null)
  document.addEventListener('fullscreenchange', listener)
  return () => document.removeEventListener('fullscreenchange', listener)
}

/** Only the desktop app can show its save folder (Android keeps it private). */
export const canShowSaveFolder = isElectron

export function showSaveFolder(): Promise<void> {
  return bridge?.showSaveFolder() ?? Promise.resolve()
}

/** Only the desktop app can quit itself. */
export const canQuit = isElectron

export function quit(): void {
  bridge?.quit()
}

/**
 * Desktop: `handler` runs when the window is about to close and the window waits for it (a few
 * seconds at most), so a last save reaches the disk. Elsewhere it is never called.
 */
export function onBeforeClose(handler: () => Promise<void>): void {
  bridge?.onBeforeClose?.(handler)
}

/**
 * Android: `handler` runs when the hardware / gesture Back is used (instead of the app closing).
 * Elsewhere it is never called.
 */
export function onBackButton(handler: () => void): void {
  if (!isAndroid) return
  void import('@capacitor/app')
    .then(({ App }) => App.addListener('backButton', handler))
    .catch((error: unknown) => console.error('[platform] no back button', error))
}
