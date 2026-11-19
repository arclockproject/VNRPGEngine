// pnpm lang          -> per language in src/content/lang: missing and unused strings
// pnpm lang --write  -> also adds the missing ones to each language file (empty, to fill in)
// pnpm lang --assets -> which pictures, videos, sounds and Aseprite files have a version per
//                       language (not by default: most files need none). See scripts/langAssets.ts.
//
// Finds the game's text in src/content: t('…'), tx('…'), say(who, '…'), narrate('…'), choice/menu
// labels, input('…') questions, quest steps and name/title/label/description/replay/category/text/
// hiddenText/placeholder fields; in src/core only t('…') / tx('…').
// Text built with ${…} can't be found: use t('Hello {name}', { name }) for those.
// Missing strings simply show in the source language.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { compileVn } from '../vite/vn/compile.ts'
import { compileRouteVn } from '../vite/vn/route.ts'
import { reportAssets } from './langAssets.ts'

const ROOT = path.resolve(import.meta.dirname, '..')
const CONTENT = path.join(ROOT, 'src/content')
const CORE = path.join(ROOT, 'src/core')
const LANG_DIR = path.join(CONTENT, 'lang')
/** Key and button names (A, LB, Esc…): not text to translate, though they are `label` fields. */
const GLYPHS = path.join(CONTENT, 'look', 'glyphs.ts')

const STR = String.raw`'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|\x60(?:[^\x60\\$]|\\.)*\x60`

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return full === LANG_DIR ? [] : files(full)
    // .vn dialogue scripts count too (read through their compiler, see contentCode).
    return /\.(ts|tsx|vn)$/.test(entry.name) && !/\.(test|gen)\.tsx?$/.test(entry.name)
      ? [full]
      : []
  })
}

/** A content file's code; .vn scripts are compiled to the TS they become. */
function contentCode(file: string): string {
  const source = readFileSync(file, 'utf8')
  if (!file.endsWith('.vn')) return source
  // Route scripts (src/content/routes) have their own compiler.
  const route = /[\\/]src[\\/]content[\\/]routes[\\/]/.test(file)
  return route ? compileRouteVn(source).code : compileVn(source).code
}

/** The value of a string literal from source. */
export function unquote(literal: string): string {
  const body = literal.slice(1, -1)
  return body.replace(/\\(.)/g, (_, c: string) => (c === 'n' ? '\n' : c === 't' ? '\t' : c))
}

/** From `open` (index of a bracket) to its matching close bracket, skipping strings. */
function balanced(text: string, open: number): string {
  const pairs: Record<string, string> = { '(': ')', '{': '}', '[': ']' }
  const stack: string[] = []
  for (let i = open; i < text.length; i++) {
    const c = text[i] as string
    if (c === "'" || c === '"' || c === '`') {
      const end = text.indexOf(c, i + 1)
      let j = i + 1
      while (j < text.length && text[j] !== c) j += text[j] === '\\' ? 2 : 1
      i = end === -1 ? text.length : j
      continue
    }
    if (pairs[c]) stack.push(pairs[c])
    else if (c === stack[stack.length - 1]) {
      stack.pop()
      if (stack.length === 0) return text.slice(open, i + 1)
    }
  }
  return text.slice(open)
}

/** Drops comment lines (doc examples like t('Hello {name}') are not game text). */
const withoutComments = (source: string) =>
  source
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
    .join('\n')

/** Engine code: only explicit t('…') / tx('…') (and t(a ? '…' : '…')). */
export function extractCalls(code: string): string[] {
  const source = withoutComments(code)
  const found: string[] = []
  for (const m of source.matchAll(new RegExp(String.raw`\bt[x]?\(\s*(${STR})`, 'g'))) {
    if (m[1] && unquote(m[1]).trim()) found.push(unquote(m[1]))
  }
  const ternary = String.raw`\bt\(\s*[^()]*?\?\s*(${STR})\s*:\s*(${STR})\s*\)`
  for (const m of source.matchAll(new RegExp(ternary, 'g'))) {
    for (const lit of [m[1], m[2]]) if (lit && unquote(lit).trim()) found.push(unquote(lit))
  }
  return found
}

export function extract(code: string): string[] {
  const source = withoutComments(code)
  const found: string[] = []
  const add = (literal: string | undefined) => {
    if (!literal) return
    const text = unquote(literal)
    if (text.trim()) found.push(text)
  }
  found.push(...extractCalls(source))
  const simple = [
    String.raw`\bsay\(\s*[^,()]+,\s*(${STR})`,
    String.raw`\bnarrate\(\s*(${STR})`,
    String.raw`\bbark\(\s*(${STR})`,
    // input('Your name?', { placeholder: '…' }): the question an event asks.
    String.raw`(?<![.\w])input\(\s*(${STR})`,
    String.raw`\b(?:name|title|label|description|as|disabled|replay|category|text|hiddenText|placeholder)\s*:\s*(${STR})`,
  ]
  for (const pattern of simple) {
    for (const match of source.matchAll(new RegExp(pattern, 'g'))) add(match[1])
  }
  // choice({...}) / choice([...]) / menu({...}) and quest steps: every string value inside.
  for (const match of source.matchAll(/\b(?:choice|menu)\(\s*([{[])/g)) {
    const inner = balanced(source, (match.index ?? 0) + match[0].length - 1)
    const values =
      match[1] === '[' ? new RegExp(`(${STR})`, 'g') : new RegExp(String.raw`:\s*(${STR})`, 'g')
    for (const v of inner.matchAll(values)) add(v[1])
  }
  for (const match of source.matchAll(/\bsteps\s*:\s*\{/g)) {
    const inner = balanced(source, (match.index ?? 0) + match[0].length - 1)
    for (const v of inner.matchAll(new RegExp(String.raw`:\s*(${STR})`, 'g'))) add(v[1])
  }
  return found
}

/** Keys already in a language file (strings: { 'source': 'translation', Bare: '…', … }). */
export function translatedKeys(source: string): Set<string> {
  const keys = new Set<string>()
  const start = source.search(/\bstrings\s*:\s*\{/)
  if (start === -1) return keys
  const block = balanced(source, source.indexOf('{', start))
  // Walk the object: a key comes first in each entry (after "{" or ","), strings are skipped whole.
  let expectKey = true
  for (let i = 1; i < block.length - 1; i++) {
    const c = block[i] as string
    if (c === '/' && block[i + 1] === '/') {
      i = block.indexOf('\n', i)
      if (i === -1) break
      continue
    }
    if (/\s/.test(c)) continue
    if (c === ',') {
      expectKey = true
      continue
    }
    // A value with plural forms ({ one: '…', other: '…' }): its inner keys are not game text.
    if (c === '{' || c === '[') {
      i += balanced(block, i).length - 1
      expectKey = false
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1
      while (j < block.length && block[j] !== c) j += block[j] === '\\' ? 2 : 1
      if (expectKey) keys.add(unquote(block.slice(i, j + 1)))
      expectKey = false
      i = j
      continue
    }
    if (expectKey && /[A-Za-z_$]/.test(c)) {
      const ident = /^[A-Za-z_$][\w$]*/.exec(block.slice(i))?.[0] ?? ''
      keys.add(ident)
      i += ident.length - 1
    }
    expectKey = false
  }
  return keys
}

/** Keys of a language file whose translation is still the empty string. */
export function emptyKeys(source: string): string[] {
  const entry = new RegExp(String.raw`^\s+(${STR}|[A-Za-z_$][\w$]*):\s*(?:''|"")\s*,`, 'gm')
  return [...source.matchAll(entry)].map((match) => {
    const key = match[1] as string
    return /^['"`]/.test(key) ? unquote(key) : key
  })
}

function main() {
  if (process.argv.includes('--assets')) return reportAssets(ROOT)
  const write = process.argv.includes('--write')
  const all = new Set<string>()
  for (const file of files(CONTENT)) {
    if (file === GLYPHS) continue
    for (const text of extract(contentCode(file))) all.add(text)
  }
  for (const file of files(CORE))
    for (const text of extractCalls(readFileSync(file, 'utf8'))) all.add(text)

  const langs = existsSync(LANG_DIR)
    ? readdirSync(LANG_DIR, { withFileTypes: true }).filter((e) => e.isDirectory())
    : []
  if (langs.length === 0) {
    console.log(
      `[lang] ${all.size} strings found. No languages yet: add src/content/lang/<code>/index.ts`,
    )
    return
  }
  for (const entry of langs) {
    const file = path.join(LANG_DIR, entry.name, 'index.ts')
    if (!existsSync(file)) continue
    const source = readFileSync(file, 'utf8')
    const have = translatedKeys(source)
    const missing = [...all].filter((text) => !have.has(text))
    const unused = [...have].filter((text) => !all.has(text))
    // An entry left as '' shows untranslated in the game: it does not count as translated.
    const empty = emptyKeys(source).filter((text) => all.has(text))
    console.log(
      `[lang] ${entry.name}: ${all.size - missing.length - empty.length}/${all.size} translated`,
    )
    for (const text of unused)
      console.log(`  unused (maybe text that changed): ${JSON.stringify(text)}`)
    for (const text of empty) console.log(`  empty (fill it in): ${JSON.stringify(text)}`)
    if (missing.length === 0) continue
    if (!write) {
      for (const text of missing) console.log(`  missing: ${JSON.stringify(text)}`)
      continue
    }
    const start = source.search(/\bstrings\s*:\s*\{/)
    const open = source.indexOf('{', start)
    const block = balanced(source, open)
    const close = open + block.length - 1
    const lines = missing.map((text) => `    ${JSON.stringify(text)}: '',`).join('\n')
    const before = source.slice(0, close).replace(/\s*$/, '')
    const updated = `${before}\n    // Added by pnpm lang --write: fill these in (empty = shown untranslated).\n${lines}\n  ${source.slice(close)}`
    writeFileSync(file, updated)
    console.log(`  added ${missing.length} empty entries to ${path.relative(ROOT, file)}`)
  }
}

if (process.argv[1] && import.meta.filename === path.resolve(process.argv[1])) main()
