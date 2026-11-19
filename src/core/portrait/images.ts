// Loads images once, remembers their pixel size (needed to place plain-file parts).
const sizes = new Map<string, { w: number; h: number }>()
const loading = new Map<string, Promise<{ w: number; h: number }>>()

export function imageSize(url: string) {
  return sizes.get(url)
}

/** Loads (and caches) an image. Resolves with its natural size; a broken image resolves as 0×0. */
export function loadImage(url: string): Promise<{ w: number; h: number }> {
  const known = sizes.get(url)
  if (known) return Promise.resolve(known)
  let promise = loading.get(url)
  if (!promise) {
    promise = new Promise((resolve) => {
      if (typeof Image === 'undefined') return resolve({ w: 0, h: 0 })
      const img = new Image()
      img.onload = () => {
        const size = { w: img.naturalWidth, h: img.naturalHeight }
        sizes.set(url, size)
        resolve(size)
      }
      img.onerror = () => {
        console.warn('[portrait] could not load', url)
        resolve({ w: 0, h: 0 })
      }
      img.src = url
    })
    loading.set(url, promise)
  }
  return promise
}
