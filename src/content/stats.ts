// Party stats, elements, equipment slots and levels. Characters set their numbers with
// defineCharacter({ battle: { base: { hp: 30, … }, growth: { hp: 5, … } } }).
import { defineStats } from '@/core/define'
import { tx } from '@/core/lang'

export default defineStats({
  stats: {
    // pool: has a current value that goes down and up (hp 12 / 30). Its max is the stat.
    hp: { name: 'HP', pool: true },
    mp: { name: 'MP', pool: true },
    attack: { name: 'Attack' }, // physical hits
    defense: { name: 'Defense' }, // against physical hits
    magic: { name: 'Magic' }, // spells and healing
    resistance: { name: 'Resistance' }, // against spells
    speed: { name: 'Speed' }, // how often they act, hitting and dodging
    luck: { name: 'Luck' }, // critical hits
  },
  // Damage types. A skill names one (`element: 'fire'`); enemies, characters and equipment say how
  // much of it they take: `elements: { fire: 2 }` = weak (double), 0.5 = resists, 0 = immune.
  elements: {
    fire: { name: 'Fire', color: '#ff7043' },
    ice: { name: 'Ice', color: '#4fc3f7' },
    lightning: { name: 'Lightning', color: '#ffee58' },
    poison: { name: 'Poison', color: '#ab47bc' },
  },
  slots: { weapon: tx('Weapon'), armor: tx('Armor'), accessory: tx('Accessory') },
  maxLevel: 999,
  /** Total XP needed to reach `level` (level 1 = 0). */
  xpForLevel: (level) => Math.round(8 * (level - 1) ** 2 + 12 * (level - 1)),
  /** Most party members at once. (Who starts in the party: save/index.ts newGame.) */
  maxMembers: 4,
})
