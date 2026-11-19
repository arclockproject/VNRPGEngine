// What a background() value is: a colour, a CSS gradient, a picture or a video. Pure (no DOM).

export type BackgroundKind = 'colour' | 'gradient' | 'image' | 'video'

const GRADIENT = /^(repeating-)?(linear|radial|conic)-gradient\(/
const VIDEO = /^data:video\/|\.(mp4|webm|m4v|mov|ogv)([?#].*)?$/i
const IMAGE_FILE = /\.(png|jpe?g|webp|gif|svg|avif)([?#].*)?$/i
const URL_LIKE = /^(data:|blob:|https?:|app:|\/|\.\.?\/)/

export function backgroundKind(value: string): BackgroundKind {
  if (GRADIENT.test(value)) return 'gradient'
  if (VIDEO.test(value)) return 'video'
  if (URL_LIKE.test(value) || IMAGE_FILE.test(value)) return 'image'
  return 'colour'
}

/**
 * background() accepts colours (any CSS colour, including transparent ones like
 * 'rgba(0,0,0,0.5)', '#00000080' or 'transparent'), CSS gradients, image URLs and videos. This is
 * the CSS for the first three. (Videos and layered CGs are drawn as elements.)
 */
export function backgroundStyle(value: string) {
  const kind = backgroundKind(value)
  if (kind === 'gradient') return { backgroundImage: value }
  if (kind === 'image') {
    return {
      backgroundImage: `url("${value}")`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
  }
  if (kind === 'video') return {}
  return { backgroundColor: value }
}
