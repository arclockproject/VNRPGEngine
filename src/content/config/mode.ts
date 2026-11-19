// Which kind of game this is. Edit freely: this is game content, not engine.
import { defineMode } from '@/core/mode'

export default defineMode({
  // true = visual novel only: a new game starts the `common` route (src/content/routes/common),
  // the pause menu offers the Flowchart, and inventory, quests, crafting, travel, party, journal
  // and maps are not used. false = the normal game with maps (everything works as before).
  vnOnly: true,
})
