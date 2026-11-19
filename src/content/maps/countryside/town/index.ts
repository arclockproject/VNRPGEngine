import { defineMap } from '@/core/define'
import { tx } from '@/core/lang'
// Generated from town.tmx whenever you save it in Tiled. Layout, spawns and object positions live there.
import town from './town.gen'

export default defineMap({
  title: 'Town',
  music: 'music/town',
  background: '#0d1117',
  outdoor: true, // tinted by the time of day (src/content/config/clock.ts)
  tiled: town,
  // Behaviour for the objects placed in Tiled, by their name there (typed: a typo is an error).
  objects: {
    // Characters are drawn with their map sprite (characters/<id>/sprites) and can be scripted:
    // game.maps.npc('jack').walk({ left: 5 }, { up: 2, speed: 6 }) / .play('wave') / .face('player').
    anna: { character: 'anna', onInteract: ({ game }) => game.events.start('anna/hello') },
    jack: {
      character: 'jack',
      facing: 'left',
      // Where Jack is during the day (walks between spots; gone at night).
      schedule: [
        { from: '8', at: { x: 14, y: 9 }, facing: 'left' },
        { from: '12:30', at: { x: 9, y: 11 }, facing: 'down' },
        { from: '17', at: { x: 14, y: 9 }, facing: 'left' },
        { from: '21:30', at: { x: 31, y: 10 }, hidden: true },
      ],
      onInteract: ({ game }) => game.events.start('jack/hello'),
    },
    sign: { onInteract: ({ game }) => game.events.start('town/sign') }, // written in index.vn
    // to_forest is a Tiled "door" (map + spawn properties): no code needed.
    // Props (chest, barrels, campfire, tree, pressure plate) are placed in Tiled by class name.
  },
  // Speech bubbles: Jack calls out now and then while you're on the map.
  setup: ({ world, game }) => {
    const lines = [tx('Hey! Over here!'), tx('Nice weather today.'), tx('Have you seen my letter?')]
    let next = 3
    return world.onTick((dt) => {
      next -= dt
      if (next > 0) return
      next = 10 + Math.random() * 8
      if (!game.events.isRunning())
        void world.npc('jack').bark(lines[Math.floor(Math.random() * lines.length)] as string)
    })
  },
  onEnter: ({ game }) => {
    game.codex.unlock('town')
    // Chapter 1 begins here: Extras → Chapters can start from this moment (src/content/chapters.ts).
    game.chapters.reach('town')
  },
})
