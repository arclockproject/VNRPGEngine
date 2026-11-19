// Short messages at the top of the screen ("New quest", "Got 2 apples"). game.toast('Hello').
// Each has a kind + params (src/core/slots.ts ToastKinds) so src/content/ui/Toast.tsx can style
// quests, items, achievements… differently.
import { create } from 'zustand'
import screen from '@/content/config/screen'
import { isFastForward } from '../scene/replay'
import type { ToastInfo, ToastKindParams, ToastKinds } from '../slots'

interface ToastState {
  toasts: ToastInfo[]
}

/**
 * game.toast() options. `kind` + `params` tell src/content/ui/Toast.tsx what the toast is about;
 * leave both out for a plain 'message' (or pass `params` alone, e.g. { style: 'gold' }).
 */
export type ToastOptions = {
  /** A small picture (an item icon) or a symbol. */
  icon?: string
  /** How long it stays (default: content/config/screen.ts `toast.ms`). */
  ms?: number
} & (
  | { kind?: 'message'; params?: ToastKinds['message'] }
  | Exclude<ToastKindParams, { kind: 'message' }>
)

export const useToastStore = create<ToastState>(() => ({ toasts: [] }))

const SHOW_MS = screen.toast.ms
const MAX_SHOWN = screen.toast.max
let nextId = 1

export function toast(text: string, options: ToastOptions = {}): void {
  // A scene replaying to where it was (a loaded save, Back) already told the player all this.
  if (isFastForward()) return
  const kind = (options.kind ?? 'message') as ToastKindParams['kind']
  const item = {
    id: nextId++,
    text,
    icon: options.icon ?? null,
    kind,
    params: options.params ?? {},
  } as ToastInfo
  useToastStore.setState((s) => ({ toasts: [...s.toasts, item].slice(-MAX_SHOWN) }))
  setTimeout(() => {
    useToastStore.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== item.id) }))
  }, options.ms ?? SHOW_MS)
}
