import { defineTitle } from '@/core/define'
import logo from '../../assets/logo.svg'

// The first title screen. More variants: a folder next to this one, unlocked with
// game.title.unlock('<folder name>') (e.g. after an ending). Everything inside a title's folder is
// loaded before it shows; files from elsewhere go in `preload`.
export default defineTitle({
  name: 'INSERTGAMENAMEHERE',
  order: 0,
  unlocked: true,
  screen: () => import('./Screen'),
  // How long the entrance in Screen.tsx takes (ms): the menu waits for it. Confirm skips it.
  intro: 1200,
  preload: [logo],
})
