import { defineItem } from '@/core/define'
import icon from './icon.svg'

export default defineItem({
  name: 'Lantern',
  description: 'Lights up dark places.',
  icon,
  price: 20,
  max: 1,
  // The player glows with this in the dark while the lantern is carried and switched on.
  light: { radius: 3.5, color: '#ffe0a0' },
  // Lit as soon as you get it, put out when it is gone (sold, taken away).
  onObtain: ({ game, id }) => game.items.setOn(id, true),
  onLose: ({ game, id }) => game.items.setOn(id, false),
  // "Use" in the inventory switches it on and off.
  keepOnUse: true,
  useLabel: ({ game, id }) => (game.items.isOn(id) ? game.t('Put out') : game.t('Light')),
  use: ({ game, id }) => {
    game.items.toggle(id)
    game.audio.sfx('sfx/click')
  },
})
