import { defineProp } from '@/core/define'
// The "trigger" slice is the area that counts as stepping on it (it doesn't block).
import sprite from './sprites/pressure_plate.gen'

export default defineProp({
  sprite,
  solid: false,
  onEnter: async ({ game, prop }) => {
    game.audio.sfx('sfx/click')
    game.toast(game.t('Click!'))
    await prop.play('down', { times: 6 }) // a moment down, then back up
  },
})
