// Language layers in Aseprite files: a layer (or group) named "<name>.<lang>" is the version of its
// sibling "<name>" for that language, e.g. "open.ja" next to "open" inside @Eyes. <lang> is a folder
// in src/content/lang. Works for any layer: portraits, sprites and CGs.
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { activeVariants, readVariants } from '../variants.ts'
import type { AseFile, AseLayer } from './read.ts'

/** The game's languages: the folders in src/content/lang. */
export function contentLanguages(root: string): string[] {
  const dir = path.join(root, 'src/content/lang')
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^[a-z][a-z0-9_]*$/.test(entry.name))
    .map((entry) => entry.name)
    .sort()
}

const key = (name: string) => name.trim().toLowerCase()

/** "open.ja" -> { base: "open", lang: "ja" } when ja is one of `langs`. */
export function languageOf(name: string, langs: readonly string[]) {
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return null
  // Any capitals: "Open.JA" is "open" in ja (layer names are matched the same way).
  const lang = name
    .slice(dot + 1)
    .trim()
    .toLowerCase()
  return langs.includes(lang) ? { base: name.slice(0, dot), lang } : null
}

export interface LanguageViews {
  /** Languages that have at least one layer in this file. */
  langs: string[]
  /** The file as drawn in `lang` (null = the source language: language layers left out). */
  view(lang: string | null): AseFile
}

export function languageViews(
  file: AseFile,
  langs: readonly string[],
  warn: (message: string) => void,
): LanguageViews {
  const found = new Set<string>()

  // Which layers have a version per language (checked once, so warnings show once).
  const scan = (siblings: AseLayer[], where: string) => {
    const names = new Set(
      siblings.filter((l) => !languageOf(l.name, langs)).map((l) => key(l.name)),
    )
    for (const layer of siblings) {
      const variant = languageOf(layer.name, langs)
      if (variant) {
        if (names.has(key(variant.base))) found.add(variant.lang)
        else
          warn(
            `"${where}${layer.name}": no layer "${variant.base}" next to it to replace in ${variant.lang}, ignored`,
          )
      }
      if (layer.children.length > 0) scan(layer.children, `${where}${layer.name}/`)
    }
  }
  scan(file.roots, '')

  const mapLayers = (siblings: AseLayer[], lang: string | null): AseLayer[] => {
    const versions = new Map<string, AseLayer>()
    if (lang)
      for (const layer of siblings) {
        const variant = languageOf(layer.name, langs)
        if (variant?.lang === lang) versions.set(key(variant.base), layer)
      }
    return siblings.flatMap((layer) => {
      if (languageOf(layer.name, langs)) return []
      const version = versions.get(key(layer.name))
      // The language layer takes the other's place, name and visibility (it may be hidden while
      // you paint the other language); its own pixels and children are used.
      const used = version ? { ...version, name: layer.name, visible: layer.visible } : layer
      return [{ ...used, children: mapLayers(used.children, lang) }]
    })
  }

  return {
    langs: [...found].sort(),
    view: (lang) => ({ ...file, roots: mapLayers(file.roots, lang) }),
  }
}

/**
 * Content variant layers (vite/variants.ts): per group, a layer "<name>.<value>" replaces "<name>"
 * when <value> is this build's, and every other value's layers are left out. Same rules as language
 * layers (place, name and visibility of the layer it replaces).
 */
export function variantLayers(
  file: AseFile,
  root: string,
  warn: (message: string) => void,
): AseFile {
  const { groups } = readVariants(root)
  const active = activeVariants(root)
  // "open.cn.ja" (the "cn" version of "open" in Japanese) becomes "open.ja" in the "cn" build, in
  // place of a plain "open.ja"; other values' language layers are left out. The language pass
  // (languageViews with the languages) then works as usual.
  const values = Object.values(groups).flat()
  const on = Object.values(active)
  const langs = contentLanguages(root)
  const both = (name: string) => {
    const parts = name.split('.')
    if (parts.length < 3) return null
    const lang = (parts.at(-1) as string).trim().toLowerCase()
    const value = (parts.at(-2) as string).trim().toLowerCase()
    if (!langs.includes(lang) || !values.includes(value)) return null
    return { base: parts.slice(0, -2).join('.'), value, lang }
  }
  const sortLayers = (siblings: AseLayer[]): AseLayer[] => {
    const replaced = new Set(
      siblings.flatMap((layer) => {
        const found = both(layer.name)
        return found && on.includes(found.value) ? [key(`${found.base}.${found.lang}`)] : []
      }),
    )
    // "open.cn" in the cn build: a plain "open.ja" is left out too (a variant beats a language, as
    // with files), so Japanese players see "open.cn" unless there is an "open.cn.ja".
    const varied = new Set(
      siblings.flatMap((layer) => {
        const dot = layer.name.lastIndexOf('.')
        const value = layer.name
          .slice(dot + 1)
          .trim()
          .toLowerCase()
        return dot > 0 && on.includes(value) ? [key(layer.name.slice(0, dot))] : []
      }),
    )
    const plainLanguage = (name: string) => {
      const dot = name.lastIndexOf('.')
      return dot > 0 &&
        langs.includes(
          name
            .slice(dot + 1)
            .trim()
            .toLowerCase(),
        )
        ? key(name.slice(0, dot))
        : null
    }
    return siblings.flatMap((layer) => {
      const found = both(layer.name)
      if (found && !on.includes(found.value)) return []
      if (!found && replaced.has(key(layer.name))) return []
      const base = found ? null : plainLanguage(layer.name)
      if (base !== null && varied.has(base)) return []
      const name = found ? `${found.base}.${found.lang}` : layer.name
      return [{ ...layer, name, children: sortLayers(layer.children) }]
    })
  }
  let out: AseFile = { ...file, roots: sortLayers(file.roots) }
  for (const [group, groupValues] of Object.entries(groups))
    out = languageViews(out, groupValues, warn).view(active[group] ?? null)
  return out
}
