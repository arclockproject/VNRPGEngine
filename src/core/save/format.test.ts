import { describe, expect, it } from 'vitest'
import type { Migration, SaveFile } from './define'
import { migrateSave, parseSave, SAVE_FORMAT, SaveError } from './format'

const engine = { map: null, playtimeMs: 0 }
const save = (version: number, data: object): SaveFile<unknown> => ({
  format: SAVE_FORMAT,
  version,
  savedAt: '2026-01-01T00:00:00.000Z',
  engine,
  data,
})

// The example from CLAUDE.md: v2 had hp and hunger; v3 renamed hp to health and removed hunger;
// v4 added hunger back with a default value.
const migrations: Record<number, Migration> = {
  3: ({ engine, data }) => {
    const { hp, hunger: _removed, ...stats } = data.stats
    return { engine, data: { ...data, stats: { ...stats, health: hp } } }
  },
  4: ({ engine, data }) => ({ engine, data: { ...data, stats: { ...data.stats, hunger: 0 } } }),
}

describe('migrateSave', () => {
  it('upgrades step by step (v2 → v3 → v4)', () => {
    const old = save(2, { stats: { hp: 42, hunger: 7 } })
    const result = migrateSave(old, 4, migrations)
    expect(result.version).toBe(4)
    expect(result.data).toEqual({ stats: { health: 42, hunger: 0 } })
    // The original is untouched.
    expect(old.data).toEqual({ stats: { hp: 42, hunger: 7 } })
  })

  it('leaves current saves as they are', () => {
    const current = save(4, { stats: { health: 1, hunger: 2 } })
    expect(migrateSave(current, 4, migrations)).toEqual(current)
  })

  it('refuses saves from a newer game version', () => {
    expect(() => migrateSave(save(5, {}), 4, migrations)).toThrow(SaveError)
    expect(() => migrateSave(save(5, {}), 4, migrations)).toThrow('newer version')
  })

  it('reports a missing migration', () => {
    expect(() => migrateSave(save(1, {}), 4, migrations)).toThrow('v2.ts')
  })

  it('wraps a crashing migration', () => {
    const broken: Record<number, Migration> = {
      2: () => {
        throw new Error('boom')
      },
    }
    const error = (() => {
      try {
        migrateSave(save(1, {}), 2, broken)
      } catch (e) {
        return e as SaveError
      }
    })()
    expect(error?.code).toBe('migration-failed')
    expect(error?.message).toContain('boom')
  })
})

describe('parseSave', () => {
  it('accepts a valid save', () => {
    expect(parseSave(JSON.stringify(save(1, { a: 1 }))).data).toEqual({ a: 1 })
  })

  it.each([
    ['not json', '{oops'],
    ['wrong format', JSON.stringify({ ...save(1, {}), format: 'other-game' })],
    ['bad version', JSON.stringify({ ...save(1, {}), version: 0 })],
    ['no data', JSON.stringify({ ...save(1, {}), data: null })],
  ])('rejects %s', (_label, text) => {
    expect(() => parseSave(text)).toThrow(SaveError)
  })
})

describe('gameVersion', () => {
  it('names the game version in the "newer save" message', () => {
    const newer = { ...save(9, {}), gameVersion: '2.1.0' }
    expect(() => migrateSave(newer, 4, migrations)).toThrow('newer version of the game (2.1.0)')
  })

  it('is optional (older saves have none) but must be a string', () => {
    expect(parseSave(JSON.stringify(save(1, {}))).gameVersion).toBeUndefined()
    expect(parseSave(JSON.stringify({ ...save(1, {}), gameVersion: '1.0.0' })).gameVersion).toBe(
      '1.0.0',
    )
    expect(() => parseSave(JSON.stringify({ ...save(1, {}), gameVersion: 3 }))).toThrow(SaveError)
  })

  it('is kept through migrations', () => {
    const old = { ...save(2, { stats: { hp: 1, hunger: 1 } }), gameVersion: '0.9.0' }
    expect(migrateSave(old, 4, migrations).gameVersion).toBe('0.9.0')
  })
})
