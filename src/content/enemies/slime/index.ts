import { defineEnemy } from '@/core/define'
import battleSprite from './battle_sprite/slime.gen'

// game.battles.start({ enemies: ['slime'] }). Without battleSprite it would be a green blob.
export default defineEnemy({
  name: 'Slime',
  color: '#66bb6a',
  battleSprite,
  stats: { hp: 18, attack: 5, defense: 2, resistance: 1, speed: 3 },
  elements: { fire: 2, poison: 0.5 }, // weak to fire, shrugs off poison
  immune: ['poison'],
  actions: [{ skill: 'attack', weight: 3 }, { skill: 'venom' }],
  xp: 6,
  money: 4,
  drops: [{ item: 'apple', chance: 0.3 }],
})
