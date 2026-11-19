// The maths of a battle. These are the defaults; src/content/battle.ts `formulas` replaces any of them.

/** A fighter's stats right now (statuses applied), by stat id. Missing stats read as undefined. */
export type FighterStats = Record<string, number>

export interface Formulas {
  /** Damage of a hit before crits, elements and defending. */
  damage: (hit: { attack: number; defense: number; power: number; random: () => number }) => number
  /** Chance to hit (0..1). */
  hitChance: (user: FighterStats, target: FighterStats) => number
  /** Chance of a critical hit (0..1). */
  critChance: (user: FighterStats, target: FighterStats) => number
  /** Damage × this on a critical hit. */
  critMultiplier: number
  /** Damage × this while the target defends. */
  defendMultiplier: number
  /** Time until a fighter's next turn. Lower = acts more often. */
  turnDelay: (speed: number) => number
  /** Chance to run away (0..1), from each side's average speed. */
  fleeChance: (partySpeed: number, enemySpeed: number) => number
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

export const DEFAULT_FORMULAS: Formulas = {
  // attack × power − half the defense, ±10%.
  damage: ({ attack, defense, power, random }) =>
    (attack * power - defense / 2) * (0.9 + random() * 0.2),
  hitChance: (user, target) =>
    clamp(0.95 + ((user.speed ?? 0) - (target.speed ?? 0)) * 0.01, 0.7, 1),
  critChance: (user) => clamp(0.05 + (user.luck ?? 0) * 0.01, 0, 0.5),
  critMultiplier: 1.5,
  defendMultiplier: 0.5,
  // Speed 20 acts about twice as often as speed 5.
  turnDelay: (speed) => 1000 / (Math.max(0, speed) + 10),
  fleeChance: (partySpeed, enemySpeed) => clamp(0.5 + (partySpeed - enemySpeed) * 0.05, 0.1, 0.95),
}
