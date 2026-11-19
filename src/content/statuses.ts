// Statuses fighters can have during a battle (poison, sleep, haste…). Skills and items give them
// with `{ type: 'status', status: 'poison', chance: 0.4 }`. They end when the fight ends, unless
// a status says `lasting: true`: then party members carry it into the next fight (it shows in the
// Party window) until it runs out, is cured, or game.party.restore() / game.party.cure().
//   turns     how many of the fighter's own turns it lasts (a number, or [min, max])
//   tick      share of max HP / MP at the start of each own turn (-0.08 = loses 8%)
//   stats     stat multipliers while it lasts
//   restrict  'skip' loses the turn, 'attack_random' attacks anyone, 'no_skills' no skills
//   bad       harmful (what a "cure everything" skill removes)
//   lasting   stays on party members after the fight
import { defineStatuses } from '@/core/define'

export default defineStatuses({
  poison: {
    name: 'Poison',
    description: 'Loses HP every turn.',
    icon: '☠',
    color: '#ab47bc',
    bad: true,
    turns: [3, 5],
    tick: { hp: -0.08 },
  },
  burn: {
    name: 'Burn',
    description: 'Loses HP every turn and hits weaker.',
    icon: '♨',
    color: '#ff7043',
    bad: true,
    turns: 3,
    tick: { hp: -0.05 },
    stats: { attack: 0.8 },
  },
  regen: {
    name: 'Regen',
    description: 'Recovers HP every turn.',
    icon: '✚',
    color: '#66bb6a',
    turns: 4,
    tick: { hp: 0.08 },
  },
  sleep: {
    name: 'Sleep',
    description: "Can't act. Wakes up when hit.",
    icon: 'z',
    color: '#90a4ae',
    bad: true,
    turns: [2, 3],
    restrict: 'skip',
    wakeOnHit: true,
  },
  stun: {
    name: 'Stun',
    description: 'Loses the next turn.',
    icon: '✖',
    color: '#ffee58',
    bad: true,
    turns: 1,
    restrict: 'skip',
  },
  haste: {
    name: 'Haste',
    description: 'Acts more often.',
    icon: '»',
    color: '#4fc3f7',
    turns: 4,
    stats: { speed: 1.6 },
  },
  slow: {
    name: 'Slow',
    description: 'Acts less often.',
    icon: '«',
    color: '#8d6e63',
    bad: true,
    turns: 4,
    stats: { speed: 0.6 },
  },
  strong: {
    name: 'Strong',
    description: 'Hits harder.',
    icon: '▲',
    color: '#ef5350',
    turns: 3,
    stats: { attack: 1.3, magic: 1.3 },
  },
  brittle: {
    name: 'Brittle',
    description: 'Takes more damage.',
    icon: '▼',
    color: '#bdbdbd',
    bad: true,
    turns: 3,
    stats: { defense: 0.6, resistance: 0.6 },
  },
})
