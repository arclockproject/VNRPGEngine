// Crafting recipes: game.crafting. Edit freely: this is game content, not engine.
// The window is src/content/windows/crafting.
//   makes / count   the item made, and how many (default 1)
//   needs           items used up
//   tools           items that must be in the bag but stay there
//   cost            money
//   station         where it can be made (a name of your own); open the window there with
//                   game.crafting.open('campfire'). No station = anywhere, from the pause menu.
//   known: false    hidden until game.crafting.learn('id')
import { defineRecipes } from '@/core/crafting'

export default defineRecipes({
  // "Crafting" in the pause menu, once a recipe without a station is known.
  inMenu: true,
  // sound: 'sfx/craft',

  recipes: {
    apple_bread: {
      makes: 'bread',
      count: 2,
      needs: { apple: 2, bread: 1 },
    },
    lucky_charm: {
      makes: 'lucky_charm',
      needs: { apple: 3 },
      cost: 25,
      station: 'campfire',
      known: false, // game.crafting.learn('lucky_charm')
    },
  },
})
