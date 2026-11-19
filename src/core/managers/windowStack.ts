import type { WindowId } from '../registry'
import type { OpenWindow } from '../stores/system'

/** Opens a window on top. If it is already open, it moves to the front with the new params. */
export function bringToFront(stack: OpenWindow[], id: WindowId, params: unknown) {
  const index = stack.findIndex((w) => w.id === id)
  if (index !== -1) stack.splice(index, 1)
  stack.push({ id, params })
}

export function removeWindow(stack: OpenWindow[], id: WindowId) {
  const index = stack.findIndex((w) => w.id === id)
  if (index !== -1) stack.splice(index, 1)
}

/** Moves an open window to the front without changing its params. */
export function focusWindow(stack: OpenWindow[], id: WindowId) {
  const index = stack.findIndex((w) => w.id === id)
  if (index === -1 || index === stack.length - 1) return
  const [entry] = stack.splice(index, 1)
  if (entry) stack.push(entry)
}
