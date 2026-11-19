// The stage (background, characters, pictures, weather, filter, fade colour) as plain data. While a
// route plays (VN mode), one event's stage carries into the next until a script changes it, and
// saves and flowchart jumps put it back. Outside a route every event starts on an empty stage.
import { cgPicture, type GalleryConfig, type StackedPicture } from '../gallery'
import { lang } from '../lang'
import { backgrounds, gallery, insets } from '../registry'
import { useSystemStore } from '../stores/system'
import {
  type ActorFx,
  getActorFx,
  placeActor,
  setActorFx,
  setVeilState,
  veilState,
} from './effects'
import type { SceneState } from './state'

/** How the background was chosen, so a saved stage finds the picture again after an update. */
export type BackgroundRef = { kind: 'bg' | 'cg'; id: string; variant?: string }

export interface Stage {
  background: string | StackedPicture | null
  backgroundRef?: BackgroundRef | null
  /** inset(): which picture (found again by its id after an update). */
  inset?: { id: string; variant?: string } | null
  actors: SceneState['actors']
  /** Where each character stands (animate() / show() offsets), by id. */
  places?: Record<string, ActorFx>
  filter: SceneState['filter']
  /** filter(…, { on: 'background' | 'characters' }). */
  partFilters?: SceneState['partFilters']
  images: SceneState['images']
  weather: SceneState['weather']
  /** The fade() colour over the stage, when there is one. */
  veil?: { r: number; g: number; b: number; opacity: number }
}

/** The stage on screen now. */
export function captureStage(): Stage {
  const { background, backgroundRef, actors, filter, partFilters, images, weather, inset } =
    useSystemStore.getState().scene
  const places: Record<string, ActorFx> = {}
  for (const actor of actors) {
    const fx = getActorFx(actor.id)
    if (fx) places[actor.id] = { ...fx }
  }
  const veil = veilState()
  return {
    background,
    ...(backgroundRef ? { backgroundRef } : {}),
    ...(inset
      ? { inset: { id: inset.id, ...(inset.variant ? { variant: inset.variant } : {}) } }
      : {}),
    actors,
    ...(Object.keys(places).length > 0 ? { places } : {}),
    filter,
    ...(partFilters.background || partFilters.characters ? { partFilters } : {}),
    images: images.filter((image) => !image.leaving),
    weather,
    ...(veil.opacity > 0.001 ? { veil } : {}),
  }
}

/** A stage with nothing on it? */
export function isEmptyStage(stage: Stage | null | undefined): boolean {
  return (
    !stage ||
    (stage.background === null &&
      stage.actors.length === 0 &&
      !stage.inset &&
      stage.images.length === 0 &&
      stage.filter === null &&
      !stage.partFilters?.background &&
      !stage.partFilters?.characters &&
      stage.weather === null &&
      !stage.veil)
  )
}

/** The picture a saved background stands for today (a file may have moved since the save). */
function backgroundOf(stage: Stage): Stage['background'] {
  const ref = stage.backgroundRef
  if (ref?.kind === 'bg') {
    const config = backgrounds[ref.id]
    if (config) return cgPicture(config, ref.variant, lang.current())
  } else if (ref?.kind === 'cg') {
    const picture = (gallery as Record<string, GalleryConfig>)[ref.id]
    if (picture) return cgPicture(picture, ref.variant, lang.current())
  }
  return stage.background
}

/** The inset a saved stage names, drawn as its picture is today (null when it is gone). */
function insetOf(saved: Stage['inset']): SceneState['inset'] {
  const config = saved ? insets[saved.id] : undefined
  if (!saved || !config) return null
  return { ...saved, picture: cgPicture(config, saved.variant, lang.current()) }
}

/** Puts a stage on screen at once (no fades), or clears it (null). Lines and choices stay. */
export function applyStage(stage: Stage | null | undefined): void {
  const actors = stage?.actors ?? []
  useSystemStore.setState((s) => {
    s.scene.background = stage ? backgroundOf(stage) : null
    s.scene.backgroundRef = stage?.backgroundRef ?? null
    s.scene.backgroundFade = 0
    s.scene.backgroundTransition = null
    s.scene.inset = insetOf(stage?.inset)
    s.scene.insetFade = 0
    s.scene.actors = actors
    s.scene.filter = stage?.filter ?? null
    s.scene.partFilters = stage?.partFilters ?? { background: null, characters: null }
    s.scene.images = stage?.images ?? []
    s.scene.weather = stage?.weather ?? null
  })
  for (const actor of actors) {
    const place = stage?.places?.[actor.id]
    if (place) setActorFx(actor.id, place)
    else placeActor(actor.id, actor.at, true)
  }
  setVeilState(stage?.veil ?? null)
}
