// One place for things that went wrong while the game runs: a crashed layer, an event script that
// threw, a promise nobody caught. Always logged; shown as a toast when content/config/screen.ts says so
// (in dev the toast carries the real message).
import screen from '@/content/config/screen'
import { t } from './lang'
import { toast } from './ui/toast'

export interface GameError {
  /** Where it happened, e.g. 'event "town/sign"'. */
  where: string
  message: string
  at: number
}

const recent: GameError[] = []
const KEEP = 20
let lastToast = 0

/** Logs an error and (if switched on) tells the player with a toast. Never throws. */
export function reportError(where: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[${where}]`, error)
  recent.push({ where, message, at: Date.now() })
  if (recent.length > KEEP) recent.shift()
  const config = screen.errors
  const now = Date.now()
  // A broken frame loop can throw 60 times a second: one toast per `toastEveryMs`.
  if (now - lastToast < config.toastEveryMs) return
  if (import.meta.env.DEV) {
    lastToast = now
    toast(`${where}: ${message}`, {
      ms: config.toastMs,
      kind: 'error',
      params: { where, message },
    })
  } else if (config.tellPlayer) {
    lastToast = now
    toast(t('Something went wrong. The game will try to carry on.'), {
      ms: config.toastMs,
      kind: 'error',
      params: { where, message },
    })
  }
}

/** The last few errors (newest last): for the dev panel and bug reports. */
export function recentErrors(): readonly GameError[] {
  return recent
}

let started = false

/** Catches errors nothing else caught (called once from boot.tsx). */
export function startErrorWatch(): void {
  if (started || typeof window === 'undefined') return
  started = true
  window.addEventListener('error', (e) => {
    // Failed <img>/<audio> loads also fire 'error' on window in the capture phase only; this
    // listener is not capturing, so it only sees script errors.
    reportError('game', e.error ?? e.message)
  })
  window.addEventListener('unhandledrejection', (e) => {
    reportError('game', e.reason)
  })
}

/** Tests: forget everything. */
export function resetErrors(): void {
  recent.length = 0
  lastToast = 0
}
