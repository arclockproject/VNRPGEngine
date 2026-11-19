// Media lock service worker (web and Android; Electron unlocks in its main process instead).
// Built by vite/protect.ts into build/web/media-lock.js, with the key and the file endings put in.
// Every same-origin request for a locked file ending is fetched, decrypted and answered with the
// plain bytes. Range requests (video, long audio) fetch and decrypt only the part asked for.
// Files without the lock header pass through unchanged.
import {
  blockStart,
  decryptAt,
  extensionOf,
  HEADER_BYTES,
  importKey,
  isLocked,
  ivOf,
  mimeOf,
  parseRange,
} from './format'

declare const __LOCK_KEY__: string
declare const __LOCK_EXTENSIONS__: string[]

interface FetchEventLike extends Event {
  request: Request
  respondWith(response: Promise<Response>): void
}
interface ExtendableEventLike extends Event {
  waitUntil(promise: Promise<unknown>): void
}
const worker = self as unknown as {
  location: Location
  skipWaiting(): Promise<void>
  clients: { claim(): Promise<void> }
  addEventListener(type: string, listener: (event: never) => void): void
}

const key = importKey(__LOCK_KEY__)
const extensions = new Set(__LOCK_EXTENSIONS__)

/** The IV and plain size of a locked file (null = not locked), per URL, for Range requests. */
const heads = new Map<string, Promise<{ iv: Uint8Array; size: number } | null>>()

function headOf(url: string): Promise<{ iv: Uint8Array; size: number } | null> {
  let head = heads.get(url)
  if (!head) {
    head = (async () => {
      const response = await fetch(url, { headers: { Range: `bytes=0-${HEADER_BYTES - 1}` } })
      if (!response.ok) throw new Error(`${response.status}`)
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (!isLocked(bytes)) return null
      // 206: the total is in Content-Range. 200 (the server ignored Range): the whole file came.
      const total =
        response.status === 206
          ? Number(response.headers.get('content-range')?.split('/')[1])
          : bytes.length
      return { iv: ivOf(bytes), size: total - HEADER_BYTES }
    })()
    heads.set(url, head)
    head.catch(() => heads.delete(url))
  }
  return head
}

async function serveWhole(request: Request, path: string): Promise<Response> {
  const response = await fetch(request.url, { credentials: 'same-origin' })
  if (!response.ok) return response
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (!isLocked(bytes)) {
    return new Response(bytes, { status: response.status, headers: response.headers })
  }
  const plain = await decryptAt(await key, ivOf(bytes), bytes.subarray(HEADER_BYTES), 0)
  return new Response(plain, {
    headers: { 'Content-Type': mimeOf(path), 'Content-Length': String(plain.length) },
  })
}

async function serveRange(request: Request, path: string, range: string): Promise<Response> {
  const head = await headOf(request.url)
  if (!head) return fetch(request)
  const part = parseRange(range, head.size)
  if (part === 'bad') {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${head.size}` } })
  }
  const aligned = blockStart(part.start)
  const from = HEADER_BYTES + aligned
  const to = HEADER_BYTES + part.end
  const response = await fetch(request.url, { headers: { Range: `bytes=${from}-${to}` } })
  if (!response.ok) return response
  let data = new Uint8Array(await response.arrayBuffer())
  // A server that ignores Range sends the whole file.
  if (response.status === 200) data = data.subarray(from, to + 1)
  const plain = (await decryptAt(await key, head.iv, data, aligned)).subarray(part.start - aligned)
  return new Response(plain, {
    status: 206,
    headers: {
      'Content-Type': mimeOf(path),
      'Content-Length': String(plain.length),
      'Content-Range': `bytes ${part.start}-${part.end}/${head.size}`,
      'Accept-Ranges': 'bytes',
    },
  })
}

worker.addEventListener('install', () => {
  void worker.skipWaiting()
})
worker.addEventListener('activate', (event: ExtendableEventLike) => {
  event.waitUntil(worker.clients.claim())
})
// The page asks this after a hard reload, which starts it without the worker in control.
worker.addEventListener('message', (event: MessageEvent) => {
  if (event.data === 'claim') void worker.clients.claim()
})
worker.addEventListener('fetch', (event: FetchEventLike) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== worker.location.origin) return
  if (!extensions.has(extensionOf(url.pathname))) return
  const range = request.headers.get('range')
  event.respondWith(
    (range ? serveRange(request, url.pathname, range) : serveWhole(request, url.pathname)).catch(
      (error: unknown) => {
        console.error('[media lock]', url.pathname, error)
        return fetch(request)
      },
    ),
  )
})
