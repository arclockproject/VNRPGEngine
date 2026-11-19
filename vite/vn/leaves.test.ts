import { describe, expect, it } from 'vitest'
import { compileVn } from './compile.ts'

/** The body of the generated `leaves.run` (null when there is none), and whether it is partial. */
function leaves(source: string) {
  const { code, errors } = compileVn(`title T\n${source}`, 'test.vn')
  expect(errors).toEqual([])
  const start = code.indexOf('  leaves: {')
  if (start === -1) return null
  const block = code.slice(start, code.indexOf('\n  run: async', start))
  const lines = block
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !/^(leaves|run|const|void|\},?$|partial)/.test(l))
  return { partial: block.includes('partial: true'), lines }
}

describe('what a .vn scene leaves behind (for flowchart jumps)', () => {
  it('collects its state lines in order, without dialogue or stage commands', () => {
    expect(
      leaves(
        [
          'bg #000',
          'anna: Hi',
          'set met_anna = true',
          'love anna +3',
          'money -5',
          'give apple 2',
          'wait 1',
        ].join('\n'),
      ),
    ).toEqual({
      partial: false,
      lines: [
        'game.flags.set("met_anna", true)',
        'game.relationships.change("anna", 3, { notify: true })',
        'game.money.spend(5)',
        'game.items.add("apple", 2, { notify: true })',
      ],
    })
  })

  it('keeps an if on the game around its lines; end stops it there', () => {
    const found = leaves(
      [
        "if flag('rich'):",
        '  money -50',
        '  end',
        'else:',
        '  set poor = true',
        'love anna +1',
      ].join('\n'),
    )
    expect(found?.partial).toBe(false)
    expect(found?.lines).toEqual([
      "if (flag('rich')) {",
      'game.money.spend(50)',
      'return',
      '} else {',
      'game.flags.set("poor", true)',
      // (closing braces are left out by this helper)
      'game.relationships.change("anna", 1, { notify: true })',
    ])
  })

  it('is partial when a choice, a scene value or code decides something', () => {
    expect(leaves('choice:\n  * A\n    love anna +1\n  * B\n    > no')?.partial).toBe(true)
    expect(leaves('$ const n = random()\nif n > 0.5:\n  set lucky = true')?.partial).toBe(true)
    expect(leaves("$ game.flags.set('x', true)")?.partial).toBe(true)
    expect(leaves('set talks += [count]')).not.toBeNull()
    expect(leaves('event anna/flashback')?.partial).toBe(true)
    // A choice with nothing that changes the game is fine.
    expect(leaves('choice:\n  * A\n    > a\n  * B\n    > b\nset x = true')?.partial).toBe(false)
  })

  it('a scene that changes nothing gets none', () => {
    expect(leaves('anna: Hello\nbg #000\n$ const x = 1')).toBeNull()
  })
})
