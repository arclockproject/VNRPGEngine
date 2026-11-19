// Finds the pictures an event uses, in script order, so the game can load them before they are
// needed (src/core/scene/preload.ts). Events are code, so this reads the source: imported images,
// background('<image url>'), cg / bg / inset('<id>', '<variant>') and show('<character>'). It runs on .ts events
// and on compiled .vn scripts. Anything built at runtime (a variable, a computed id) is missed;
// those pictures simply load when shown, as before.

const IMAGE_FILE = /\.(png|jpe?g|webp|avif|gif|svg)$/i
/** Videos stream when shown: they are not loaded ahead. */
const VIDEO_FILE = /\.(mp4|webm|m4v|mov|ogv)([?#].*)?$/i
const IMPORT = /^\s*import\s+([A-Za-z_$][\w$]*)\s+from\s+['"]([^'"?]+)['"]/gm
const CALL = /\b(cg|bg|inset|show|background)\(\s*(['"])([^'"]+)\2(?:\s*,\s*(['"])([^'"]+)\4)?/g

export type EventMediaItem =
  | { kind: 'image'; expr: string }
  | { kind: 'cg'; id: string; variant?: string }
  | { kind: 'bg'; id: string; variant?: string }
  | { kind: 'inset'; id: string; variant?: string }
  | { kind: 'character'; id: string }

/** The pictures `code` uses, in the order they first appear. */
export function scanEventMedia(code: string): EventMediaItem[] {
  const found: { at: number; key: string; item: EventMediaItem }[] = []
  let body = 0
  for (const m of code.matchAll(IMPORT)) {
    body = Math.max(body, (m.index ?? 0) + m[0].length)
    const [, name, source] = m
    if (!name || !source || !IMAGE_FILE.test(source)) continue
    found.push({ at: -1, key: `image:${name}`, item: { kind: 'image', expr: name } })
  }
  // An imported image counts from where it is first used.
  for (const entry of found) {
    if (entry.item.kind !== 'image') continue
    const use = new RegExp(String.raw`\b${entry.item.expr}\b`, 'g')
    use.lastIndex = body
    entry.at = use.exec(code)?.index ?? Number.MAX_SAFE_INTEGER
  }
  for (const m of code.matchAll(CALL)) {
    const [, fn, , first, , second] = m
    if (!first) continue
    const at = m.index ?? 0
    if (fn === 'cg' || fn === 'bg' || fn === 'inset') {
      const item: EventMediaItem = second
        ? { kind: fn, id: first, variant: second }
        : { kind: fn, id: first }
      found.push({ at, key: `${fn}:${first}:${second ?? ''}`, item })
    } else if (fn === 'show') {
      found.push({ at, key: `character:${first}`, item: { kind: 'character', id: first } })
    } else if (
      !VIDEO_FILE.test(first) &&
      (IMAGE_FILE.test(first) || /^(https?:|data:|blob:|\/)/.test(first))
    ) {
      found.push({ at, key: `url:${first}`, item: { kind: 'image', expr: JSON.stringify(first) } })
    }
  }
  found.sort((a, b) => a.at - b.at)
  const seen = new Set<string>()
  return found.filter(({ key }) => !seen.has(key) && seen.add(key)).map(({ item }) => item)
}

/** Code appended to an event module: `export const __media = [...]`. */
export function renderEventMedia(items: EventMediaItem[]): string {
  const parts = items.map((item) =>
    item.kind === 'image'
      ? `{ kind: 'image', url: ${item.expr} }`
      : item.kind === 'cg' || item.kind === 'bg' || item.kind === 'inset'
        ? `{ kind: '${item.kind}', id: ${JSON.stringify(item.id)}${item.variant ? `, variant: ${JSON.stringify(item.variant)}` : ''} }`
        : `{ kind: 'character', id: ${JSON.stringify(item.id)} }`,
  )
  return `\nexport const __media = [${parts.join(', ')}]\n`
}
