// Reads the keys of an object literal straight from source text (no TypeScript needed). Used for ids
// that must be known without loading content: .vn suggestions and the registry's quest step ids.

/** Top-level keys of the object literal whose "{" is at `open` (strings, comments and nesting skipped). */
export function topLevelKeys(text: string, open: number): string[] {
  const keys: string[] = []
  let depth = 0
  let expectKey = false
  for (let i = open; i < text.length; i++) {
    const c = text[i] as string
    // Comments and strings.
    if (c === '/' && text[i + 1] === '/') {
      i = text.indexOf('\n', i)
      if (i < 0) break
      continue
    }
    if (c === '/' && text[i + 1] === '*') {
      i = text.indexOf('*/', i + 2) + 1
      if (i <= 0) break
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1
      while (j < text.length && text[j] !== c) j += text[j] === '\\' ? 2 : 1
      if (depth === 1 && expectKey) {
        const after = text.slice(j + 1).match(/^\s*:/)
        if (after) keys.push(text.slice(i + 1, j))
        expectKey = false
      }
      i = j
      continue
    }
    if (c === '{' || c === '[' || c === '(') {
      depth++
      if (depth === 1) expectKey = true
      continue
    }
    if (c === '}' || c === ']' || c === ')') {
      depth--
      if (depth === 0) break
      continue
    }
    if (depth !== 1) continue
    if (c === ',') {
      expectKey = true
      continue
    }
    if (expectKey && /[A-Za-z_$]/.test(c)) {
      const word = /^[A-Za-z_$][\w$]*/.exec(text.slice(i))?.[0] ?? ''
      const after = text.slice(i + word.length).match(/^\s*(:|\(|,|\})/)
      // `key: value` and shorthand `key,` count; methods `key() {}` too.
      if (after) keys.push(word)
      expectKey = false
      i += word.length - 1
      continue
    }
    if (!/\s/.test(c)) expectKey = false
  }
  return keys
}

/** Keys of the first `name: { … }` (or `name({ … })` with a call) in the text. */
export function keysOf(text: string, pattern: RegExp): string[] {
  const match = pattern.exec(text)
  if (!match) return []
  return topLevelKeys(text, match.index + match[0].length - 1)
}
