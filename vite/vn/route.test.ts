import { describe, expect, it } from 'vitest'
import { compileRouteVn, routeCondition } from './route.ts'

const body = (code: string) =>
  code
    .split('\n')
    .filter((l) => /^\s{4,}\S/.test(l) && !l.includes('void ['))
    .map((l) => l.replace(/ \/\/ .*$/, '').trimEnd())

describe('compileRouteVn', () => {
  it('after story [ending x]… makes the route an after story', () => {
    const { code, errors } = compileRouteVn(
      'title T\nafter story [ending anna] [ending normal]\nevent a/b',
      'routes/x/index.vn',
    )
    expect(errors).toEqual([])
    expect(code).toContain('  afterStory: { requiresEnding: ["anna", "normal"] },')
    const open = compileRouteVn('title T\nafter story\nevent a/b', 'routes/x/index.vn')
    expect(open.code).toContain('  afterStory: { requiresEnding: [] },')
    expect(compileRouteVn('title T\nafter stories', 'routes/x/index.vn').errors).toHaveLength(1)
    expect(
      compileRouteVn('title T\nafter story\nafter story', 'routes/x/index.vn').errors,
    ).toHaveLength(1)
    expect(compileRouteVn('title T', 'routes/x/index.vn').code).not.toContain('afterStory')
  })

  it('hidden options ([ending x] / [flag y]) and ending <id>', () => {
    const { code, errors } = compileRouteVn(
      [
        'title T',
        'choice jack: Well?',
        '  * Yes',
        '    event a/b as b',
        '  * I know who you are [ending anna] [ending normal] [flag met]',
        '    ending good',
      ].join('\n'),
      'routes/x/index.vn',
    )
    expect(errors).toEqual([])
    expect(body(code)).toEqual([
      '    switch (await choice({ "Yes": "Yes", "I know who you are": "I know who you are" }, { text: "Well?", who: "jack", hidden: { "I know who you are": { requiresEnding: ["anna", "normal"], requiredFlag: "met" } } })) {',
      '      case "Yes": {',
      '        await event("a/b", "b")',
      '        break',
      '      }',
      '      case "I know who you are": {',
      '        return ending("good")',
      '      }',
      '    }',
    ])
    expect(compileRouteVn('title T\nend now', 'routes/x/index.vn').errors).toHaveLength(1)
    expect(compileRouteVn('title T\nend route', 'routes/x/index.vn').errors).toHaveLength(1)
    expect(compileRouteVn('title T\nending', 'routes/x/index.vn').errors).toHaveLength(1)
  })

  it('chapter <id> starts a chapter (and a bad id is a mistake)', () => {
    const { code, errors } = compileRouteVn(
      ['title T', 'chapter vn_evening', 'event a/b as b'].join('\n'),
      'routes/x/index.vn',
    )
    expect(errors).toEqual([])
    expect(body(code)).toEqual(['    chapter("vn_evening")', '    await event("a/b", "b")'])
    expect(code).toContain('startRoute, ending, movie, chapter }')
    expect(compileRouteVn('title T\nchapter Bad-id', 'routes/x/index.vn').errors).toHaveLength(1)
  })

  it("compiles the owner's example shape: branches that join, a skip, two routes", () => {
    const { code, errors } = compileRouteVn(
      [
        '# The common route',
        'title Common route',
        'description Arriving in town.',
        'event meeting/special as special',
        "if flag('agreed'):",
        '  event jack/tells as tells',
        'else:',
        '  event jack/lies as lies',
        "if flag('met_anna'):",
        '  event anna/greeting as greeting',
        'event town/leaving as leaving',
        "if flag('agreed') and not flag('met_anna'):",
        '  event jack/again as again',
        '  route anna',
        "elif check('rich', game.money.get() > 100):",
        '  movie credits',
        '  end',
        'route bad_end',
      ].join('\n'),
      'routes/common/index.vn',
    )
    expect(errors).toEqual([])
    expect(code).toContain('title: "Common route",')
    expect(code).toContain('description: "Arriving in town.",')
    expect(body(code)).toEqual([
      '    await event("meeting/special", "special")',
      '    if (flag("agreed")) {',
      '      await event("jack/tells", "tells")',
      '    } else {',
      '      await event("jack/lies", "lies")',
      '    }',
      '    if (flag("met_anna")) {',
      '      await event("anna/greeting", "greeting")',
      '    }',
      '    await event("town/leaving", "leaving")',
      '    if (flag("agreed") && !flag("met_anna")) {',
      '      await event("jack/again", "again")',
      '      return startRoute("anna")',
      '    } else if (check("rich", (game) => game.money.get() > 100)) {',
      '      await movie("credits")',
      '      return',
      '    }',
      '    return startRoute("bad_end")',
    ])
  })

  it('reports mistakes with their line', () => {
    const { errors } = compileRouteVn(
      [
        'title X',
        'event a/b as',
        'if money() > 5:',
        '  event a/c as c',
        'route anna',
        'event a/d as d',
        'say hello',
      ].join('\n'),
    )
    expect(errors.map((e) => [e.line, e.message.split(':')[0]])).toEqual([
      [2, 'use'],
      [3, `a route can only branch on flag('id') or check('label', condition), not "money() > 5"`],
      [4, 'this line is indented, but no block (if / elif / else / choice) starts above it'],
      [6, 'nothing can come after `route` or `end` in the same block'],
      [7, 'unknown line "say hello"'],
    ])
  })

  it('a box without "as" is named after the event (by the runner)', () => {
    const { code, errors } = compileRouteVn('title X\nevent common/day1_morning')
    expect(errors).toEqual([])
    expect(code).toContain('await event("common/day1_morning")')
  })

  it("effect lines right under an option become the choice's effects", () => {
    const { code, errors } = compileRouteVn(
      [
        'title X',
        'choice:',
        '  * Wave back',
        '    love anna +1',
        '    set waved = true',
        '    event a/waved',
        '  * Ignore her',
        '    event a/ignored',
      ].join('\n'),
    )
    expect(errors).toEqual([])
    expect(code).toContain(
      'effects: { "Wave back": (game) => { game.relationships.change("anna", 1, { notify: true }); game.flags.set("waved", true) } }',
    )
    expect(code).toContain('await event("a/waved")')
  })

  it('effect lines anywhere else are mistakes', () => {
    const messages = (source: string) =>
      compileRouteVn(`title X\n${source}`).errors.map((e) => `${e.line}: ${e.message}`)
    expect(messages('love anna +1')[0]).toMatch(/^2: "love" changes the game/)
    expect(messages('choice:\n  * A\n    event a/b\n    love anna +1\n  * B')[0]).toMatch(
      /^5: put "love" before/,
    )
    expect(messages('choice:\n  * A\n    love anna\n  * B')[0]).toMatch(/^4: use: love/)
  })

  it('needs a title', () => {
    expect(compileRouteVn('event a/b as b').errors[0]?.message).toMatch(/title/)
  })

  it('imports a picture for the route box', () => {
    const { code } = compileRouteVn('title A\nimage ./art.png\nevent a/b as b')
    expect(code).toContain('import image from "./art.png"')
    expect(code).toContain('  image,')
  })
})

describe('routeCondition', () => {
  it('allows only flag() and check() atoms', () => {
    expect(routeCondition("not (flag('a') or flag('b'))")).toEqual({
      code: '!(flag("a") || flag("b"))',
    })
    expect(routeCondition("check('x', has('apple') and money() > 2)")).toEqual({
      code: 'check("x", (game) => has(\'apple\') && money() > 2)',
    })
    expect('error' in routeCondition('seen("x")')).toBe(true)
  })
})

describe('checkRouteVn', () => {
  it('reports unknown events, routes and flags', async () => {
    const { checkRouteVn } = await import('./route.ts')
    const ids = { events: ['a/b'], routes: ['anna'], flags: ['met'] } as never
    const problems = checkRouteVn(
      "title X\nevent a/b as b\nevent a/x as x\nif flag('met') or flag('nope'):\n  route bob\n",
      ids,
    )
    expect(problems.map((p) => [p.line, p.message])).toEqual([
      [3, 'no event "a/x"'],
      [4, 'no flag "nope" (src/content/flags.ts)'],
      [5, 'no route "bob"'],
    ])
  })
})

describe('completeRouteVn', () => {
  it('suggests commands, events, routes and flags', async () => {
    const { completeRouteVn } = await import('./route.ts')
    const ids = { events: ['a/b', 'a/c'], routes: ['anna'], flags: ['met'] } as never
    const labels = (line: string) =>
      completeRouteVn(line, line.length, ids).items.map((i) => i.label)
    expect(labels('ev')).toContain('event')
    expect(labels('event a/')).toEqual(['a/b', 'a/c'])
    expect(labels('event a/b ')).toEqual(['as'])
    expect(labels('  route ')).toEqual(['anna'])
    expect(labels("if flag('m")).toEqual(['met'])
  })
})

describe('choices in a route script', () => {
  it('compiles a choice block: options are their own keys, route / end skip the break', () => {
    const { code, errors } = compileRouteVn(
      [
        'title X',
        'event a/ask as ask',
        'choice jack: Well?',
        '  * I trust you',
        '    event a/story as story',
        '  * Not yet',
        '  * Leave',
        '    route bad_end',
        'event a/end as end',
      ].join('\n'),
    )
    expect(errors).toEqual([])
    expect(body(code)).toEqual([
      '    await event("a/ask", "ask")',
      '    switch (await choice({ "I trust you": "I trust you", "Not yet": "Not yet", "Leave": "Leave" }, { text: "Well?", who: "jack" })) {',
      '      case "I trust you": {',
      '        await event("a/story", "story")',
      '        break',
      '      }',
      '      case "Not yet": {',
      '        break',
      '      }',
      '      case "Leave": {',
      '        return startRoute("bad_end")',
      '      }',
      '    }',
      '    await event("a/end", "end")',
    ])
  })

  it('refuses options outside a choice and other lines inside one', () => {
    const { errors } = compileRouteVn('title X\n* Lost\nchoice:\n  event a/b as b\n  * Ok\n  * Ok')
    expect(errors.map((e) => e.line)).toEqual([2, 4, 6])
  })
})
