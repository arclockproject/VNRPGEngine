import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { app, BrowserWindow, dialog, ipcMain, Menu, net, protocol, shell } from 'electron'
import appConfig from '../src/content/config/app.ts'
import { resolveApp } from '../src/core/app.ts'
import { extensionOf, type LockInfo } from '../src/core/protect/format.ts'
import { CHANNELS, KEY_PATTERN, keyToPath, pathToKey } from './bridge.ts'
import { serveLocked } from './mediaLock.ts'

const APP = resolveApp(appConfig)

/** Written by vite/protect.ts next to index.html when media is locked. */
const LOCK_FILE = 'lock.json'

// Set by scripts/dev-electron.ts. When missing we load the built web files.
const devServerUrl = process.env.VITE_DEV_SERVER_URL

/** Save files are small; refuse anything absurdly large. */
const MAX_FILE_BYTES = 50 * 1024 * 1024
const MAX_IMAGE_BYTES = 64 * 1024 * 1024

// The built game is served from app://game/ instead of file://, because the browser's fetch()
// (used for audio and PixiJS textures) does not work with file:// URLs.
const SCHEME = 'app'
protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
])

// The game's name and its data folder come from src/content/config/app.ts (before anything reads
// userData, including the single-instance lock below): <appData>/<id>, e.g. %APPDATA%\<id>.
app.setName(APP.name)
app.setPath('userData', path.join(app.getPath('appData'), APP.id))

// One copy of the game at a time: starting it again focuses the open window. The second copy
// must not go on to open a window of its own while it quits (see the start-up code at the bottom).
const firstInstance = app.requestSingleInstanceLock()
if (!firstInstance) app.quit()

/** How long a closing window may take to save before it is closed anyway. */
const CLOSE_WAIT_MS = 3000

let mainWindow: BrowserWindow | null = null

function readLockInfo(webRoot: string): LockInfo | null {
  const file = path.join(webRoot, LOCK_FILE)
  if (!existsSync(file)) return null
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as LockInfo
  } catch (error) {
    console.error('[media lock] could not read', file, error)
    return null
  }
}

function serveBuiltGame() {
  const webRoot = path.join(app.getAppPath(), 'build/web')
  // Media files are unpacked next to app.asar (asarUnpack in electron-builder.yml).
  const unpackedRoot = webRoot.replace(/app\.asar(?=[\\/])/, 'app.asar.unpacked')
  // Media lock (src/content/config/protect.ts): the build wrote lock.json when media is locked.
  const lock = readLockInfo(webRoot)
  const lockedEndings = new Set(lock?.extensions ?? [])
  protocol.handle(SCHEME, async (request) => {
    const { pathname } = new URL(request.url)
    const file = path.normalize(path.join(webRoot, decodeURIComponent(pathname)))
    // Never serve anything outside the built game folder.
    if (file !== webRoot && !file.startsWith(webRoot + path.sep)) {
      return new Response('Not found', { status: 404 })
    }
    const unpacked = path.join(unpackedRoot, path.relative(webRoot, file))
    const served = unpackedRoot !== webRoot && existsSync(unpacked) ? unpacked : file
    // Videos ask for parts of the file (to seek, and to start before all of it is read).
    const range = request.headers.get('range')
    if (lock && lockedEndings.has(extensionOf(served.replaceAll('\\', '/')))) {
      try {
        const unlocked = await serveLocked(served, lock.key, range)
        if (unlocked) return unlocked
      } catch {
        return new Response('Not found', { status: 404 })
      }
    }
    return net.fetch(pathToFileURL(served).toString(), range ? { headers: { range } } : undefined)
  })
}

// Save slots, settings and progress live in <userData>/game/ (Windows: %APPDATA%\<app id>,
// Linux: ~/.config/<app id>, macOS: ~/Library/Application Support/<app id>).
const dataRoot = () => app.getPath('userData')

function storageFile(key: unknown): string {
  if (typeof key !== 'string' || !KEY_PATTERN.test(key)) throw new Error(`Bad storage key: ${key}`)
  return path.join(dataRoot(), keyToPath(key))
}

async function readAllStored(): Promise<Record<string, string>> {
  const result: Record<string, string> = {}
  const walk = async (relative: string): Promise<void> => {
    const entries = await readdir(path.join(dataRoot(), relative), { withFileTypes: true }).catch(
      () => [],
    )
    for (const entry of entries) {
      const child = `${relative}/${entry.name}`
      if (entry.isDirectory()) await walk(child)
      const key = pathToKey(child)
      if (!entry.isFile() || !key) continue
      // One unreadable file must not hide every other save.
      try {
        result[key] = await readFile(path.join(dataRoot(), child), 'utf8')
      } catch (error) {
        console.error('[storage] could not read', child, error)
      }
    }
  }
  await walk('game')
  return result
}

function registerIpc() {
  ipcMain.handle(CHANNELS.storageReadAll, () => readAllStored())
  // Synchronous on purpose: a write that started always finishes, even if the app quits next.
  ipcMain.handle(CHANNELS.storageWrite, (_event, key: unknown, text: unknown) => {
    if (typeof text !== 'string' || text.length > MAX_FILE_BYTES) throw new Error('Bad save data')
    const file = storageFile(key)
    mkdirSync(path.dirname(file), { recursive: true })
    // Write a temporary file and swap it in, so a crash never leaves half a save.
    writeFileSync(`${file}.tmp`, text, 'utf8')
    renameSync(`${file}.tmp`, file)
  })
  ipcMain.handle(CHANNELS.storageRemove, (_event, key: unknown) => {
    rmSync(storageFile(key), { force: true })
  })
  ipcMain.handle(CHANNELS.showSaveFolder, async () => {
    const folder = path.join(dataRoot(), 'game', 'saves')
    mkdirSync(folder, { recursive: true })
    await shell.openPath(folder)
  })

  // Screenshots: Pictures/<game name>/<name>. Only png / jpeg data, only a plain file name.
  ipcMain.handle(CHANNELS.saveImage, async (_event, options: { name: string; dataUrl: string }) => {
    const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(
      String(options?.dataUrl ?? ''),
    )
    const name = path.basename(String(options?.name ?? ''))
    if (!match || !/^[\w.-]+\.(png|jpg)$/.test(name)) return null
    const data = Buffer.from(match[2] as string, 'base64')
    if (data.length > MAX_IMAGE_BYTES) return null
    try {
      const folder = path.join(app.getPath('pictures'), app.getName())
      mkdirSync(folder, { recursive: true })
      const file = path.join(folder, name)
      await writeFile(file, data)
      return file
    } catch (error) {
      console.error('[screenshot]', error)
      return null
    }
  })

  ipcMain.handle(
    CHANNELS.saveFile,
    async (_event, options: { defaultName: string; text: string }) => {
      if (!mainWindow || typeof options?.text !== 'string' || options.text.length > MAX_FILE_BYTES)
        return false
      const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: path.join(
          app.getPath('documents'),
          path.basename(String(options.defaultName)),
        ),
        filters: [{ name: 'Save files', extensions: ['json'] }],
      })
      if (result.canceled || !result.filePath) return false
      await writeFile(result.filePath, options.text, 'utf8')
      return true
    },
  )

  ipcMain.handle(CHANNELS.openFile, async () => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Save files', extensions: ['json'] }],
    })
    const file = result.filePaths[0]
    if (result.canceled || !file) return null
    const text = await readFile(file, 'utf8')
    if (text.length > MAX_FILE_BYTES) return null
    return { name: path.basename(file), text }
  })

  ipcMain.handle(CHANNELS.setFullscreen, (_event, on: boolean) => {
    mainWindow?.setFullScreen(on === true)
  })
  ipcMain.handle(CHANNELS.isFullscreen, () => mainWindow?.isFullScreen() ?? false)
  ipcMain.on(CHANNELS.quit, () => app.quit())
  // The game has saved and its files are written: the window may go now.
  ipcMain.on(CHANNELS.readyToClose, () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy()
  })
}

function createWindow() {
  const root = app.getAppPath()
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 640,
    minHeight: 360,
    title: APP.name,
    // The app icon (src/content/config/app.ts), written into build/web by the build.
    icon: path.join(root, 'build/web/icon.png'),
    // The window before the game draws: src/content/config/app.ts splashBackground.
    backgroundColor: APP.splashBackground,
    webPreferences: {
      preload: path.join(root, 'build/electron/main/preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      // Sound may play before the first key press (boot screens, the title call): a game, not a web page.
      autoplayPolicy: 'no-user-gesture-required',
    },
  })
  mainWindow = win

  // Fullscreen is the game's own `fullscreen` action (F11 by default, src/content/config/input.ts),
  // so players can rebind it. In dev only (vite server), F12 opens the dev tools, which the removed
  // menu used to provide.
  win.webContents.on('before-input-event', (event, inputEvent) => {
    if (inputEvent.type !== 'keyDown') return
    if (devServerUrl && inputEvent.key === 'F12') {
      event.preventDefault()
      win.webContents.toggleDevTools()
    }
  })
  // The game page never zooms (pinch, ctrl + wheel, or anything else).
  win.webContents.setVisualZoomLevelLimits(1, 1)
  win.webContents.on('zoom-changed', () => win.webContents.setZoomFactor(1))
  const notify = () => win.webContents.send(CHANNELS.fullscreenChanged, win.isFullScreen())
  win.on('enter-full-screen', notify)
  win.on('leave-full-screen', notify)

  // Links open in the normal browser, never inside the game window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    const allowed = devServerUrl
      ? url.startsWith(devServerUrl)
      : url.startsWith(`${SCHEME}://game/`)
    if (!allowed) event.preventDefault()
  })

  // Closing (X, Alt+F4, quit): first let the game save and finish writing its files. It answers
  // on the readyToClose channel; a page that can't answer is closed after a short wait.
  let closing = false
  let pageReady = false
  win.webContents.on('did-finish-load', () => {
    pageReady = true
  })
  win.on('close', (event) => {
    if (closing || !pageReady || win.webContents.isCrashed()) return
    closing = true
    event.preventDefault()
    win.webContents.send(CHANNELS.beforeClose)
    setTimeout(() => {
      if (!win.isDestroyed()) win.destroy()
    }, CLOSE_WAIT_MS)
  })

  win.on('closed', () => {
    mainWindow = null
  })

  if (devServerUrl) {
    void win.loadURL(devServerUrl)
  } else {
    void win.loadURL(`${SCHEME}://game/index.html`)
  }
}

app.on('second-instance', () => {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.focus()
})

void app.whenReady().then(() => {
  if (!firstInstance) return
  if (!devServerUrl) serveBuiltGame()
  registerIpc()
  // No menu at all (a game, not an app: Alt shows nothing). This also removes Electron's built-in
  // shortcuts (zoom, reload, dev tools), so every key reaches the game, same as web and Android.
  Menu.setApplicationMenu(null)
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
