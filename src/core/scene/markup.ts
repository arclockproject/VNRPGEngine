import scenes from '@/content/scenes'
// Inline text markup for dialogue lines (pure: no DOM).
//   {b}bold{/b}  {i}italic{/i}  {color=#e53935}red{/color}  {size=large}big{/size}
//   {shake}scared{/shake}  {wave}hello{/wave}  {w=0.5} = pause half a second while typing
//   {ruby=とうきょう}東京{/ruby} = small reading text above the letters (furigana)
//   {/} closes the latest tag, {{ = a literal "{". Unknown tags are dropped.

export interface CharStyle {
  bold?: boolean
  italic?: boolean
  color?: string
  /** 'small' | 'large' or a multiplier like '1.4'. */
  size?: string
  shake?: boolean
  wave?: boolean
  /** Small text shown above this run of letters ({ruby=…}). */
  ruby?: string
  /** Tells two ruby runs next to each other apart. */
  rubyGroup?: number
}

export interface MarkupChar {
  char: string
  style: CharStyle
  /** Pause this many ms before typing this character ({w=…} right before it). */
  pauseBefore: number
}

export interface ParsedText {
  chars: MarkupChar[]
  /** Plain text without tags (log, screen readers). */
  plain: string
  /** Pause after the last character ({w=…} at the very end). */
  pauseAfter: number
  /** Tags that were not understood (shown as warnings in dev builds). */
  unknown: string[]
}

type TagName = 'b' | 'i' | 'color' | 'size' | 'shake' | 'wave' | 'ruby'
const TAGS: readonly TagName[] = ['b', 'i', 'color', 'size', 'shake', 'wave', 'ruby']
let rubyGroups = 0

function apply(style: CharStyle, tag: TagName, value: string | undefined): CharStyle {
  switch (tag) {
    case 'b':
      return { ...style, bold: true }
    case 'i':
      return { ...style, italic: true }
    case 'color':
      return value ? { ...style, color: value } : style
    case 'size':
      return value ? { ...style, size: value } : style
    case 'shake':
      return { ...style, shake: true }
    case 'wave':
      return { ...style, wave: true }
    case 'ruby':
      return value ? { ...style, ruby: value, rubyGroup: ++rubyGroups } : style
  }
}

/** Pause added after a sentence end (. ! ? and the full-width 。！？) when autoPause is on. */
export const AUTO_PAUSE_MS = scenes.text.autoPauseMs

const SENTENCE_END = new Set(['.', '!', '?', '。', '！', '？'])
const FULL_WIDTH_END = new Set(['。', '！', '？'])
const CLOSERS = new Set(['"', "'", '”', '\u2019', '»', ')', ']'])

/** Is the punctuation at `at` the last of its run and followed by a space, a closing quote or the end? */
function endsSentence(text: string, at: number): boolean {
  const char = text[at] as string
  if (FULL_WIDTH_END.has(char)) return true
  let j = at + 1
  if (SENTENCE_END.has(text[j] ?? '')) return false // "..." pauses once, after the last dot
  for (;;) {
    if (CLOSERS.has(text[j] ?? '')) j++
    else if (text[j] === '{' && text[j + 1] !== '{' && text.indexOf('}', j) !== -1)
      j = text.indexOf('}', j) + 1
    else break
  }
  return j >= text.length || /\s/.test(text[j] as string)
}

export function parseMarkup(text: string, options: { autoPause?: boolean } = {}): ParsedText {
  const chars: MarkupChar[] = []
  const unknown: string[] = []
  // Open tags (innermost last) with the style that was active before each one.
  const stack: { tag: TagName; before: CharStyle }[] = []
  let style: CharStyle = {}
  let pause = 0
  let i = 0
  while (i < text.length) {
    const c = text[i] as string
    if (c === '{' && text[i + 1] === '{') {
      chars.push({ char: '{', style, pauseBefore: pause })
      pause = 0
      i += 2
      continue
    }
    if (c === '{') {
      const end = text.indexOf('}', i)
      if (end === -1) {
        chars.push({ char: c, style, pauseBefore: pause })
        pause = 0
        i++
        continue
      }
      const body = text.slice(i + 1, end).trim()
      i = end + 1
      const [rawName = '', value] = body.split('=', 2) as [string, string | undefined]
      const name = rawName.trim()
      if (name === 'w') {
        pause += Math.max(0, Number(value ?? 0.5) * 1000) || 0
      } else if (name === '/') {
        style = stack.pop()?.before ?? {}
      } else if (name.startsWith('/')) {
        // Close the innermost tag of that name (and anything opened inside it).
        const at = stack.map((s) => s.tag as string).lastIndexOf(name.slice(1))
        if (at === -1) unknown.push(body)
        else {
          style = stack[at]?.before ?? {}
          stack.length = at
        }
      } else if ((TAGS as readonly string[]).includes(name)) {
        stack.push({ tag: name as TagName, before: style })
        // A ruby reading may hold an "=" itself: everything after the first one is the value.
        const full = body.includes('=') ? body.slice(body.indexOf('=') + 1) : value
        style = apply(style, name as TagName, full?.trim())
      } else {
        unknown.push(body)
      }
      continue
    }
    // Keep surrogate pairs (emoji) together.
    const cp = text.codePointAt(i) ?? 0
    const char = String.fromCodePoint(cp)
    chars.push({ char, style, pauseBefore: pause })
    pause = 0
    if (options.autoPause && SENTENCE_END.has(char) && endsSentence(text, i)) {
      pause += AUTO_PAUSE_MS
    }
    i += char.length
  }
  return { chars, plain: chars.map((c) => c.char).join(''), pauseAfter: pause, unknown }
}

/** Text without markup (for the log). */
export const stripMarkup = (text: string) => parseMarkup(text).plain
