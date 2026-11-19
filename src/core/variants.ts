// Content variants (src/content/config/variants.ts): which version of the game this build is
// (all-ages / adult, a region…). The build picks one value per group (vite/variants.ts); the game
// only reads it. Files and content of the other values are not in the build at all.
import active from 'virtual:variants'

/** One group: its values and the one a build uses when it does not say. */
export interface VariantGroup<V extends string = string> {
  values: readonly V[]
  default: NoInfer<V>
}

export function defineVariants<const G extends Record<string, VariantGroup>>(groups: G): G {
  return groups
}

/** The text rewording of one value (src/content/variants/<value>/strings.ts): English -> English. */
export function defineVariantStrings(strings: Record<string, string>): Record<string, string> {
  return strings
}

type Config = typeof import('@/content/config/variants').default
/** A variant group's name ('rating'). */
export type VariantGroupName = keyof Config & string
/** Any variant value ('adult', 'cn'…). */
export type VariantValue = {
  [G in VariantGroupName]: Config[G]['values'][number]
}[VariantGroupName]

const groups = active.groups as Record<string, string>
const reworded = active.strings as Record<string, string>

export const variants = {
  /** Is this version of the game built with that value? game.variants.is('adult'). */
  is(value: VariantValue): boolean {
    return Object.values(groups).includes(value)
  },
  /** The value a group has in this build: game.variants.get('rating') -> 'allages'. */
  get<G extends VariantGroupName>(group: G): Config[G]['values'][number] {
    return groups[group] as Config[G]['values'][number]
  },
  /** Every group with its value in this build (saves keep it). */
  all(): Record<string, string> {
    return { ...groups }
  },
}

/**
 * Content marked `only: '<value>'` (gallery, movies, endings, achievements, journal, events) that
 * this build leaves out.
 */
export function variantOff(config: unknown): boolean {
  const only = (config as { only?: unknown } | null | undefined)?.only
  return typeof only === 'string' && !Object.values(groups).includes(only)
}

/** The line as this version words it (src/content/variants/<value>/strings.ts), before translation. */
export function reword(text: string): string {
  return reworded[text] ?? text
}
