// The .vn editor extension's colouring (tools/vscode-vn/syntaxes/vn.tmLanguage.json): every word of
// every .vn file in src/content, and a line of each kind the compilers know (vite/vn/compile.ts,
// vite/vn/route.ts), must get a colour of its own (a scope beyond the file's own source.vn).
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { createHighlighter } from 'shiki'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(import.meta.dirname, '..')
const GRAMMAR = JSON.parse(
  readFileSync(path.join(ROOT, 'tools/vscode-vn/syntaxes/vn.tmLanguage.json'), 'utf8'),
)

/** One line of each kind (events, then routes). */
const SAMPLES = `title The town sign
# a comment
> Narration with {i}markup{/i} and [name] code.
>(italic) Narration with options.
anna: Hello there.
anna:happy: With a pose.
anna(voice 3, shake, style thought, color #ff0000): With options.
"Student A": A name in quotes.
jack & anna: Together.
$ game.flags.set('x', true)
meanwhile $ console.log('x')
choice:
  * Dig it up
  * Only sometimes if flag('met_anna') and not has('apple')
if flag('read_sign'):
elif money() > 5:
else:
together:
show anna at left pose happy distance close frame 0.65 1 flip
hide anna
bg town/bus_stop evening with wipeLeft 800
bg #203040
bg none
cg pond_memory crying with clock 1200
inset sneaking red_girl ms 800
inset none
movie /video/opening.mp4
image letter /img/letter.png x 50 y 40 width 30 opacity 0.5 scale 2 rotate 8 layer top ms 500
image letter none
weather rain 0.5
frame anna 0 0.35 ms 2500
move anna hop
nvl on
nvl clear
ending anna
chapter vn_arrival
filter sepia
fade #000 500
wait 1.5
music music/town
ambient ambient/forest
sfx sfx/door
event town/showcase
set read_sign = true
set coins += 5
give apple 2
take apple
money +5
rename anna "Anna"
reveal anna
love anna +5
xp hero 10
join hero
achievement first_steps
codex anna
quest start find_cat
quest step find_cat look
quest done find_cat
window inventory
shop general
battle slimes
meanwhile show anna
return
end
@start
@start box common/jack_story "I trust you" yes no
description Anna, one year after you stayed.
color #7fb3ff
image ./card.svg
after story [ending anna] [ending driver]
event vn_demo/arrival as arrival
choice: Which way?
choice jack: Well?
  * I know who you are [ending anna] [flag met_anna]
route anna
else
`

function vnFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return vnFiles(full)
    return entry.name.endsWith('.vn') ? [full] : []
  })
}

describe('.vn colouring (editor extension)', () => {
  it('colours every word of the content scripts and of every kind of line', async () => {
    const highlighter = await createHighlighter({
      themes: ['dark-plus'],
      langs: ['typescript', { ...GRAMMAR, name: 'vn', embeddedLangs: ['typescript'] }],
    })
    const sources = [
      { file: 'samples', code: SAMPLES },
      ...vnFiles(path.join(ROOT, 'src/content')).map((file) => ({
        file: path.relative(ROOT, file),
        code: readFileSync(file, 'utf8'),
      })),
    ]
    const plain: string[] = []
    for (const { file, code } of sources) {
      const lines = highlighter.codeToTokensBase(code, {
        lang: 'vn' as 'typescript', // our own grammar, loaded above (not one shiki bundles)
        theme: 'dark-plus',
        includeExplanation: true,
      })
      lines.forEach((tokens, i) => {
        for (const token of tokens) {
          if (!token.content.trim()) continue
          // Only the file's own scope = nothing recognised this word.
          const coloured = token.explanation?.some((part) =>
            part.scopes.some((scope) => scope.scopeName !== 'source.vn'),
          )
          if (!coloured) plain.push(`${file}:${i + 1}: "${token.content.trim()}"`)
        }
      })
    }
    highlighter.dispose()
    expect(plain).toEqual([])
  }, 30000)
})
