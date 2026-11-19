// Typed access to everything in src/content/, built on the generated registry file.
import type emotesConfig from '@/content/emotes'
import type statsConfig from '@/content/stats'
import type statusesConfig from '@/content/statuses'
import type weatherConfig from '@/content/weather'
import * as gen from '@/generated/registry.gen'
import type {
  AchievementConfig,
  CodexConfig,
  EndingConfig,
  EnemyConfig,
  GalleryConfig,
  ItemConfig,
  MovieConfig,
  ParamsOf,
  PartsOf,
  PosesOf,
  PropDefinition,
  PropTagsOf,
  QuestDefinition,
  ResultOf,
  ShopConfig,
  SkillConfig,
  SpriteTagsOf,
  TitleConfig,
  TroopConfig,
} from './define'
import type { FlowDefinition, RouteConfig, RouteId } from './defs/routes'
import type { PictureConfig } from './gallery'
import { missingContentMessage } from './required'
import type { AnimationState } from './sprite/types'
import { variantOff } from './variants'

type DefOf<L> = L extends () => Promise<{ default: infer D }> ? D : never

export type MapId = keyof typeof gen.mapLoaders
export type EventId = keyof typeof gen.eventLoaders
export type MinigameId = keyof typeof gen.minigameLoaders
export type WindowId = keyof typeof gen.windowLoaders
export type StructureId = keyof typeof gen.structureLoaders
export type CharacterId = keyof typeof gen.characters
// From the plain id list, not `keyof typeof gen.items`: item hooks take `game`, and Game -> ItemId ->
// the item files -> Game would be a type cycle (TS7022).
export type ItemId = gen.ContentIds['items']
// From the plain id list (see ItemId): a quest step's `when` takes `game`.
export type QuestId = gen.ContentIds['quests']
export type PropId = keyof typeof gen.props
export type LangId = keyof typeof gen.langLoaders
export type GalleryId = keyof typeof gen.gallery
/** From the plain id list: scene/types (the event API) uses it, so no type cycle through events. */
export type MovieId = gen.ContentIds['movies']
/** Variant names of a gallery picture (its `variants` keys; none for plain pictures). */
export type GalleryVariantOf<K extends GalleryId> = (typeof gen.gallery)[K] extends {
  variants?: Record<infer V, unknown>
}
  ? V & string
  : never
/** From the plain id list (the event API uses it). */
export type EndingId = gen.ContentIds['endings']
export type ShopId = keyof typeof gen.shops
export type AchievementId = keyof typeof gen.achievements
export type CodexId = gen.ContentIds['codex']
export type EnemyId = keyof typeof gen.enemies
export type SkillId = keyof typeof gen.skills
export type TitleId = keyof typeof gen.titles
/** Emote names from src/content/emotes.ts ('surprise', 'question', …). */
export type EmoteName = Extract<keyof (typeof emotesConfig)['list'], string>
/** Weather kinds from src/content/weather.ts ('rain', 'snow', …). */
export type WeatherKind = Extract<keyof (typeof weatherConfig)['kinds'], string>
/** Stat ids from src/content/stats.ts ('hp', 'attack', …). */
export type StatId = Extract<keyof (typeof statsConfig)['stats'], string>
/** Equipment slots from src/content/stats.ts. */
export type SlotId = Extract<keyof (typeof statsConfig)['slots'], string>
/** Damage types from src/content/stats.ts `elements` ('fire', …). */
export type ElementId = Extract<keyof NonNullable<(typeof statsConfig)['elements']>, string>
/** Status ids from src/content/statuses.ts ('poison', …). */
export type StatusId = Extract<keyof typeof statusesConfig, string>
/** Named fights (src/content/troops/<id>). */
export type TroopId = keyof typeof gen.troops

export type MapDef<K extends MapId> = DefOf<(typeof gen.mapLoaders)[K]>
export type EventDef<K extends EventId> = DefOf<(typeof gen.eventLoaders)[K]>
export type MinigameDef<K extends MinigameId> = DefOf<(typeof gen.minigameLoaders)[K]>
export type WindowDef<K extends WindowId> = DefOf<(typeof gen.windowLoaders)[K]>
export type StructureDef<K extends StructureId> = DefOf<(typeof gen.structureLoaders)[K]>

export type MapParams<K extends MapId> = ParamsOf<MapDef<K>>
export type EventParams<K extends EventId> = ParamsOf<EventDef<K>>
export type MinigameParams<K extends MinigameId> = ParamsOf<MinigameDef<K>>
export type MinigameResult<K extends MinigameId> = ResultOf<MinigameDef<K>>
export type WindowParams<K extends WindowId> = ParamsOf<WindowDef<K>>

/** Every sound in src/content/audio/, e.g. 'music/town' or 'sfx/click'. */
export type AudioId = keyof typeof gen.audioFiles
type ClipOf<A> = A extends `voice/${string}/${infer Clip}` ? Clip : never
/**
 * A voice clip without its language: 'town/arrival/anna_0012' for the file
 * src/content/audio/voice/<language>/town/arrival/anna_0012.ogg.
 */
export type VoiceClipId = ClipOf<AudioId>
/** URL of each sound file. */
export const audioFiles = gen.audioFiles as Record<AudioId, string>
/** Sound id -> language -> its file in that language ("<name>.<lang>.<ext>"). */
export const audioLangs = gen.audioLangs
/** Sound id -> voice language -> its file: music/<voice language>/<name>.<ext>. */
export const audioVoiceLangs: Record<string, Record<string, string>> = gen.audioVoiceLangs

/** Every background in src/content/backgrounds/, e.g. 'school/classroom'. */
export type BackgroundId = keyof typeof gen.backgrounds
/** The named variants of a background (its index.ts `variants`; none for a plain picture). */
export type BackgroundVariantOf<K extends BackgroundId> = (typeof gen.backgrounds)[K] extends {
  variants?: Record<infer V, unknown>
}
  ? V & string
  : never
/** Background id -> its picture, or its layered picture and variants. */
export const backgrounds = gen.backgrounds as Record<string, PictureConfig>

/** Every inset in src/content/insets/ (inset()): a framed picture in the middle of the screen. */
export type InsetId = keyof typeof gen.insets
/** The named variants of an inset (its index.ts `variants`; none for a plain picture). */
export type InsetVariantOf<K extends InsetId> = (typeof gen.insets)[K] extends {
  variants?: Record<infer V, unknown>
}
  ? V & string
  : never
/** Inset id -> its picture, or its layered picture and variants. */
export const insets = gen.insets as Record<string, PictureConfig>

/** Portrait pose names of a character (from its `portraits`). */
export type PoseOf<K extends CharacterId> = PosesOf<(typeof gen.characters)[K]>
/** Layer -> option names of a character's layered portrait. */
export type CharacterPartsOf<K extends CharacterId> = PartsOf<(typeof gen.characters)[K]>
/** Map sprite animations of a character ('idle', 'walk', 'wave', …), from its `sprite`. */
export type CharacterAnimationOf<K extends CharacterId> = AnimationState<
  SpriteTagsOf<(typeof gen.characters)[K]>
>

export const characters = gen.characters
export const items = gen.items as Record<ItemId, ItemConfig>
export const quests = gen.quests as Record<QuestId, QuestDefinition>
export const props = gen.props as Record<PropId, PropDefinition>
export const gallery = gen.gallery as Record<GalleryId, GalleryConfig>
export const movies = gen.movies as Record<MovieId, MovieConfig>
export const endings = gen.endings as Record<EndingId, EndingConfig>
export const shops = gen.shops as Record<ShopId, ShopConfig>
export const achievements = gen.achievements as Record<AchievementId, AchievementConfig>
export const codex = gen.codex as Record<CodexId, CodexConfig>
export const enemies = gen.enemies as Record<EnemyId, EnemyConfig>
export const skills = gen.skills as Record<SkillId, SkillConfig>
export const troops = gen.troops as Record<TroopId, TroopConfig>
export const titles = gen.titles as Record<TitleId, TitleConfig>
/** Media files in each title screen's folder (URLs), loaded before it shows. */
export const titleAssets = gen.titleAssets as Record<TitleId, readonly string[]>

/** Step ids of a quest, in order ('find' | 'read'). */
export type QuestStepOf<K extends QuestId> = gen.QuestStepIds[K]
/** Animations of a prop ('idle', 'open', …). */
export type PropAnimationOf<K extends PropId> = AnimationState<PropTagsOf<(typeof gen.props)[K]>>

/** Ids of entries this build has: content with `only` for another content variant is left out. */
const kept = <K extends string>(all: Record<K, unknown>) =>
  (Object.keys(all) as K[]).filter((id) => !variantOff(all[id]))

/** All registered ids, e.g. for debug tools. */
export const registry = {
  maps: Object.keys(gen.mapLoaders) as MapId[],
  events: Object.keys(gen.eventLoaders) as EventId[],
  minigames: Object.keys(gen.minigameLoaders) as MinigameId[],
  windows: Object.keys(gen.windowLoaders) as WindowId[],
  structures: Object.keys(gen.structureLoaders) as StructureId[],
  characters: Object.keys(gen.characters) as CharacterId[],
  items: Object.keys(gen.items) as ItemId[],
  quests: Object.keys(gen.quests) as QuestId[],
  props: Object.keys(gen.props) as PropId[],
  gallery: kept(gen.gallery as Record<GalleryId, unknown>),
  movies: kept(gen.movies as Record<MovieId, unknown>),
  endings: kept(gen.endings as Record<EndingId, unknown>),
  shops: Object.keys(gen.shops) as ShopId[],
  achievements: kept(gen.achievements as Record<AchievementId, unknown>),
  codex: kept(gen.codex as Record<CodexId, unknown>),
  enemies: Object.keys(gen.enemies) as EnemyId[],
  skills: Object.keys(gen.skills) as SkillId[],
  troops: Object.keys(gen.troops) as TroopId[],
  titles: Object.keys(gen.titles) as TitleId[],
  langs: Object.keys(gen.langLoaders) as LangId[],
  routes: Object.keys(gen.routeLoaders) as RouteId[],
}

type Loader = () => Promise<{ default: unknown }>
const cache = new Map<string, Promise<unknown>>()
/** Entries that finished loading, for synchronous lookups (loadedTitle). */
const loaded = new Map<string, unknown>()

/** Loads an entry once and reuses the same promise afterwards (safe for React's `use`). */
function load<T>(kind: string, loaders: Record<string, Loader>, id: string): Promise<T> {
  const key = `${kind}/${id}`
  let promise = cache.get(key)
  if (!promise) {
    const loader = loaders[id]
    if (!loader) return Promise.reject(new Error(missingContentMessage(kind, id)))
    promise = loader().then((module) => {
      loaded.set(key, module.default)
      return module.default
    })
    promise.catch(() => cache.delete(key))
    cache.set(key, promise)
  }
  return promise as Promise<T>
}

/** The `title` of a map or event that has already loaded (the one running now always has). */
export function loadedTitle(kind: 'maps' | 'events', id: string): string | undefined {
  const entry = loaded.get(`${kind}/${id}`) as { title?: unknown } | undefined
  return typeof entry?.title === 'string' ? entry.title : undefined
}

/** An entry that finished loading (synchronous), or undefined. */
export function loadedEntry(kind: 'maps' | 'events', id: string): unknown {
  return loaded.get(`${kind}/${id}`)
}

export const loadMap = <K extends MapId>(id: K) => load<MapDef<K>>('maps', gen.mapLoaders, id)
export const loadEvent = <K extends EventId>(id: K) =>
  load<EventDef<K>>('events', gen.eventLoaders, id)

/** Pictures an event uses, in script order (added to every event module by vite/media). */
export type EventMedia =
  | { kind: 'image'; url: string }
  | { kind: 'cg'; id: string; variant?: string }
  | { kind: 'bg'; id: string; variant?: string }
  | { kind: 'inset'; id: string; variant?: string }
  | { kind: 'character'; id: string }

export async function loadEventMedia(id: EventId): Promise<readonly EventMedia[]> {
  const loader = (gen.eventLoaders as Record<string, () => Promise<{ __media?: EventMedia[] }>>)[id]
  return (await loader?.())?.__media ?? []
}
export const loadMinigame = <K extends MinigameId>(id: K) =>
  load<MinigameDef<K>>('minigames', gen.minigameLoaders, id)
export const loadWindow = <K extends WindowId>(id: K) =>
  load<WindowDef<K>>('windows', gen.windowLoaders, id)
export const loadStructure = <K extends StructureId>(id: K) =>
  load<StructureDef<K>>('structures', gen.structureLoaders, id)

// biome-ignore lint/suspicious/noExplicitAny: language files are loaded by code, any shape is checked there
export const loadLang = (id: LangId) => load<any>('lang', gen.langLoaders, id)

// ---------------------------------------------------------------- hot updates (dev server)

type HotListener = (kind: string, id: string) => void
const hotListeners = new Set<HotListener>()

/** Dev: called after a content entry was hot-updated (see vite/hot.ts). Returns an unsubscribe. */
export function onHotUpdate(listener: HotListener): () => void {
  hotListeners.add(listener)
  return () => hotListeners.delete(listener)
}

if (import.meta.env.DEV) {
  ;(globalThis as { __gameHot?: unknown }).__gameHot = (
    kind: string,
    id: string,
    value: unknown,
  ) => {
    // Later loads get the new module; listeners refresh whatever is on screen.
    cache.set(`${kind}/${id}`, Promise.resolve(value))
    for (const listener of hotListeners) listener(kind, id)
  }
}

/** A route (src/content/routes/<id>/index.ts). */
export const loadRoute = (id: RouteId) =>
  load<RouteConfig>('routes', gen.routeLoaders as Record<string, Loader>, id)

/** A route's flow.ts, or null when it has none. */
export function loadFlow(id: RouteId): Promise<FlowDefinition | null> {
  const loaders = gen.routeFlowLoaders as Record<string, Loader>
  return loaders[id] ? load<FlowDefinition>('flows', loaders, id) : Promise.resolve(null)
}
