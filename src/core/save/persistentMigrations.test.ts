import { describe, expect, it } from 'vitest'
import { migratePersistent, PERSISTENT_VERSION } from './persistentMigrations'

describe('persistent migrations', () => {
  it('starts at version 1 without migration files', () => {
    expect(PERSISTENT_VERSION).toBe(1)
    expect(migratePersistent({ read: { a: true } }, 1)).toEqual({ read: { a: true } })
  })

  it('runs each step in order and refuses newer data', () => {
    const steps = {
      2: (d: Record<string, unknown>) => ({ ...d, seen: d.read }),
      3: (d: Record<string, unknown>) => {
        const { read: _old, ...rest } = d
        return rest
      },
    }
    expect(migratePersistent({ read: { a: true } }, 1, steps, 3)).toEqual({ seen: { a: true } })
    expect(() => migratePersistent({}, 4, steps, 3)).toThrow(/newer/)
    expect(() => migratePersistent({}, 1, { 3: steps[3] }, 3)).toThrow(/v2\.ts/)
  })
})
