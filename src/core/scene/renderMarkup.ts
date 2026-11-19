// Draws parsed markup into an element: one hidden span per character (the typewriter shows them).
import type { MarkupChar } from './markup'

const STYLE_ID = 'vn-markup-styles'

function ensureStyles() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
@keyframes vnWave { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-0.25em) } }
@keyframes vnShake {
  0% { transform: translate(0, 0) } 25% { transform: translate(1px, -1px) }
  50% { transform: translate(-1px, 1px) } 75% { transform: translate(1px, 1px) } 100% { transform: translate(0, 0) }
}`
  document.head.appendChild(style)
}

const SIZES: Record<string, string> = { small: '0.85em', large: '1.3em', huge: '1.7em' }

/** Chinese, Japanese and Korean letters: a line may break between any two of them. */
const CJK = /[　-ヿ㐀-䶿一-鿿가-힯豈-﫿＀-￯]/u

/** The reading text (<rt>) shown together with the last letter of its ruby run. */
const readings = new WeakMap<HTMLElement, HTMLElement>()

/** Shows one character (and the reading above its ruby run, once the run is complete). */
export function revealChar(span: HTMLElement): void {
  span.style.visibility = ''
  const reading = readings.get(span)
  if (reading) reading.style.visibility = ''
}

export interface RenderOptions {
  /** No moving letters: {wave} and {shake} stay still ("Reduce shaking and flashes"). */
  still?: boolean
}

/** Replaces the element's content; returns the character spans (all hidden). */
export function renderMarkup(
  el: HTMLElement,
  chars: readonly MarkupChar[],
  options: RenderOptions = {},
): HTMLSpanElement[] {
  ensureStyles()
  const nodes: Node[] = []
  /** A word of moving letters: kept on one line (each letter is its own box, which could break). */
  let word: HTMLSpanElement | null = null
  let ruby: { group: number; el: HTMLElement; last: HTMLSpanElement | null } | null = null
  const closeRuby = () => {
    if (!ruby) return
    const reading = document.createElement('rt')
    reading.textContent = ruby.el.dataset.reading ?? ''
    reading.style.visibility = 'hidden'
    reading.style.userSelect = 'none'
    ruby.el.appendChild(reading)
    if (ruby.last) readings.set(ruby.last, reading)
    ruby = null
  }
  const spans = chars.map((c, i) => {
    const span = document.createElement('span')
    span.textContent = c.char
    span.style.visibility = 'hidden'
    const { style } = c
    if (style.bold) span.style.fontWeight = '700'
    if (style.italic) span.style.fontStyle = 'italic'
    if (style.color) span.style.color = style.color
    if (style.size) span.style.fontSize = SIZES[style.size] ?? `${Number(style.size) || 1}em`
    const moving = (style.wave || style.shake) && !options.still
    if (moving) {
      // Transforms need inline-block; keep spaces as wide as normal ones.
      span.style.display = 'inline-block'
      if (c.char === ' ') span.style.whiteSpace = 'pre'
      span.style.animation = style.wave
        ? `vnWave 1.1s ease-in-out ${-i * 0.08}s infinite`
        : `vnShake 0.25s linear ${-Math.random() * 0.25}s infinite`
    }

    if (style.ruby !== undefined && style.rubyGroup !== undefined) {
      word = null
      if (ruby?.group !== style.rubyGroup) {
        closeRuby()
        const rubyEl = document.createElement('ruby')
        rubyEl.dataset.reading = style.ruby
        nodes.push(rubyEl)
        ruby = { group: style.rubyGroup, el: rubyEl, last: null }
      }
      ruby.el.appendChild(span)
      ruby.last = span
      return span
    }
    closeRuby()

    if (moving && !/\s/.test(c.char) && !CJK.test(c.char)) {
      if (!word) {
        word = document.createElement('span')
        word.style.display = 'inline-block'
        word.style.whiteSpace = 'nowrap'
        nodes.push(word)
      }
      word.appendChild(span)
    } else {
      word = null
      nodes.push(span)
    }
    return span
  })
  closeRuby()
  el.replaceChildren(...nodes)
  return spans
}
