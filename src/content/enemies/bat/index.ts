import { defineEnemy } from '@/core/define'
import battleSprite from './battle_sprite/bat.gen'

export default defineEnemy({
  name: 'Bat',
  color: '#9575cd',
  battleSprite,
  stats: { hp: 12, mp: 6, attack: 6, defense: 1, resistance: 2, speed: 12, luck: 5 },
  elements: { lightning: 2 },
  actions: [{ skill: 'attack', weight: 3 }, { skill: 'bite', weight: 2 }, { skill: 'screech' }],
  xp: 8,
  money: 3,
})
