// Media lock, page side: on the web and Android, the built game's media is unlocked by a service
// worker (sw.ts). It must control the page before anything loads, so src/main.tsx waits for this.
// Electron unlocks in its main process (electron/main.ts), dev servers lock nothing.

/** Whether this build has locked media (set by vite/protect.ts; missing in dev and tests). */
declare const __MEDIA_LOCK__: boolean | undefined

const WORKER = './media-lock.js'
/** Never block the start for longer than this (the game then shows what it can). */
const WAIT_MS = 4000

export async function startMediaLock(): Promise<void> {
  if (typeof __MEDIA_LOCK__ === 'undefined' || !__MEDIA_LOCK__) return
  if (window.electron) return
  const workers = navigator.serviceWorker
  if (!workers) {
    console.error('[media lock] this browser has no service workers: pictures and sounds will fail')
    return
  }
  try {
    const registration = await workers.register(WORKER, { updateViaCache: 'none' })
    await workers.ready
    if (workers.controller) return
    // First start, or a hard reload (which bypasses the worker): ask it to take the page over.
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, WAIT_MS)
      workers.addEventListener(
        'controllerchange',
        () => {
          clearTimeout(timer)
          resolve()
        },
        { once: true },
      )
      ;(registration.active ?? registration.waiting ?? registration.installing)?.postMessage(
        'claim',
      )
    })
    if (!workers.controller) console.error('[media lock] the worker did not take over the page')
  } catch (error) {
    console.error('[media lock]', error)
  }
}
