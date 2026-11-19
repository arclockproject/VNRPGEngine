import { defineEvent } from '@/core/define'
import { tx } from '@/core/lang'

export default defineEvent({
  title: 'Talking to Anna',
  run: async ({ say, choice, show, hide, event, game, wait, animate, shake }) => {
    // Saved story flag: the long introduction only plays the first time (survives save/load).
    const metBefore = game.flags.get('met_anna')
    game.flags.add('times_talked_to_anna')
    // Her map sprite waves (not awaited: the scene goes on while she waves).
    void game.maps.npc('anna').play('wave')
    if (metBefore) {
      show('anna', { at: 'center' })
      // Relationship points change how she greets you.
      if (game.relationships.get('anna') >= 10)
        await say('anna:happy', 'Hey, friend! {wave}Good to see you!{/wave}')
      else await say('anna', "Oh, it's you again!")
    } else {
      // Walk in from the edge of the screen. Not awaited: she moves while the line types.
      show('anna', { at: 'farright' })
      void animate('anna', { x: 'right' }, { duration: 700, ease: 'cubicOut' })
      // A voice clip for this line: audio/voice/<language>/anna/hello/anna_0001.* (lines without
      // a voice number use Anna's typing blip instead).
      await say('anna', "Oh! Hi there. I haven't seen you around town before.", { voice: 1 })

      show('anna', { pose: 'surprised' })
      // A little hop (up and back down) and a short screen shake, at the same time.
      void animate('anna', { y: -40 }, { duration: 140, ease: 'quadOut', yoyo: true, repeat: 1 })
      void shake({ strength: 6, duration: 250 })
      await say('anna', 'Wait… you look just like someone I used to know!', { shake: true })

      // Runs another event right here, in the same scene, then carries on.
      await event('anna/flashback')
      game.flags.set('met_anna', true)
      game.codex.unlock('anna') // a journal entry about her
    }

    show('anna', { pose: 'neutral', at: 'center' })
    await say('anna', 'Sorry, never mind. What can I do for you?')

    const pick = await choice({
      play: 'Want to play a round?',
      shop: 'Do you sell anything?',
      // Only offered on later visits (hidden the first time).
      past: { label: 'That person you used to know…', hidden: !metBefore },
      // Only once she likes you enough (relationship points); greyed out with a reason before that.
      join: {
        label: 'Want to come along?',
        hidden: !metBefore || game.party.has('anna'),
        disabled:
          game.relationships.get('anna') < 10 && tx("She doesn't know you well enough yet."),
      },
      bye: 'I have to go.',
    })

    if (pick === 'play') {
      const result = await game.minigames.start('rock_paper_scissors')
      // Playing with her makes Anna like you more (a little more if she wins).
      game.relationships.change('anna', result === 'win' ? 3 : 5, { notify: true })
      if (result === 'win') {
        game.achievements.unlock('first_win')
        show('anna', { pose: 'surprised' })
        await say('anna', 'You won?! Fine, have some coins for that.', { size: 'large' })
        game.money.add(10, { notify: true })
      } else {
        show('anna', { pose: 'happy' })
        await say('anna', 'Ha! Just like old times.')
      }
    } else if (pick === 'join') {
      show('anna', { pose: 'happy' })
      await say('anna', 'An adventure? {b}Yes!{/b} Let me grab my things.')
      game.party.add('anna', { level: 2, notify: true })
    } else if (pick === 'past') {
      await say(
        'anna:sad',
        'We played by the pond every evening.{w=0.6} Then {i}they{/i} moved away.',
      )
    } else if (pick === 'shop') {
      // Just one part changed on top of her current expression.
      show('anna', { parts: { blush: 'on' } })
      await say('anna', 'Sure, have a look.')
      game.shops.open('anna')
    } else {
      show('anna', { pose: 'sad' })
      await say('anna', 'See you around!', { autoAdvance: 1200 })
    }
    hide('anna')
    await wait(200)
  },
})
