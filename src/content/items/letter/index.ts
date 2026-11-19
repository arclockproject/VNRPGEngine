import { defineItem } from '@/core/define'
import icon from './icon.svg'

export default defineItem({
  name: 'Letter',
  description: 'Addressed to "whoever helped build this house".',
  icon,
  max: 1,
  keepOnUse: true,
  // Reading it plays an event: close the inventory first so the event is on top.
  use: ({ game }) => {
    game.windows.closeAll()
    return game.events.start('jack/letter')
  },
})
