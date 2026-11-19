import { defineTitle } from '@/core/define'
import logo from '../../assets/logo.svg'

// An example variant: game.title.unlock('starlit') (try it from the dev panel → Title screens).
export default defineTitle({
  name: 'Starlit night',
  order: 1,
  screen: () => import('./Screen'),
  // Two stills: the sky alone for 1 s (step 0), then the logo drifts in for 1.6 s (step 1), then
  // the menu. Screen.tsx gets `step`.
  intro: [1000, 1600],
  preload: [logo], // sky.png is in this folder, so it loads by itself
})
