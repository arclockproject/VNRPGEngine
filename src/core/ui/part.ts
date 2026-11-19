// Named looks from src/content/look/parts.ts, for any element: <Box sx={part('cover')} />.
// (On a Button or Paper, variant="name" does the same through the theme.)
import look from '@/content/look'
import { type EngineParts, type LookPart, partLook, type StateSelectors, stateLook } from '../look'

export type PartName = keyof typeof look.parts

const cache = new Map<string, object>()

/**
 * The style of a named part, for `sx`. With a state ('selected', 'focus'...) it is that state
 * drawn flat, for elements that are not MUI parts and pick the state themselves.
 */
export function part(name: PartName, state?: keyof StateSelectors): object {
  const key = state ? `${name}:${state}` : name
  let style = cache.get(key)
  if (!style) {
    const config = look.parts[name]
    style = state ? stateLook(config, state) : partLook(config)
    cache.set(key, style)
  }
  return style
}

/**
 * An optional engine part (core/look.ts EngineParts keys marked `?`): its style, or {} when the
 * game's src/content/look/parts.ts does not have it (games made before the part existed).
 */
export function optionalPart(name: keyof EngineParts): object {
  const key = `?${name}`
  let style = cache.get(key)
  if (!style) {
    const config = (look.parts as Partial<Record<keyof EngineParts, LookPart>>)[name]
    style = config ? partLook(config) : {}
    cache.set(key, style)
  }
  return style
}
