import type { ParamArgs } from '../define'
import { loadWindow, type WindowId, type WindowParams } from '../registry'
import { useSystemStore } from '../stores/system'
import { bringToFront, focusWindow, removeWindow } from './windowStack'

const set = useSystemStore.setState

export const windows = {
  /** Opens a window on top, or moves it to the front if it is already open. */
  open<K extends WindowId>(id: K, ...[params]: ParamArgs<WindowParams<K>>): void {
    void loadWindow(id) // start loading now so it appears quickly
    set((s) => {
      bringToFront(s.windows, id, params)
    })
  },

  /** Moves an open window to the front. Does nothing if it is not open. */
  focus(id: WindowId): void {
    if (windows.top() === id) return
    set((s) => {
      focusWindow(s.windows, id)
    })
  },

  close(id: WindowId): void {
    set((s) => {
      removeWindow(s.windows, id)
    })
  },

  /** Closes the window if it is open, otherwise opens it. */
  toggle<K extends WindowId>(id: K, ...args: ParamArgs<WindowParams<K>>): void {
    if (windows.isOpen(id)) windows.close(id)
    else windows.open(id, ...args)
  },

  closeAll(): void {
    set((s) => {
      s.windows = []
    })
  },

  isOpen(id: WindowId): boolean {
    return useSystemStore.getState().windows.some((w) => w.id === id)
  },

  /** The front-most window, if any. */
  top(): WindowId | undefined {
    return useSystemStore.getState().windows.at(-1)?.id
  },
}
