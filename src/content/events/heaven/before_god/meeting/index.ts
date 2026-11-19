import { defineEvent } from '@/core/define'
import { t, tx } from '@/core/lang'

export default defineEvent({
  title: 'Meeting God',
  run: async (g) => {
    await g.say('hero', 'Hello?')
    await g.narrate('Who is this person?')
    await g.animate('god', { opacity: 0 })
    g.show('god')
    g.camera({ focus: 'god' }, { ease: 'cubicInOut', duration: 1000 })

    // const god = g.game.maps.npc('god')
    void g.game.maps.camera.follow('god') // the camera goes with him
    await g.animate('god', { opacity: 1 }, { duration: 1000, ease: 'cubicIn' })
    await g.say('god', 'Hello. I am God.') // Ye...
    g.rename('god', 'God')
    await g.say('god', 'Want to play a {wave}Game{/wave}?')
    const pick = await g.choice(
      {
        sure: 'Sure?',
        no: 'Maybe no?',
        what: 'What?',
      },
      { timeout: 3000, default: 'what' },
    )
    async function endCutScene() {
      g.startShake(3)
      await g.say('hero', 'Ehh... What?')
      g.startShake(6)
      await Promise.all([g.say('hero', 'Ehh... What?'), g.fade('#ffffff51', 2000)])
      await g.fade('#ffffff', 2000)
    }
    if (pick === 'no') {
      await g.say('god', 'Oh? Thou wills to defy thy? ')
      await g.say('god', "Fret nought, as thy shalln't harm thou.")
      await g.say('god', 'Onwards one goes...')
      await endCutScene()
      g.game.maps.go('countryside/forest')
    }
    if (pick === 'what') {
      await g.say('god', 'Hmm. Thous confusion is understandable.')
      await g.say('god', 'Here have this.')
      g.game.items.add('lucky_charm', 1)
      await g.say('hero', 'What is this?')
      await g.say('god', 'Have a safe journey.')
      await endCutScene()
      g.game.maps.go('countryside/town')
    }
    if (pick === 'sure') {
      await g.say('god', 'Thy shall witness thous skills first hand.')
      await g.fade('#000000', 2000)
      const result = await g.game.minigames.start('dodge', { seconds: 20 })
      g.fade(null, 1000)

      await g.narrate(
        t(
          result.won
            ? tx(`You survived! {score} blocks dodged.`)
            : tx(`Game over. {score} blocks dodged.`),
          { score: result.score },
        ),
      )
      if (result.won) {
        await g.say('god', 'Guess you can have this as a reward.')
        g.game.items.add('lucky_charm', 1)
        await g.say('god', 'Farewell, thy {b}chosen{/b} one.')
      } else {
        await g.say('god', 'Guess you are nothing more then this. Farewell...')
      }
      await endCutScene()
      g.game.maps.go('countryside/town')
    }
  },
})
