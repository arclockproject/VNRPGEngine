import { defineEnemy } from '@/core/define'
import battleSprite from './battle_sprite/wolf.gen'

export default defineEnemy({
  name: 'Wolf',
  color: '#90a4ae',
  battleSprite,
  stats: { hp: 34, attack: 9, defense: 3, resistance: 2, speed: 7, luck: 3 },
  elements: { fire: 1.5, ice: 0.5 },
  actions: [
    { skill: 'attack', weight: 2 },
    // Bites harder once it is hurt.
    { skill: 'bite', weight: 1 },
    { skill: 'bite', weight: 3, when: ({ self }) => self.hp < 17 },
  ],
  xp: 18,
  money: 10,
  drops: [{ item: 'bread', chance: 0.5 }],
})
