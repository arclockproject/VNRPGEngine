// Types for src/content/config/mode.ts (which kind of game this is). This file must not import content.

export interface ModeConfig {
  /**
   * true = a visual novel only: the story runs through src/content/routes (starting with `common`),
   * the pause menu has a Flowchart, and the RPG parts (inventory, quests, crafting, travel, party,
   * journal, maps) are not offered. false = the normal game with maps.
   * Developer only: players and the debug menu cannot change it.
   */
  vnOnly: boolean
}

export function defineMode(config: ModeConfig): ModeConfig {
  return config
}
