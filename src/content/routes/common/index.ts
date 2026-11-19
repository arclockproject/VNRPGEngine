// The common route: where a new game starts in visual novel mode (src/content/config/mode.ts vnOnly).
// Edit freely: this is game content. Docs: docs/story/routes.html.
// Every `await event(...)` is one box of the flowchart; its second argument names the box.
// Branch with choice() (the player picks), flag() or check(): each answer is its own way on the
// flowchart, and saves and flowchart jumps take the same way again.
import { defineRoute } from '@/core/define'

export default defineRoute({
  title: 'Common',
  description: 'Arriving in town.',
  run: async ({ event, choice, flag, startRoute, chapter, ending }) => {
    // A chapter (src/content/chapters.ts) begins: a line on the flowchart, every box after it below.
    chapter('vn_arrival')
    await event('vn_demo/arrival', 'arrival')
    // effects: what picking an option does by itself. It runs on the pick, and again (quietly)
    // when a flowchart jump passes this choice with that pick: no `sets` needed for it.
    const wave = await choice(
      { wave: 'Wave back', ignore: "Pretend you didn't see her" },
      { effects: { wave: (game) => game.relationships.change('anna', 1, { notify: true }) } },
    )
    // This box sets the flag vn_met_anna (events can set flags; the route reads them below).
    if (wave === 'wave') await event('vn_demo/waved', 'waved')

    await event('vn_demo/the_choice', 'the_choice')
    const trust = await choice(
      { trust: 'I trust you', not_yet: 'Not yet', but_i_know: 'I know who you are...' },
      {
        who: 'jack',
        text: 'Well?',
        // Hidden options: shown only when their condition is met. requiresEnding = every ending in
        // the list (src/content/endings/<id>) was reached, in any playthrough; requiredFlag = that
        // flag is on. When only one option is left, it plays by itself (no question): keep one
        // option always shown.
        hidden: {
          but_i_know: { requiresEnding: ['anna'] },
          // but_i_know: { requiredFlag: 'vn_met_anna' },
        },
      },
    )
    // Two ways that join again below.
    if (trust === 'trust') await event('vn_demo/jack_story', 'jack_story')
    // Any event works as a box: this one is also run from inside other events, and unlocks its CG.
    else if (trust === 'but_i_know') await event('anna/flashback')
    else await event('vn_demo/jack_lies', 'jack_lies')

    // Only if you waved at Anna (a flag); otherwise the line goes straight past it. Chapter 1.2
    // starts on both ways (one line on the flowchart): before Anna's scene, or before the bus.
    if (flag('vn_met_anna')) {
      chapter('vn_evening')
      await event('vn_demo/anna_greeting', 'anna_greeting')
    }

    chapter('vn_evening')
    await event('vn_demo/leaving', 'leaving')
    // Each route has its own flowchart page.
    const stay = await choice({ stay: 'Stay in town', go: 'Take the bus', run: 'Run away' })
    if (stay === 'stay') return startRoute('anna')
    // A short way like this could also be written right here: its events, then `return ending('bad_end')`.
    else if (stay === 'go') return startRoute('bad_end')
    // The story ends here with an ending (src/content/endings/normal): reached for good and listed
    // in Extras → Endings. A route can have several endings, one per way. A route may also just
    // end (no return): back to the title, without an ending.
    return ending('normal')
  },
})
