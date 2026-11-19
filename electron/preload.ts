import { contextBridge, ipcRenderer } from 'electron'
import { CHANNELS, type ElectronBridge } from './bridge.ts'

// The only things the game can reach from Electron. Keep this small.
const bridge: ElectronBridge = {
  isElectron: true,
  platform: process.platform,
  saveFile: (options) => ipcRenderer.invoke(CHANNELS.saveFile, options),
  openFile: () => ipcRenderer.invoke(CHANNELS.openFile),
  setFullscreen: (on) => ipcRenderer.invoke(CHANNELS.setFullscreen, on),
  isFullscreen: () => ipcRenderer.invoke(CHANNELS.isFullscreen),
  onFullscreenChange: (callback) => {
    const listener = (_event: unknown, on: boolean) => callback(on)
    ipcRenderer.on(CHANNELS.fullscreenChanged, listener)
    return () => ipcRenderer.removeListener(CHANNELS.fullscreenChanged, listener)
  },
  quit: () => ipcRenderer.send(CHANNELS.quit),
  onBeforeClose: (callback) => {
    ipcRenderer.on(CHANNELS.beforeClose, () => {
      const done = () => ipcRenderer.send(CHANNELS.readyToClose)
      Promise.resolve().then(callback).then(done, done)
    })
  },
  storage: {
    readAll: () => ipcRenderer.invoke(CHANNELS.storageReadAll),
    write: (key, text) => ipcRenderer.invoke(CHANNELS.storageWrite, key, text),
    remove: (key) => ipcRenderer.invoke(CHANNELS.storageRemove, key),
  },
  showSaveFolder: () => ipcRenderer.invoke(CHANNELS.showSaveFolder),
  saveImage: (options) => ipcRenderer.invoke(CHANNELS.saveImage, options),
}

contextBridge.exposeInMainWorld('electron', bridge)
