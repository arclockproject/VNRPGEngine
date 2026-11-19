import { defineGallery } from '@/core/define'
import cg from './pond.gen' // from pond.aseprite: layers "+full moon" and "+crying" are toggles

// Shown in events with cg('pond_memory', 'base') or cg('pond_memory', 'crying'), which also unlocks
// that picture in Extras → Gallery. Each variant is its own dot in the gallery viewer, in this order.
export default defineGallery({
  title: 'By the pond',
  image: cg,
  variants: {
    base: {}, // the plain picture (no toggles on): only listed because it is named here
    full_moon: { full_moon: true },
    crying: { crying: true },
    'crying.full_moon': { crying: true, full_moon: true },
  },
})
