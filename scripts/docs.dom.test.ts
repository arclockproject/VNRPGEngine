// Every code block must find its coloured version the way the browser reads it, and every link
// between pages must point to a page that exists (and to a section on it, for page.html#section).

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { Window } from 'happy-dom'
import { describe, expect, it } from 'vitest'
import { CODE_FILE, codeKey, pageIds, pages } from './docs.ts'

describe('engine guide pages', () => {
  it('every code block gets its colours, and every page link points to a page and section', () => {
    const generated = readFileSync(CODE_FILE, 'utf8')
    const coloured = JSON.parse(generated.slice(generated.indexOf('{'))) as Record<string, string>
    const all = pages()
    const ids = new Map(all.map((p) => [p.file, pageIds(p.html)]))
    const parser = new new Window().DOMParser()
    for (const { file, html } of all) {
      const doc = parser.parseFromString(html, 'text/html')
      for (const code of doc.querySelectorAll('pre > code')) {
        const text = code.textContent ?? ''
        expect(coloured[codeKey(text)], `${file}: ${text.slice(0, 60)}`).toBeDefined()
      }
      for (const a of doc.querySelectorAll('a[href]')) {
        const href = a.getAttribute('href') ?? ''
        if (/^[a-z]+:/.test(href)) continue
        const [target = '', hash] = href.split('#')
        // Links are relative to the page's own folder (story/events/stage.html -> ../vn.html).
        const page = target
          ? path.posix.normalize(path.posix.join(path.posix.dirname(file), target))
          : file
        expect(ids.has(page), `${file} links to ${href}`).toBe(true)
        if (hash)
          expect(ids.get(page)?.has(hash), `${file} links to ${href} (no #${hash})`).toBe(true)
      }
    }
  })
})
