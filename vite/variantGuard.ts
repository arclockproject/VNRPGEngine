// Variant scenes never leak (developer, 2026-11-16): a build without a content variant value must not
// contain that version's text, or the pictures, sounds and other content only it uses, even when they
// sit in public content folders (a CG in src/content/gallery/<name>). Shared ones stay: a CG another
// scene also uses ships, as it must (keeping that apart is the game dev's job).
//
// Every content source is OFF (named for a value this build lacks: events/park.adult.vn,
// events/day.adult/…, variants/adult/…, or inside a folder whose index.ts says `only:` a missing
// value) or ON (everything else). Then:
//   - ids referenced only by off sources (as a string: cg('pond'), sfx('sfx/moan'), `bg bar`…) are
//     left out: gallery, movies, endings, achievements and journal entries like `only:`; backgrounds,
//     insets and sounds become empty stand-ins (no file ships).
//   - voice clips only an off scene's lines use (its voice numbers, not the on scene's) are left out.
//   - texts found only in off sources are taken out of every language file.
// vite/variants.ts applies it; its generateBundle check fails the build if anything still got in.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { extract } from '../scripts/lang.ts'
import { CONTENT_DIR, INSETS_DIR, scanAudio, scanBackgrounds, scanContent } from './registry.ts'
import { isVariantName, onlyValue } from './variants.ts'
import { compileVn } from './vn/compile.ts'
import { vnVoiceLines } from './vn/voices.ts'

/** Content kinds whose entries the Extras / progress show: left out when only off sources use them. */
const LISTED_KINDS = ['gallery', 'movies', 'endings', 'achievements', 'codex'] as const

export interface Guard {
  /** Files that must not ship (absolute): imports of them get an empty stand-in. */
  files: Set<string>
  /** Content entry files (index.ts) to replace with an `only` stand-in, with the value they need. */
  entries: Map<string, string>
  /** Texts only off sources have: removed from language files, and must not be in the build. */
  texts: Set<string>
  /** Off source files (absolute): no module of the build may come from them. */
  offSources: Set<string>
}

const STRING = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\$]|\\.)*)`/g

/** Every string literal in code (ids are written as strings: cg('pond'), sfx('sfx/moan')). */
function literals(code: string): Set<string> {
  const out = new Set<string>()
  for (const m of code.matchAll(STRING)) {
    const value = m[1] ?? m[2] ?? m[3]
    if (value) out.add(value)
  }
  return out
}

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (/\.(ts|tsx|vn)$/.test(entry.name) && !/\.(test|gen)\.tsx?$/.test(entry.name))
      out.push(full)
  }
  return out
}

/** The value (not active in this build) a file belongs to, or null when every build has it. */
function offValue(
  file: string,
  content: string,
  all: readonly string[],
  active: readonly string[],
): string | null {
  const parts = path.relative(content, file).split(path.sep)
  for (const [i, part] of parts.entries()) {
    // variants/<value>/…: that value's own files.
    if (i === 1 && parts[0] === 'variants' && all.includes(part) && !active.includes(part))
      return part
    const name = i === parts.length - 1 ? part.replace(/\.[^.]+$/, '') : part
    if (isVariantName(name, all))
      for (const mark of name.split('.').slice(1))
        if (all.includes(mark) && !active.includes(mark)) return mark
  }
  // Inside an entry folder whose index.ts says `only:` a value this build lacks.
  let dir = path.dirname(file)
  while (dir.startsWith(content) && dir !== content) {
    for (const index of ['index.ts', 'index.tsx']) {
      const entry = path.join(dir, index)
      if (!existsSync(entry)) continue
      const only = onlyValue(readFileSync(entry, 'utf8'))
      if (only && all.includes(only) && !active.includes(only)) return only
    }
    dir = path.dirname(dir)
  }
  return null
}

/** A source's code: .vn scenes compiled to the TS they become. */
function code(file: string): string {
  const source = readFileSync(file, 'utf8')
  if (!file.endsWith('.vn') || file.includes(`${path.sep}routes${path.sep}`)) return source
  return compileVn(source).code
}

/** The event id a scene file is ("events/park.adult.vn" -> "park"), for its voice clips. */
function eventIdOf(file: string, content: string): string | null {
  const rel = path.relative(path.join(content, 'events'), file)
  if (rel.startsWith('..')) return null
  const parts = rel.split(path.sep)
  const last = parts.pop() as string
  const plain = (name: string) => name.split('.')[0] as string
  if (last === 'index.vn') return parts.map(plain).join('/')
  return [...parts.map(plain), plain(last)].join('/')
}

/** Voice clips (without language) the .vn scene's lines use: "<event>/<speaker>_<number>". */
function clipsOf(file: string, content: string, digits: number): Set<string> {
  const out = new Set<string>()
  const event = eventIdOf(file, content)
  if (!event || !file.endsWith('.vn')) return out
  for (const line of vnVoiceLines(readFileSync(file, 'utf8')))
    for (const voice of line.voices) {
      if (voice.number !== undefined)
        out.add(`${event}/${voice.speaker}_${String(voice.number).padStart(digits, '0')}`)
      else if (voice.clip) out.add(voice.clip)
    }
  return out
}

/** Media files next to `file` that are versions of it (language / variant): name.<x>.<ext>. */
function versionsOf(file: string): string[] {
  const dir = path.dirname(file)
  const stem = path.basename(file).split('.')[0] as string
  if (!existsSync(dir)) return [file]
  return readdirSync(dir)
    .filter((name) => name === path.basename(file) || name.startsWith(`${stem}.`))
    .filter((name) => !/\.(ts|tsx|vn|aseprite|ase)$/.test(name))
    .map((name) => path.join(dir, name))
}

export function computeGuard(
  root: string,
  all: readonly string[],
  active: readonly string[],
): Guard {
  const content = path.join(root, CONTENT_DIR)
  const guard: Guard = {
    files: new Set(),
    entries: new Map(),
    texts: new Set(),
    offSources: new Set(),
  }
  if (all.every((value) => active.includes(value))) return guard
  const digits = Number(
    /\bvoice\s*:\s*\{[\s\S]*?\bdigits\s*:\s*(\d+)/.exec(
      existsSync(path.join(content, 'scenes.ts'))
        ? readFileSync(path.join(content, 'scenes.ts'), 'utf8')
        : '',
    )?.[1] ?? 4,
  )

  // Every source once: what it references, its text, its voice clips, and whether it is off.
  interface Source {
    file: string
    value: string | null
    refs: Set<string>
    texts: string[]
    clips: Set<string>
  }
  const sources: Source[] = []
  for (const file of walk(content)) {
    if (file.startsWith(path.join(content, 'lang') + path.sep)) continue
    let source: string
    try {
      source = code(file)
    } catch {
      continue
    }
    sources.push({
      file,
      value: offValue(file, content, all, active),
      refs: literals(source),
      texts: extract(source),
      clips: clipsOf(file, content, digits),
    })
  }

  let on = { refs: new Set<string>(), texts: new Set<string>(), clips: new Set<string>() }
  let off = {
    refs: new Map<string, string>(),
    texts: new Map<string, string>(),
    clips: new Map<string, string>(),
  }
  const tally = () => {
    on = { refs: new Set(), texts: new Set(), clips: new Set() }
    off = { refs: new Map(), texts: new Map(), clips: new Map() }
    for (const src of sources) {
      if (src.value) {
        guard.offSources.add(src.file)
        for (const r of src.refs) off.refs.set(r, src.value)
        for (const t of src.texts) off.texts.set(t, src.value)
        for (const c of src.clips) off.clips.set(c, src.value)
      } else {
        for (const r of src.refs) on.refs.add(r)
        for (const t of src.texts) on.texts.add(t)
        for (const c of src.clips) on.clips.add(c)
      }
    }
  }
  const offOnly = (id: string) => off.refs.has(id) && !on.refs.has(id)
  const scan = scanContent(root, () => {})

  // Content left out because only off sources use it is off itself (its title, its own
  // references): repeat until nothing more goes (a CG only an off scene shows, an ending only
  // that CG's folder names…).
  for (let round = 0; round < 5; round++) {
    tally()
    let more = false
    // Gallery pictures, movies, endings, achievements, journal entries: like `only: '<value>'`.
    for (const kind of LISTED_KINDS)
      for (const id of scan[kind] ?? []) {
        if (!offOnly(id)) continue
        for (const index of ['index.ts', 'index.tsx']) {
          const entry = path.join(content, kind, id, index)
          if (existsSync(entry)) guard.entries.set(entry, off.refs.get(id) as string)
        }
      }
    // Backgrounds and insets: files (and their language / variant versions) or folders.
    for (const folder of ['backgrounds', INSETS_DIR])
      for (const bg of scanBackgrounds(root, () => {}, [], folder)) {
        if (!offOnly(bg.id)) continue
        if (bg.file)
          for (const f of versionsOf(path.join(content, folder, bg.file))) guard.files.add(f)
        else {
          const entry = path.join(content, folder, bg.id, 'index.ts')
          if (existsSync(entry)) guard.entries.set(entry, off.refs.get(bg.id) as string)
        }
      }
    for (const [entry, value] of guard.entries) {
      const dir = path.dirname(entry) + path.sep
      for (const src of sources)
        if (!src.value && src.file.startsWith(dir)) {
          src.value = value
          more = true
        }
    }
    if (!more) break
  }
  // Sounds (also voice clips by name) and voice clips an off scene's lines use.
  for (const sound of scanAudio(root, () => {})) {
    const clip = sound.id.startsWith('voice/') ? sound.id.split('/').slice(2).join('/') : null
    // A clip an off .vn line uses (its voice number), or one an off .ts scene names in full
    // ({ voice: 'park/anna_0012' }), and nothing on uses.
    const offClip =
      clip !== null &&
      (off.clips.has(clip) || off.refs.has(clip)) &&
      !on.clips.has(clip) &&
      !on.refs.has(clip)
    if (!offOnly(sound.id) && !offClip) continue
    const audio = path.join(content, 'audio')
    const files = [
      sound.file,
      ...(sound.langs ?? []).map((l) => l.file),
      ...(sound.voiceLangs ?? []).map((l) => l.file),
    ]
    for (const f of files) for (const v of versionsOf(path.join(audio, f))) guard.files.add(v)
  }
  for (const [text] of off.texts) if (!on.texts.has(text)) guard.texts.add(text)
  return guard
}

/**
 * A language file without the entries whose key is one of `keys` ("'Text': 'Translation'," and
 * multi-line or { one, other } values). Comments and everything else stay as they are.
 */
export function withoutEntries(source: string, keys: ReadonlySet<string>): string {
  if (keys.size === 0) return source
  let out = source
  for (const key of keys) {
    const quoted = [`'${key.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`, JSON.stringify(key)]
    if (/^[A-Za-z_$][\w$]*$/.test(key)) quoted.push(key)
    for (const literal of quoted) {
      let at = out.indexOf(literal)
      while (at !== -1) {
        // Only as a key: at the start of its line, followed by a colon.
        const lineStart = out.lastIndexOf('\n', at - 1) + 1
        const before = out.slice(lineStart, at)
        let i = at + literal.length
        while (out[i] === ' ') i++
        if (before.trim() !== '' || out[i] !== ':') {
          at = out.indexOf(literal, at + literal.length)
          continue
        }
        i++
        // The value: strings, brackets, up to the comma that ends the entry.
        let depth = 0
        for (; i < out.length; i++) {
          const c = out[i] as string
          if (c === "'" || c === '"' || c === '`') {
            i++
            while (i < out.length && out[i] !== c) i += out[i] === '\\' ? 2 : 1
            continue
          }
          if (c === '{' || c === '[' || c === '(') depth++
          else if (c === '}' || c === ']' || c === ')') {
            if (depth === 0) break
            depth--
          } else if (c === ',' && depth === 0) {
            i++
            break
          }
        }
        const lineEnd = out.indexOf('\n', i)
        const end = lineEnd === -1 || out.slice(i, lineEnd).trim() !== '' ? i : lineEnd + 1
        out = out.slice(0, lineStart) + out.slice(end)
        at = out.indexOf(literal, lineStart)
      }
    }
  }
  return out
}
