import { defineProp } from '@/core/define'
import type { ItemId } from '@/core/registry'
import sprite from './sprites/chest.gen'

// A chest that opens once. Custom properties (Tiled, or game.props.spawn's `properties`):
//   item  = item id inside (default 'apple'), count = how many (default 1).
export default defineProp({
  sprite,
  animation: 'closed',
  // Opened chests stay open: memory is saved per chest.
  setup: ({ prop, memory }) => {
    if (memory.get('open')) prop.idle('open')
  },
  onInteract: async ({ game, prop, memory, properties }) => {
    if (memory.get('open')) {
      game.toast(game.t('The chest is empty.'))
      return
    }
    memory.set('open', true)
    game.audio.sfx('sfx/confirm')
    await prop.play('opening', { hold: true })
    prop.idle('open')
    const item = (typeof properties.item === 'string' ? properties.item : 'apple') as ItemId
    const count = typeof properties.count === 'number' ? properties.count : 1
    game.items.add(item, count, { notify: true })
  },
})
