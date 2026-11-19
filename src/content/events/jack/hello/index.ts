import { defineEvent } from '@/core/define'

/** Where Jack's house goes: the empty meadow east of the pond in town. */
export const HOUSE_SPOT = { x: 21, y: 3 }

// Jack: a portrait made in Aseprite (src/content/characters/jack/portraits/jack.aseprite).
export default defineEvent({
  title: "Jack's outfit",
  run: async ({ say, show, choice, hide, animate, fade, shake, game }) => {
    game.codex.unlock('jack')
    // Jack starts far away (small, higher up) and walks towards you: he grows as he comes closer.
    show('jack', { at: 'center', scale: 0.35, y: -140 })
    void animate('jack', { rotate: 3 }, { duration: 180, ease: 'sineInOut', yoyo: true, repeat: 7 }) // walking wobble
    await animate('jack', { x: 'left', scale: 1, y: 0 }, { duration: 1500, ease: 'sineOut' })
    await say('jack', "Hey! I can't decide what to wear today.")

    for (;;) {
      const built = game.structures.has('jacks_house', { map: 'countryside/town' })
      const pick = await choice({
        jacket: 'Try the jacket',
        hoodie: 'Try the hoodie',
        none: 'Just the t-shirt',
        // Only offered until the house exists.
        ...(built ? {} : { build: 'Build a house!' }),
        walk: 'Show me a walk!',
        done: 'You look great, bye!',
      })
      if (pick === 'done') break

      if (pick === 'walk') {
        // 'jack:happy' switches his pose; {w=…} pauses, {wave}/{b} style single words.
        await say('jack:happy', 'Watch me!{w=0.4} Round the block {wave}and back{/wave}.')
        hide('jack')
        // Jack on the map (his sprite), not the portrait. Each step: one direction + tiles,
        // optionally its own speed in tiles per second (default: his speed, 3).
        const jack = game.maps.npc('jack')
        void game.maps.camera.follow('jack') // the camera goes with him
        await jack.play('wave')
        await jack.walk(
          { up: 2 },
          { right: 3, speed: 6 },
          { down: 1 },
          { left: 3, speed: 1.5 },
          { down: 1 },
        )
        jack.face('player')
        await game.maps.camera.reset()
        await jack.play('wave', { times: 1 })
        show('jack', { pose: 'happy' })
        await say('jack', 'Ta-da!')
        show('jack', { pose: 'neutral' })
        continue
      }

      if (pick === 'build') {
        show('jack', { pose: 'surprised' })
        await say('jack', 'A house? In the meadow past the pond? Sure, watch this!')
        await fade('#000000', 400)
        try {
          // Stamps structures/house into the town map; it is saved and stays there.
          await game.structures.place('house', {
            id: 'jacks_house',
            at: HOUSE_SPOT,
            map: 'countryside/town',
          })
          game.achievements.unlock('builder')
          // A prop spawned from code (saved with the game, like the house).
          await game.props.spawn('barrel', {
            id: 'house_barrel',
            at: { x: HOUSE_SPOT.x - 1, y: HOUSE_SPOT.y + 6 },
            map: 'countryside/town',
          })
        } catch (error) {
          await fade(null, 300)
          await say('jack', "Hmm, something's in the way. Let's try later.")
          console.warn(error)
          continue
        }
        await fade(null, 400)
        void shake({ strength: 6, duration: 300 })
        show('jack', { pose: 'happy' })
        await say('jack', "Done! It's right past the pond. Have a look at the mailbox!")
        game.quests.start('jacks_letter')
        show('jack', { pose: 'neutral' })
        continue
      }

      // Outfits are a swappable part: one at a time, or none (null).
      show('jack', { pose: 'happy', parts: { outfit: pick === 'none' ? null : pick } })
      void animate('jack', { y: -20 }, { duration: 150, ease: 'quadOut', yoyo: true, repeat: 1 })
      await say('jack', pick === 'none' ? 'Simple. I like it.' : `The ${pick}? Good choice!`)
      show('jack', { pose: 'neutral' }) // the outfit stays: expressions only change eyes/mouth
    }

    show('jack', { pose: 'sleepy' })
    await say('jack', 'Thanks. Now I need a nap.')
    hide('jack')
  },
})
