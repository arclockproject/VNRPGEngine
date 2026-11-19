import { defineProp } from '@/core/define'
import sprite from './sprites/campfire.gen'

export default defineProp({
  sprite,
  label: 'Campfire',
  light: { radius: 4, color: '#ffa04a', flicker: 0.35 }, // only shows when it's dark
  onInteract: ({ game }) => {
    // Resting moves the clock (outdoor maps get darker or lighter with it).
    game.clock.advance(60)
    game.toast(
      game.t('You rest by the fire for an hour. It is now {time}.', { time: game.clock.label() }),
    )
  },
})
