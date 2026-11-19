// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.resetModules()
  delete window.electron
})

describe('in the browser', () => {
  it('saves files as a download and cannot quit', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const platform = await import('./platform')
    expect(platform.isElectron).toBe(false)
    expect(platform.canQuit).toBe(false)
    expect(await platform.saveTextFile('save.json', '{}')).toBe(true)
    expect(click).toHaveBeenCalledOnce()
  })
})

describe('in the desktop app', () => {
  it('uses the native dialogs, fullscreen and quit from window.electron', async () => {
    const bridge = {
      isElectron: true as const,
      platform: 'linux',
      saveFile: vi.fn(async () => false),
      openFile: vi.fn(async () => ({ name: 'a.json', text: '{}' })),
      setFullscreen: vi.fn(async () => {}),
      isFullscreen: vi.fn(async () => true),
      onFullscreenChange: vi.fn(() => () => {}),
      quit: vi.fn(),
      onBeforeClose: vi.fn(),
      storage: { readAll: vi.fn(async () => ({})), write: vi.fn(), remove: vi.fn() },
      showSaveFolder: vi.fn(async () => {}),
      saveImage: vi.fn(async () => '/pictures/shot.png'),
    }
    window.electron = bridge
    const platform = await import('./platform')
    expect(platform.isElectron).toBe(true)
    expect(await platform.saveTextFile('save.json', '{"a":1}')).toBe(false) // cancelled
    expect(bridge.saveFile).toHaveBeenCalledWith({ defaultName: 'save.json', text: '{"a":1}' })
    expect(await platform.openTextFile()).toEqual({ name: 'a.json', text: '{}' })
    await platform.setFullscreen(true)
    expect(bridge.setFullscreen).toHaveBeenCalledWith(true)
    expect(await platform.isFullscreen()).toBe(true)
    expect(platform.canShowSaveFolder).toBe(true)
    await platform.showSaveFolder()
    expect(bridge.showSaveFolder).toHaveBeenCalled()
    platform.quit()
    expect(bridge.quit).toHaveBeenCalled()
  })
})
