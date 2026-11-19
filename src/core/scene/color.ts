// Colours for the fade/flash layer: any CSS colour becomes r, g, b (0-255) and alpha (0-1),
// so the colour can be tweened number by number.

export interface Rgba {
  r: number
  g: number
  b: number
  a: number
}

const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 1 }
const warned = new Set<string>()

/** Parses '#rgb', '#rgba', '#rrggbb', '#rrggbbaa', 'rgb()', 'rgba()', 'transparent' and names. */
export function parseColor(css: string): Rgba {
  const value = css.trim().toLowerCase()
  if (value === 'transparent') return { r: 0, g: 0, b: 0, a: 0 }
  const hex = /^#([0-9a-f]{3,8})$/.exec(value)
  if (hex) return parseHex(hex[1] as string) ?? BLACK
  const fn = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(
    value,
  )
  if (fn) {
    const alpha =
      fn[4] === undefined ? 1 : fn[4].endsWith('%') ? Number.parseFloat(fn[4]) / 100 : Number(fn[4])
    return { r: Number(fn[1]), g: Number(fn[2]), b: Number(fn[3]), a: alpha }
  }
  return namedColor(css) ?? BLACK
}

function parseHex(digits: string): Rgba | null {
  if (![3, 4, 6, 8].includes(digits.length)) return null
  const full = digits.length <= 4 ? [...digits].map((c) => c + c).join('') : digits
  const n = (i: number) => Number.parseInt(full.slice(i, i + 2), 16)
  return { r: n(0), g: n(2), b: n(4), a: full.length === 8 ? n(6) / 255 : 1 }
}

/** Named colours (red, rebeccapurple…): let the browser turn them into a hex value. */
function namedColor(css: string): Rgba | null {
  if (typeof document === 'undefined') return null
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#000000'
  ctx.fillStyle = css
  const resolved = String(ctx.fillStyle)
  if (resolved === '#000000' && css.trim().toLowerCase() !== 'black') {
    if (!warned.has(css)) {
      warned.add(css)
      console.warn(`[colour] unknown colour "${css}", using black`)
    }
    return null
  }
  return parseColor(resolved)
}

/** Blends two CSS colours (t 0..1) into '#rrggbb' (alpha is dropped): clock tints, weather. */
export function mixColor(a: string, b: string, t: number): string {
  const from = parseColor(a)
  const to = parseColor(b)
  const channel = (x: number, y: number) =>
    Math.round(x + (y - x) * t)
      .toString(16)
      .padStart(2, '0')
  return `#${channel(from.r, to.r)}${channel(from.g, to.g)}${channel(from.b, to.b)}`
}
