import { defineEvent } from '@/core/define'

export default defineEvent({
  title: 'Arrival',
  run: async (g) => {
    g.background('#000')
    await g.narrate('...')
    await Promise.all([g.say('hero', 'Ugh...'), g.fade('#3f3f3f', 2000)])
    await Promise.all([g.say('hero', 'What is this?'), g.fade('#a2a2a2', 2000)])
    await Promise.all([g.say('hero', 'Agh! My head hurts'), g.fade('#ffffff', 2000)])
    await g.say('god', '...')
    g.background(null)
    g.fade(null, 1000)
    await g.say('hero', 'Wait... Where am I?')
    await g.say('god', 'Welcome...')
    await g.narrate('Who are you?')
  },
})
