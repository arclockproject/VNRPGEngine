// Tells a picture (an import, a URL, data:/blob:) from plain text such as a symbol ('💾', '⚠').
// For settings that take either, e.g. a toast `icon`.

const IMAGE = /^(data:image\/|blob:|https?:\/\/|\.{0,2}\/)|\.(png|jpe?g|webp|gif|svg|avif)(\?.*)?$/i

/** True for a picture (imported file, URL, data:/blob:); false for text like '💾'. */
export function isImageSource(value: string): boolean {
  return IMAGE.test(value)
}
