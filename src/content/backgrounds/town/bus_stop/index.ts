// A background with variants, made like a layered CG: bus_stop.aseprite has the layer "Day" (always
// drawn) and the toggle "+evening" (on top of it). Edit freely: this is game content.
// Shown with bg('town/bus_stop', 'day') / bg('town/bus_stop', 'evening'), `bg town/bus_stop evening`
// in a .vn file. A plain background needs no folder: drop the picture into src/content/backgrounds/.
import { defineBackground } from '@/core/define'
import picture from './bus_stop.gen'

export default defineBackground({
  image: picture,
  variants: {
    day: {}, // no toggles on: the picture as drawn
    evening: { evening: true },
  },
})
