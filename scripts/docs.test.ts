// The guide's generated files (pnpm guide) must match the pages.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildDocsAssets, CODE_FILE, SEARCH_FILE } from './docs.ts'

describe('engine guide', () => {
  it('generated files are up to date (run `pnpm guide`)', async () => {
    const { search, code } = await buildDocsAssets()
    expect(readFileSync(SEARCH_FILE, 'utf8') === search, 'search-index.gen.js is stale').toBe(true)
    expect(readFileSync(CODE_FILE, 'utf8') === code, 'code.gen.js is stale').toBe(true)
  }, 30000)
})
