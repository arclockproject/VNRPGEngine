// Translations. The text written in the game (usually English) is the key: say('jack', 'Hey!')
// shows 'Hej!' when Polish is chosen and src/content/lang/pl has 'Hey!': 'Hej!'.
// Dialogue, choices, names, window titles, items, quests and map labels go through t()
// automatically; use t() yourself for other UI text (and useLang() in React to re-render).

import langFiles from 'virtual:lang-files'
import { create } from 'zustand'
import sourceLanguage from '@/content/lang/source'
import { type LangId, loadLang, registry } from '../registry'
import { hasStoredLanguage, useSettingsStore } from '../stores/settings'
import { reword } from '../variants'
import type { LanguageConfig, PluralForms } from './define'

/** 'source' = the language the game is written in (no translation). */
export type LanguageChoice = 'source' | LangId

interface LangState {
  id: LanguageChoice
  strings: Record<string, string | PluralForms>
  /** BCP 47 code: plural rules, line breaking, self-voicing. */
  locale: string
  /** The language's own font (CSS font-family), if it sets one. */
  font: string | null
  /** File URL -> its version in this language ("<name>.<lang>.<ext>", found by the build). */
  images: Record<string, string>
}

const sourceState = (): LangState => ({
  id: 'source',
  strings: sourceLanguage.strings ?? {},
  locale: sourceLanguage.locale ?? 'en',
  font: null,
  images: {},
})

export const useLangStore = create<LangState>(sourceState)

const pluralRules = new Map<string, Intl.PluralRules | null>()

/** The plural form of `count` in a language ('one', 'few', 'other'…). */
export function pluralCategory(locale: string, count: number): keyof PluralForms {
  let rules = pluralRules.get(locale)
  if (rules === undefined) {
    try {
      rules = new Intl.PluralRules(locale)
    } catch {
      rules = null // an unknown code: everything is 'other'
    }
    pluralRules.set(locale, rules)
  }
  return (rules?.select(count) ?? 'other') as keyof PluralForms
}

/** A translation entry as text: plural entries pick their form by the {count} value. */
function pick(
  entry: string | PluralForms | undefined,
  locale: string,
  values?: Record<string, string | number>,
): string | undefined {
  if (entry === undefined || typeof entry === 'string') return entry
  const count = Number(values?.count)
  if (!Number.isFinite(count)) return entry.other
  return entry[pluralCategory(locale, count)] ?? entry.other
}

/** Strings shown without a translation, per language (dev builds; see the dev panel). */
const missing = new Map<string, Set<string>>()

function format(text: string, values?: Record<string, string | number>) {
  if (!values) return text
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  )
}

/** Translates `text` into the chosen language (unchanged without a translation). */
export function t(source: string, values?: Record<string, string | number>): string {
  const { id, strings, locale } = useLangStore.getState()
  if (!source) return source
  // This version of the game may word it differently (content variants, src/content/variants).
  const text = reword(source)
  // The source language lists only texts it rewords or gives plural forms.
  if (id === 'source') return format(pick(strings[text], locale, values) ?? text, values)
  const translated = pick(strings[text], locale, values)
  if (translated === undefined || translated === '') {
    if (import.meta.env.DEV) {
      const set = missing.get(id) ?? new Set<string>()
      set.add(text)
      missing.set(id, set)
    }
    const source = sourceLanguage.strings?.[text]
    return format(pick(source, sourceLanguage.locale ?? 'en', values) ?? text, values)
  }
  return format(translated, values)
}

/**
 * Marks text for translation without translating it yet (pnpm lang finds it), for text kept in
 * constants and translated later with t(): const PROMPT = { keyboard: tx('Press any key') }.
 */
export const tx = (text: string): string => text

/** React: re-render when the language changes; returns t for convenience. */
export function useLang() {
  useLangStore((s) => s.strings)
  return t
}

export const lang = {
  /** The language the game is written in. */
  source: sourceLanguage,
  get ids() {
    return registry.langs
  },

  current(): LanguageChoice {
    return useLangStore.getState().id
  },

  async set(id: LanguageChoice): Promise<void> {
    if (id === 'source' || !registry.langs.includes(id)) {
      useLangStore.setState(sourceState())
      return
    }
    const config = (await loadLang(id)) as LanguageConfig
    useLangStore.setState({
      id,
      strings: config.strings,
      locale: config.locale ?? id,
      font: config.font ?? null,
      images: langFiles[id] ?? {},
    })
  },

  /** The language code in use ('en', 'pl', 'ja'): for Intl formatting, line breaking, speech. */
  locale(): string {
    return useLangStore.getState().locale
  },

  /**
   * A picture or video in the player's language: "<name>.<lang>.<ext>" next to the file is used
   * when it exists (found by the build, so a missing one is never asked for). Others come back
   * unchanged. Works on its own when passed to map().
   */
  image(url: string): string {
    return useLangStore.getState().images[url] ?? url
  },

  /** Display name of a language (loads its file). */
  async name(id: LanguageChoice): Promise<string> {
    if (id === 'source') return sourceLanguage.name
    return ((await loadLang(id)) as LanguageConfig).name
  },

  /** Dev builds: texts shown in `id` that have no translation yet, as lines to paste. */
  missing(id: LanguageChoice = lang.current()): string[] {
    return [...(missing.get(id) ?? [])].map((text) => `    ${JSON.stringify(text)}: '',`)
  },
}

/**
 * The game's language for the device's preferred languages (in order): an exact folder match
 * first (pt-BR -> pt_br), then the main code (ja-JP -> ja). The source language counts too
 * (en-GB -> English). None: the source language.
 */
export function pickSystemLanguage(
  wanted: readonly string[],
  ids: readonly string[] = registry.langs,
): LanguageChoice {
  const source = (sourceLanguage.locale ?? 'en').toLowerCase()
  for (const tag of wanted) {
    const full = tag.toLowerCase().replace(/-/g, '_')
    const main = full.split('_')[0] ?? ''
    if (full === source || main === source.split('-')[0]) return 'source'
    const found = ids.find((id) => id === full) ?? ids.find((id) => id === main)
    if (found) return found as LanguageChoice
  }
  return 'source'
}

let started = false
/** The first language load (startLanguage): boot screens wait for it, so they show translated. */
let firstLoad: Promise<void> = Promise.resolve()

/** Resolves once the language picked in the settings has loaded (or failed back to the source). */
export function languageReady(): Promise<void> {
  return firstLoad
}

/** Applies the language from the settings, now and whenever it changes. Called from boot.tsx. */
export function startLanguage() {
  if (started) return
  started = true
  // First start on this device: the device's own language, when the game has it.
  if (
    !hasStoredLanguage() &&
    sourceLanguage.followSystem !== false &&
    typeof navigator !== 'undefined'
  ) {
    const wanted = navigator.languages?.length ? navigator.languages : [navigator.language]
    const picked = pickSystemLanguage(wanted.filter(Boolean))
    useSettingsStore.setState((s) => {
      s.language = picked
    })
  }
  const apply = (id: string) =>
    lang.set(id as LanguageChoice).catch((error: unknown) => {
      console.warn(`[lang] can't load "${id}"`, error)
      return lang.set('source')
    })
  firstLoad = apply(useSettingsStore.getState().language)
  // The page's language: browsers use it for line breaking (Japanese, Chinese), hyphens and fonts.
  const mark = () => {
    if (typeof document !== 'undefined') document.documentElement.lang = lang.locale()
  }
  mark()
  useLangStore.subscribe(mark)
  useSettingsStore.subscribe((s, previous) => {
    if (s.language !== previous.language) void apply(s.language)
  })
}
