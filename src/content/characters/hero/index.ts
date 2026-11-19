import { defineCharacter } from '@/core/define'
import battleSprite from './battle_sprite/hero.gen'
// Map sprite (also the player's, see content/config/player.ts).
import sprite from './sprites/hero.gen'

// The player as a party member (game.party). No portraits yet: a coloured placeholder is shown.
export default defineCharacter({
  name: 'Me',
  color: '#ffd54f',
  sprite,
  battleSprite,
  battle: {
    base: { hp: 32, mp: 8, attack: 6, defense: 4, magic: 2, resistance: 3, speed: 5, luck: 4 },
    growth: {
      hp: 6,
      mp: 2,
      attack: 1.5,
      defense: 1,
      magic: 0.4,
      resistance: 0.6,
      speed: 0.8,
      luck: 0.5,
    },
    // Trip from the start; Power strike comes at level 3. Others: { skill, quest: 'jacks_letter' }
    // (once that quest is done), or game.party.learn('hero', 'fire') from an event.
    skills: ['trip', { skill: 'power_strike', level: 3 }],
  },
})
