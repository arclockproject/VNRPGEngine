// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { clearPacks, planPacks, writePacks } from './asset-packs.ts'

const limits = { base: 100, pack: 50, total: 1000 }
const file = (p: string, bytes: number) => ({ path: p, bytes })

describe('planPacks', () => {
  it('makes no packs when everything fits the base', () => {
    expect(planPacks([file('a.webp', 60), file('index.js', 40)], limits)).toEqual([])
  })

  it('moves every media file out, biggest first, filling packs', () => {
    const packs = planPacks(
      [
        file('index.js', 10),
        file('a.webp', 40),
        file('b.ogg', 30),
        file('c.png', 20),
        file('d.wav', 15),
      ],
      limits,
    )
    expect(packs.map((p) => p.map((f) => f.path))).toEqual([
      ['a.webp'],
      ['b.ogg', 'c.png'],
      ['d.wav'],
    ])
  })

  it('refuses games over the total limit, or a file bigger than a pack', () => {
    expect(() => planPacks([file('a.webp', 2000)], limits)).toThrow(/at most/)
    expect(() => planPacks([file('a.webp', 60), file('b.webp', 60)], limits)).toThrow(/bigger than/)
  })
})

describe('writePacks', () => {
  it('moves files into pack modules at the same path, and clears them again', () => {
    const android = mkdtempSync(path.join(tmpdir(), 'packs-'))
    const web = path.join(android, 'app/src/main/assets/public/assets')
    mkdirSync(web, { recursive: true })
    writeFileSync(path.join(web, 'cg.webp'), 'x')
    writePacks(android, [[file('assets/cg.webp', 1)]])
    expect(existsSync(path.join(web, 'cg.webp'))).toBe(false)
    expect(
      existsSync(path.join(android, 'asset_pack_1/src/main/assets/public/assets/cg.webp')),
    ).toBe(true)
    expect(readFileSync(path.join(android, 'asset_pack_1/build.gradle'), 'utf8')).toContain(
      'install-time',
    )
    expect(readFileSync(path.join(android, 'asset-packs.txt'), 'utf8')).toBe('asset_pack_1\n')
    clearPacks(android)
    expect(existsSync(path.join(android, 'asset_pack_1'))).toBe(false)
    expect(existsSync(path.join(android, 'asset-packs.txt'))).toBe(false)
  })
})
