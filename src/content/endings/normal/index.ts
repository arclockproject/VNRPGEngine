import { defineEnding } from '@/core/define'

// Reached in the common route (src/content/routes/common: `return ending('normal')`), or with
// ending('normal') in an event (`ending normal` in a .vn file). It then shows in Extras → Endings
// for good, across all saves.
export default defineEnding({
  title: 'Somewhere else',
  description: 'You ran, and never looked back.',
  // While locked, this shows instead of the description:
  hint: 'Neither stay nor take the bus.',
  // image: a picture for its tile (import it like any image).
  // order: 1,       // lower comes first (default: folder order)
  // secret: true,   // not listed or counted until reached
})
