// Types for src/content/lang/<code>/index.ts (one folder per translation).

/**
 * A text that changes with a number: the form is picked by the {count} value, with the language's
 * own rules (English: one / other; Polish: one / few / many / other). `other` is the fallback.
 */
export type PluralForms = { other: string } & Partial<
  Record<'zero' | 'one' | 'two' | 'few' | 'many', string>
>

export interface LanguageConfig {
  /** Shown in the settings, in that language: 'Polski'. */
  name: string
  /**
   * The language code (BCP 47: 'pl', 'ja', 'pt-BR'). Default: the folder name. Picks the plural
   * rules, the line-breaking rules (Japanese, Chinese) and the voice for self-voicing.
   */
  locale?: string
  /** A CSS font-family for this language (e.g. one that has its letters). Default: the game's font. */
  font?: string
  /**
   * Source text (exactly as written in the game, usually English) -> translation.
   * Placeholders like {name} stay as they are: t('Hi {name}!', { name }).
   * A text with a {count} can give one form per plural: { one: '…', few: '…', other: '…' }.
   */
  strings: Record<string, string | PluralForms>
}

export function defineLanguage(config: LanguageConfig): LanguageConfig {
  return config
}

/** src/content/lang/source.ts: the language the game is written in. */
export interface SourceLanguage {
  name: string
  /** Default 'en'. */
  locale?: string
  /**
   * Rewords text in the source language, the engine's own included: the text exactly as written ->
   * what to show instead ('Quest complete: {title}': 'Mission done: {title}'), or plural forms
   * ('You have {count} apples.': { one: '…', other: '…' }). Translations still use the
   * original text as their key.
   */
  strings?: Record<string, string | PluralForms>
  /**
   * First start (no language picked yet): use the device's language when the game has it (a folder
   * in src/content/lang named like its code: ja, pl, pt_br), else this one. Default true.
   */
  followSystem?: boolean
}

export function defineSourceLanguage(config: SourceLanguage): SourceLanguage {
  return config
}
