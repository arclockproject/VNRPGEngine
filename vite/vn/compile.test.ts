import { describe, expect, it } from 'vitest'
import { compileVn } from './compile.ts'

/** Every file needs a title: added at the end, so line numbers stay as written. */
const titled = (source: string) => `${source}\ntitle Test`

const body = (source: string) => {
  const { code, errors } = compileVn(titled(source))
  const lines = code.split('\n')
  // The scene body: after the helpers of run() (leaves, if any, has its own copy earlier).
  const start = lines.findLastIndex((l) => l.includes('void [flag')) + 1
  return {
    errors,
    lines: lines.slice(start, -3).map((l) => l.replace(/ \/\/ index\.vn:\d+$/, '').trim()),
  }
}

describe('.vn scripts', () => {
  it('tints and filters on one part', () => {
    const { lines, errors } = body(
      'show anna tint evening\nshow anna tint none\nfilter night on characters\nfilter none on anna\nfilter dream',
    )
    expect(errors).toEqual([])
    expect(lines).toEqual([
      'show("anna", { tint: "evening" })',
      'show("anna", { tint: null })',
      'filter("night", { on: "characters" })',
      'filter(null, { on: "anna" })',
      'filter("dream")',
    ])
  })

  it('show takes a named distance', () => {
    const { lines, errors } = body('show anna at left distance close flip')
    expect(errors).toEqual([])
    expect(lines).toEqual(['show("anna", { at: "left", distance: "close", flip: true })'])
  })

  it('turns lines into say/narrate/commands, skipping comments and blank lines', () => {
    const { lines, errors } = body(`
# a comment
show anna at left pose happy
anna: Hello there!
anna:sad: Oh…  "quoted"
> The wind blows.
wait 0.5
set met_anna = true
set talks += 1
give apple 2
money -5
love anna +3
event anna/flashback
bg none
cg pond_memory crying.full_moon
cg none
$ game.toast('raw code')
`)
    expect(errors).toEqual([])
    expect(lines).toEqual([
      'show("anna", { at: "left", pose: "happy" })',
      'await say("anna", "Hello there!")',
      'await say("anna:sad", "Oh…  \\"quoted\\"")',
      'await narrate("The wind blows.")',
      'await wait(500)',
      'game.flags.set("met_anna", true)',
      'game.flags.add("talks", (1))',
      'game.items.add("apple", 2, { notify: true })',
      'game.money.spend(5)',
      'game.relationships.change("anna", 3, { notify: true })',
      'await event("anna/flashback")',
      'background(null)',
      'cg("pond_memory", "crying.full_moon")',
      'cg(null)',
      "game.toast('raw code')",
    ])
  })

  it('choices with nested blocks and conditions; if / elif / else', () => {
    const { lines, errors } = body(`
choice:
  * Yes
    anna: Great!
  * Only friends get this if love('anna') >= 10 and not flag('met_anna')
    > Secret.
  * No
if flag('met_anna'):
  anna: Again?
elif money() > 5:
  anna: Rich!
else:
  anna: Hi.
`)
    expect(errors).toEqual([])
    expect(lines).toEqual([
      `switch (await choice({ c0: "Yes", c1: { label: "Only friends get this", hidden: !(love('anna') >= 10 && !flag('met_anna')) }, c2: "No" })) {`,
      "case 'c0': {",
      'await say("anna", "Great!")',
      'break',
      '}',
      "case 'c1': {",
      'await narrate("Secret.")',
      'break',
      '}',
      "case 'c2': {",
      'break',
      '}',
      '}',
      "if (flag('met_anna')) {",
      'await say("anna", "Again?")',
      '} else if (money() > 5) {',
      'await say("anna", "Rich!")',
      '} else {',
      'await say("anna", "Hi.")',
      '}',
    ])
  })

  it('dev start markers', () => {
    const { lines, errors } = body(`
@start
@start box common/arrival "Go left" yes no
@start box nope
`)
    expect(lines).toEqual([
      'devStart()',
      'devStart({"box":"common/arrival","way":["Go left",true,false]})',
    ])
    expect(errors).toHaveLength(1)
  })

  it('portrait framing', () => {
    const { lines, errors } = body(`
show anna at left frame 0.65 1
frame anna 0 0.35 ms 2500
frame anna 0 1
frame anna up 1
`)
    expect(lines).toEqual([
      'show("anna", { at: "left", frame: [0.65, 1] })',
      'await animate("anna", { frame: [0, 0.35] }, { duration: 2500 })',
      'await animate("anna", { frame: [0, 1] })',
    ])
    expect(errors).toHaveLength(1)
  })

  it('insets', () => {
    const { lines, errors } = body(`
inset sneaking red_girl
inset closeup
inset closeup ms 800
inset none
inset none ms 0
inset a b c
`)
    expect(lines).toEqual([
      'inset("sneaking", "red_girl")',
      'inset("closeup")',
      'inset("closeup", undefined, { duration: 800 })',
      'inset(null)',
      'inset(null, undefined, { duration: 0 })',
    ])
    expect(errors).toHaveLength(1)
  })

  it('movies and mask transitions', () => {
    const { lines, errors } = body(`
bg /img/room.png with wipeLeft 800
bg #000 with irisIn
cg pond_memory with pixels
cg pond_memory crying with clock 1200
movie /video/opening.mp4
`)
    expect(errors).toEqual([])
    expect(lines).toEqual([
      'background("/img/room.png", { transition: "wipeLeft", duration: 800 })',
      'background("#000", { transition: "irisIn" })',
      'cg("pond_memory", undefined, { transition: "pixels" })',
      'cg("pond_memory", "crying", { transition: "clock", duration: 1200 })',
      'await movie("/video/opening.mp4")',
    ])
  })

  it('pictures, weather, moves, full-page text and endings', () => {
    const { lines, errors } = body(`
image letter /img/letter.png x 50 y 40 width 30 layer top ms 500
image letter none
image none
weather snow 0.5
weather none
move anna hop
nvl on
nvl clear
nvl off
ending tour_complete
chapter town
`)
    expect(errors).toEqual([])
    expect(lines).toEqual([
      'await image("letter", "/img/letter.png", { x: 50, y: 40, width: 30, layer: "top", duration: 500 })',
      'await image("letter", null)',
      'await clearImages()',
      'weather("snow", { intensity: 0.5 })',
      'weather(null)',
      'await move("anna", "hop")',
      'nvl(true)',
      'clearPage()',
      'nvl(false)',
      'ending("tour_complete")',
      'await ctx.chapter("town")',
    ])
    expect(body('image letter').errors).toHaveLength(1)
    expect(body('image letter /a.png layer sideways').errors).toHaveLength(1)
    expect(body('move anna').errors).toHaveLength(1)
    expect(body('nvl maybe').errors).toHaveLength(1)
  })

  it('puts [values] into dialogue as named {holes}', () => {
    const { lines, errors } = body(`
anna: You have [count] apples and [money()] coins. [[sic]
> [count] again, and [game.party.size()] friends.
`)
    expect(errors).toEqual([])
    expect(lines).toEqual([
      'await say("anna", "You have {count} apples and {money} coins. [sic]", { count, money: money() })',
      'await narrate("{count} again, and {size} friends.", { count, size: game.party.size() })',
    ])
  })

  it('meanwhile starts a command without waiting; together: waits for all its lines', () => {
    const { lines, errors } = body(`
meanwhile fade #ffffff51 2000
meanwhile $ await animate('anna', { x: 'left' })
together:
  anna: Ehh... What?
  fade #fff 2000
  if flag('met_anna'):
    $ await shake({ strength: 6 })
`)
    expect(errors).toEqual([])
    expect(lines).toEqual([
      'void fade("#ffffff51", 2000)',
      "void animate('anna', { x: 'left' })",
      'await Promise.all([',
      '(async () => {',
      'await say("anna", "Ehh... What?")',
      '})(),',
      '(async () => {',
      'await fade("#fff", 2000)',
      '})(),',
      '(async () => {',
      "if (flag('met_anna')) {",
      'await shake({ strength: 6 })',
      '}',
      '})(),',
      '])',
    ])
  })

  it('refuses meanwhile on dialogue, and two talkers or end in together:', () => {
    const { errors } = compileVn(
      titled(
        'meanwhile anna: hi\nmeanwhile wait 1\ntogether:\n  anna: a\n  > b\n  end\ntogether:\n',
      ),
    )
    expect(errors.map((e) => e.line)).toEqual([1, 2, 5, 6, 7])
  })

  it('reports mistakes with their line numbers', () => {
    const { errors } = compileVn(
      titled('anna: ok\nwhatever this is\nshow\n  anna: indented\nelse:\nchoice:\n'),
    )
    expect(errors.map((e) => e.line)).toEqual([2, 3, 4, 5, 6])
    expect(errors[0]?.message).toContain("don't know")
  })

  it('"title <text>" names the event; it is required, once, and not indented', () => {
    const { code, errors } = compileVn('# a comment\ntitle The town sign\n> Hello')
    expect(errors).toEqual([])
    expect(code).toContain('  title: "The town sign",')
    expect(compileVn('> Hello').errors.map((e) => e.message)).toEqual([
      expect.stringContaining('add "title <text>"'),
    ])
    expect(compileVn('title A\ntitle B\n> Hello').errors.map((e) => e.line)).toEqual([2])
  })

  it('marks every generated line with its source line', () => {
    const { code } = compileVn(titled('\n\nanna: Hi'), 'hello/index.vn')
    expect(code).toContain('await say("anna", "Hi") // hello/index.vn:3')
  })
})
