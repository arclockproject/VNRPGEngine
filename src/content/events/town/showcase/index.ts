// A tour of the visual-novel features, one menu entry each. Start it from the town sign, or from
// the dev panel (Events → town/showcase). Copy what you need; delete this folder when you don't.

// The same video, as a file: also usable as a background (in the voice language set now).
import clip from '@/content/movies/showcase/en/clip.webm'
import { defineEvent } from '@/core/define'

export default defineEvent({
  title: 'Feature tour',
  run: async (ctx) => {
    const { say, narrate, choice, show, hide, background, cg, movie, input } = ctx
    const { shake, flash, wait, game } = ctx

    show('anna', { at: 'center' })
    await say('anna', 'Pick something and I will show you how it looks.')

    for (;;) {
      const pick = await choice({
        voice: 'Voices',
        text: 'Ruby text and plurals',
        wipes: 'Mask transitions',
        video: 'Video',
        name: 'Typing a name',
        comfort: 'Shake, flash and rumble',
        more: 'Where is the rest?',
        bye: 'That is enough.',
      })

      if (pick === 'voice') {
        // A clip of another event, by name (no language in it). The music goes quieter while it
        // plays (Settings → Audio).
        await say('anna', "Oh! Hi there. I haven't seen you around town before.", {
          voice: 'anna/hello/anna_0001',
        })
        // A voice number: this event's own clip, audio/voice/<language>/town/showcase/anna_0001.*
        // (digits and languages: src/content/scenes.ts voice). `pnpm story --voice --number` writes
        // the numbers for you; a line without one has no voice.
        await say('anna', 'This line has a voice number: that is all a voiced line needs.', {
          voice: 1,
        })
        // Said together: both names on the tag, the plain chat box, a voice per speaker, all
        // starting at once (in a .vn file: `anna & jack(3, 7): …`, numbers in name order). Jack's clip
        // (town/showcase/jack_0001) is not recorded yet, so only Anna's plays; `pnpm story`
        // lists his as one to record.
        show('jack', { at: 'left' })
        await say(['anna', 'jack'], 'And this line we say together!', {
          voice: { anna: 'anna/hello/anna_0001', jack: 1 },
        })
        hide('jack')
        await say(
          'anna',
          'Press up for the log: lines with a voice have a ▶ button. My own volume is in Settings → Voices.',
        )
      }

      if (pick === 'text') {
        // Small reading text above the letters.
        await say(
          'anna',
          'I once took a train to {ruby=とうきょう}東京{/ruby}. {ruby=tiny}Ruby{/ruby} text!',
        )
        // One text, the right form per number (the forms are in src/content/lang/source.ts).
        for (const count of [1, 3]) await say('anna', 'I have {count} apples.', { count })
        await say(
          'anna',
          'Text size, font and how solid this box is: Settings → Text. Try them now, I will wait.',
        )
      }

      if (pick === 'wipes') {
        hide()
        background('#20324a', { transition: 'wipeLeft', duration: 700 })
        await narrate("A wipe from the right: transition 'wipeLeft'.")
        background('#4a2030', { transition: 'irisOut', duration: 900 })
        await narrate("…'irisOut': a circle opening from the middle.")
        cg('pond_memory', 'base', { transition: 'swirl', duration: 1400 })
        await narrate(
          "…'swirl': a greyscale picture decides the order (assets/transitions/swirl.png).",
        )
        background('#101820', { transition: 'pixels', duration: 800 })
        await narrate("…'pixels'. All of them are listed in src/content/scenes.ts.")
        background(null)
        show('anna', { at: 'center' })
      }

      if (pick === 'video') {
        hide()
        // A video as the background: it loops without sound behind the scene.
        background(clip)
        await narrate('A video as the background: background(clip).')
        background(null)
        await narrate(
          'Now the same file as a movie. Press confirm twice (or tap twice) to skip it.',
        )
        // A movie (src/content/movies/showcase) covers the scene, fades the music out and waits
        // until it ends. Playing it unlocks it in Extras → Movies.
        await movie('showcase')
        show('anna', { at: 'center' })
        await say('anna', 'And we are back.')
      }

      if (pick === 'name') {
        // Keyboard: type and Enter. Phone: tap the field. Controller: on-screen keys.
        const name = await input('What should I call you?', { default: 'Alex', maxLength: 12 })
        await say('anna', 'Nice to meet you, {name}!', { name })
      }

      if (pick === 'comfort') {
        await say('anna', 'Hold on to something…')
        // Also rumbles a controller / buzzes a phone (Settings → General → Vibration).
        void shake({ strength: 12, duration: 500 })
        await wait(600)
        void flash('#ffffff', 300)
        await say(
          'anna',
          'With "Reduce shaking and flashes" on (Settings → Text) the screen stays still and the flash is soft.',
        )
        game.input.rumble({ strength: 1, duration: 150 })
      }

      if (pick === 'more') {
        await say(
          'anna',
          'Quick save is F5 or Q.Save up there, quick load F9. "To choice" jumps ahead to the next choice.',
        )
        await say(
          'anna',
          'The music room is in Extras → Music on the title screen. "Read text aloud" is in Settings → Text.',
        )
      }

      if (pick === 'bye') break
    }
    await say('anna:happy', 'See you around!')
  },
})
