import type { VariantValue } from './variants'
// Endings (src/content/endings/<id>/index.ts): the ways the story can end. An event reaches one
// with ending('<id>'); it is then listed in Extras → Endings for good (across all saves).
// Must not import content or `game` (ending files are loaded up front).

export interface EndingConfig {
  /** Only in the version of the game built with this content variant (src/content/config/variants.ts); left out of the others. */
  only?: VariantValue
  /** Name in Extras → Endings (translated). */
  title: string
  /** A line under the title once it has been reached (translated). */
  description?: string
  /** Shown instead of the description while it is still locked ("Trust someone."). */
  hint?: string
  /** A picture for its tile (an image import). */
  image?: string
  /** Lower comes first. Default: folder order. */
  order?: number
  /** Not counted or listed until reached (a secret ending). */
  secret?: boolean
}

export function defineEnding(config: EndingConfig): EndingConfig {
  return config
}
