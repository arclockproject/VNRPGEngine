// Types for src/content/emotes.ts: the little balloons over heads on the map (!, ?, ♥, zzz).
// Must not import content (content imports this file).

export interface EmoteLook {
  /** What the balloon shows: a symbol or a very short text. */
  text: string
  /** CSS colour of the symbol. Default: the bubble text colour. */
  color?: string
}

export interface EmotesConfig<K extends string = string> {
  /** How long a balloon stays, ms (unless the call gives its own). */
  durationMs: number
  /** Symbol size in px on a screen of normal height. */
  size: number
  /** The balloon itself. */
  balloon: { fill: string; outline: string }
  list: Record<K, EmoteLook | string>
}

export function defineEmotes<const K extends string>(config: EmotesConfig<K>): EmotesConfig<K> {
  return config
}
