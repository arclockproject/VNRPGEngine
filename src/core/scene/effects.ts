// Event effects: animate portraits, zoom/pan the camera, shake, flash and fade.
// Values live here (not in React state) and are written straight to the DOM every frame.

import screen from '@/content/config/screen'
import scenes from '@/content/scenes'
import { input } from '../input/manager'
import { type CharacterId, characters } from '../registry'
import { useSettingsStore } from '../stores/settings'
import { finishTweens, stopTweens, type Tween, type TweenOptions, tween } from '../tween'
import { isUnderCard } from './chapterCard'
import { parseColor } from './color'
import { isSkippingEffects, usePlaybackStore } from './playback'
import { isFastForward } from './replay'
import type { ActorAnimation, CameraTarget, StagePosition } from './types'

/** Stage positions as % of the screen width (src/content/scenes.ts `stage.positions`). */
export const STAGE_X: Record<StagePosition, number> = scenes.stage.positions

/** Where a character stands when show() names no place: `center`, else the first position. */
export function defaultStagePosition(): StagePosition {
  const names = Object.keys(STAGE_X) as StagePosition[]
  return names.includes('center' as StagePosition)
    ? ('center' as StagePosition)
    : (names[0] as StagePosition)
}

/** Stage pixels (pixels on a `designHeight`-tall screen) as CSS that scales with the game screen. */
export function stagePx(n: number): string {
  return `${(n * 100) / screen.stage.designHeight}cqh`
}

// ---------------------------------------------------------------- portrait framing

/** A character file's `stage` (how its portrait stands). */
export interface PortraitStage {
  show?: readonly [number, number]
  scale?: number
  x?: number
  y?: number
}

/** A part of a portrait picture, top to bottom (0..1), made sane: from < to, at least 5%. */
export function clampFrame(frame: readonly [number, number]): [number, number] {
  const from = Math.min(Math.max(frame[0], 0), 0.95)
  return [from, Math.min(Math.max(frame[1], from + 0.05), 1)]
}

/** The part of the picture that fills the portrait height: the character's own, else the game's. */
export function baseFrame(stage: PortraitStage | undefined): [number, number] {
  return clampFrame(stage?.show ?? screen.stage.show ?? [0, 1])
}

const stageOf = (id: CharacterId) =>
  (characters as Record<string, { stage?: PortraitStage }>)[id]?.stage

/**
 * show() / animate() `frame`: the scale and y (stage pixels) that make `frame` (a part of the
 * picture, top to bottom) fill the character's normal portrait height, its bottom on the screen's
 * bottom edge. [0.65, 1] = the legs only; [0, 0.35] = the face. Same-sized parts = the same scale,
 * so animating from one to the other pans along the body.
 */
export function frameFx(
  id: CharacterId,
  frame: readonly [number, number],
): { scale: number; y: number } {
  const stage = stageOf(id)
  const [from, to] = baseFrame(stage)
  const [wantFrom, wantTo] = clampFrame(frame)
  const scale = (to - from) / (wantTo - wantFrom)
  // The whole picture's height in stage pixels at scale 1: measured when it is drawn (a width
  // limit may have shrunk it), else worked out like Actor.tsx does.
  const picture = actorElements.get(id)?.querySelector<HTMLElement>('[data-portrait-frame] > *')
  const screenHeight = document.getElementById('game-screen')?.clientHeight ?? 0
  const designHeight = screen.stage.designHeight
  const height =
    picture && picture.offsetHeight > 0 && screenHeight > 0
      ? (picture.offsetHeight / screenHeight) * designHeight
      : (((screen.stage.portraitHeight * (stage?.scale ?? 1)) / (to - from)) * designHeight) / 100
  // Scaled from the screen's bottom edge (where `to` stands), then moved so `wantTo` stands there.
  return { scale, y: (to - wantTo) * height * scale }
}

// ---------------------------------------------------------------- portraits

export interface ActorFx {
  /** Centre, in % of the screen width. */
  x: number
  /** Extra horizontal stage pixels on top of `x` (negative = left). */
  offsetX: number
  /** Stage pixels, negative = up. */
  y: number
  scale: number
  /** Degrees. */
  rotate: number
  opacity: number
}

const actorFx = new Map<CharacterId, ActorFx>()
const actorElements = new Map<CharacterId, HTMLElement>()

export function actorTransform(fx: ActorFx) {
  return `translateX(calc(${fx.x}cqw - 50% + ${stagePx(fx.offsetX)})) translateY(${stagePx(fx.y)}) rotate(${fx.rotate}deg) scale(${fx.scale})`
}

function applyActor(id: CharacterId) {
  const el = actorElements.get(id)
  const fx = actorFx.get(id)
  if (!el || !fx) return
  el.style.transform = actorTransform(fx)
  el.style.opacity = String(fx.opacity)
}

/** Current values for a shown character (used by the UI when it renders). */
export function getActorFx(id: CharacterId): ActorFx | undefined {
  return actorFx.get(id)
}

/** The UI registers each portrait element so tweens can move it. */
export function registerActor(id: CharacterId, el: HTMLElement | null) {
  if (el) {
    actorElements.set(id, el)
    applyActor(id)
  } else {
    actorElements.delete(id)
  }
}

/** Called by show(): places a new character (fading in) or slides an existing one. */
export function placeActor(
  id: CharacterId,
  at: StagePosition,
  isNew: boolean,
  /** Set right away (no animation), e.g. start small and far away: { scale: 0.4, y: -120 }. */
  initial: { scale?: number; y?: number; offsetX?: number } = {},
  /** A named distance: a new character starts there, one already on stage steps there. */
  distance?: { scale?: number; y?: number },
) {
  const x = STAGE_X[at] ?? 50
  let fx = actorFx.get(id)
  if (!fx || isNew) {
    fx = {
      x,
      offsetX: initial.offsetX ?? 0,
      y: initial.y ?? distance?.y ?? 0,
      scale: initial.scale ?? distance?.scale ?? 1,
      rotate: 0,
      opacity: 0,
    }
    actorFx.set(id, fx)
    void sceneTween(fx, { opacity: 1 }, { duration: scenes.stage.fadeInMs, ease: 'quadOut' }, () =>
      applyActor(id),
    )
    return
  }
  if (distance) {
    const step: Partial<ActorFx> = {}
    if (initial.scale === undefined && distance.scale !== undefined) step.scale = distance.scale
    if (initial.y === undefined && distance.y !== undefined) step.y = distance.y
    if (Object.keys(step).length > 0)
      void sceneTween(fx, step, { duration: scenes.stage.distanceMs, ease: 'quadOut' }, () =>
        applyActor(id),
      )
  }
  // Explicit size/offsets jump there right away; use animate() for a smooth change.
  const jump: Partial<ActorFx> = {}
  if (initial.scale !== undefined) jump.scale = initial.scale
  if (initial.y !== undefined) jump.y = initial.y
  if (initial.offsetX !== undefined) jump.offsetX = initial.offsetX
  if (Object.keys(jump).length > 0) void sceneTween(fx, jump, { duration: 0 }, () => applyActor(id))
  if (fx.x !== x) {
    void sceneTween(fx, { x }, { duration: scenes.stage.slideMs, ease: 'cubicInOut' }, () =>
      applyActor(id),
    )
  }
}

/** Puts a character exactly where it was (a carried or saved stage): no fade, no slide. */
export function setActorFx(id: CharacterId, fx: ActorFx) {
  const current = actorFx.get(id)
  if (current) stopTweens(current)
  actorFx.set(id, { ...fx })
  applyActor(id)
}

export function removeActor(id: CharacterId) {
  const fx = actorFx.get(id)
  if (fx) stopTweens(fx)
  actorFx.delete(id)
}

export async function animate(who: CharacterId, to: ActorAnimation, options?: TweenOptions) {
  const fx = actorFx.get(who)
  if (!fx) {
    console.warn(`[events] animate("${who}"): show() them first`)
    return
  }
  const { x, frame, ...rest } = to
  // `frame` is a scale and y; a `scale` / `y` given too wins.
  const target: Partial<ActorFx> = { ...(frame ? frameFx(who, frame) : {}), ...rest }
  if (x !== undefined) target.x = typeof x === 'string' ? STAGE_X[x] : x
  await sceneTween(fx, target, options, () => applyActor(who)).done
}

/** One step of a named move (src/content/scenes.ts `moves`), relative to `start`. */
export interface MoveStepLike {
  offsetX?: number
  y?: number
  scale?: number
  rotate?: number
  opacity?: number
  duration?: number
  ease?: string
}

/** Plays a named move: each step is relative to how the character stood when it began. */
export async function playMove(who: CharacterId, steps: readonly MoveStepLike[]) {
  const fx = actorFx.get(who)
  if (!fx) {
    console.warn(`[events] move("${who}"): show() them first`)
    return
  }
  const start = { ...fx }
  for (const step of steps) {
    const target: Partial<ActorFx> = {
      offsetX: start.offsetX + (step.offsetX ?? 0),
      y: start.y + (step.y ?? 0),
      scale: start.scale * (step.scale ?? 1),
      rotate: start.rotate + (step.rotate ?? 0),
      opacity: step.opacity ?? start.opacity,
    }
    await sceneTween(
      fx,
      target,
      { duration: step.duration ?? 150, ease: (step.ease ?? 'quadInOut') as TweenOptions['ease'] },
      () => applyActor(who),
    ).done
    // Hidden or replaced meanwhile: stop.
    if (actorFx.get(who) !== fx) return
  }
}

// ---------------------------------------------------------------- camera

/** zoom 1 = normal. x / y = the point (in % of the screen) shown in the centre. */
const camera = { zoom: 1, x: 50, y: 50, shakeX: 0, shakeY: 0 }
const cameraTargets = new Set<HTMLElement>()

function applyCamera() {
  const { zoom, x, y, shakeX, shakeY } = camera
  const idle = zoom === 1 && x === 50 && y === 50 && shakeX === 0 && shakeY === 0
  // Scale around the top left, then move so point (x, y) lands in the middle of the screen.
  const transform = idle
    ? ''
    : `translate(calc(${50 - zoom * x}cqw + ${stagePx(shakeX)}), calc(${50 - zoom * y}cqh + ${stagePx(shakeY)})) scale(${zoom})`
  for (const el of cameraTargets) {
    el.style.transformOrigin = '0 0'
    el.style.transform = transform
  }
}

/** Layers that move with the camera (the map and the event stage) register here. */
export function registerCameraTarget(el: HTMLElement | null) {
  if (!el) return () => {}
  cameraTargets.add(el)
  applyCamera()
  return () => {
    cameraTargets.delete(el)
    el.style.transform = ''
  }
}

export async function moveCamera(to: CameraTarget, options?: TweenOptions) {
  const target: Partial<typeof camera> = {}
  if (to.zoom !== undefined) target.zoom = to.zoom
  if (to.focus !== undefined) {
    if (typeof to.focus === 'string') {
      const fx = actorFx.get(to.focus)
      if (!fx) console.warn(`[events] camera focus "${to.focus}": show() them first`)
      target.x = fx?.x ?? 50
      target.y = 45 // portraits: aim a little above the middle (faces)
    } else {
      target.x = to.focus.x
      target.y = to.focus.y
    }
  }
  await sceneTween(camera, target, { duration: 600, ease: 'cubicInOut', ...options }, applyCamera)
    .done
}

// Every shake is a "quake": its strength times its amount (1 = full, 0 = gone). The jitter is the
// sum of all quakes, re-rolled once per frame by one shared tween while any quake is alive.
interface Quake {
  strength: number
  amount: number
}
const quakes = new Set<Quake>()
const quakeClock = { t: 0 }
let quakeLoop: Tween | undefined
/** The open-ended shake from startShake(), if one is running. */
let ongoing: Quake | undefined

function applyQuakes() {
  let strength = 0
  for (const q of quakes) strength += q.strength * q.amount
  camera.shakeX = (Math.random() * 2 - 1) * strength
  camera.shakeY = (Math.random() * 2 - 1) * strength
  applyCamera()
}

function addQuake(strength: number): Quake {
  const q = { strength, amount: 1 }
  quakes.add(q)
  // Duration Infinity: the clock never ends by itself, it only fires onUpdate every frame.
  quakeLoop ??= tween(quakeClock, { t: 1 }, { duration: Number.POSITIVE_INFINITY }, applyQuakes)
  return q
}

function endQuakes() {
  quakes.clear()
  quakeLoop?.stop()
  quakeLoop = undefined
  ongoing = undefined
  camera.shakeX = 0
  camera.shakeY = 0
  applyCamera()
}

function dropQuake(q: Quake) {
  quakes.delete(q)
  if (quakes.size === 0) endQuakes()
}

/** Settings → "Reduce shaking and flashes". */
const reducedMotion = () => useSettingsStore.getState().reduceMotion

/** A shake is also felt: controller rumble, or a short buzz on a phone (src/content/scenes.ts). */
function rumbleFor(strength: number, duration: number) {
  if (!scenes.rumble.onShake || isFastForward()) return
  input.rumble({ strength: Math.min(1, (strength / 10) * scenes.rumble.strength), duration })
}

/** Shakes for `duration` ms, then stops by itself: `await shake({ strength: 6, duration: 250 })`. */
export async function shake({ strength = 10, duration = 400 } = {}) {
  if (isSkippingEffects()) return
  rumbleFor(strength, duration)
  if (reducedMotion()) return
  const q = addQuake(strength)
  await sceneTween(q, { amount: 0 }, { duration, ease: 'quadOut' }).done
  dropQuake(q)
}

/**
 * Starts a shake that goes on until stopShake(), e.g. an earthquake while lines are spoken.
 * Calling it again changes the strength. Several shakes (timed or not) add up.
 */
export function startShake(strength = 10) {
  if (isSkippingEffects()) return
  if (!ongoing) rumbleFor(strength, 300)
  if (reducedMotion()) return
  if (ongoing) {
    ongoing.strength = strength
    return
  }
  ongoing = addQuake(strength)
}

/** Eases the startShake() out over `duration` ms (default 300). Resolves when it is gone. */
export async function stopShake(duration = 300) {
  const q = ongoing
  ongoing = undefined
  if (!q) return
  await sceneTween(q, { amount: 0 }, { duration, ease: 'quadIn' }).done
  dropQuake(q)
}

// ---------------------------------------------------------------- flash / fade

// The colour layer for flash() and fade(): colour and opacity are tweened as plain numbers, so a
// fade can change colour smoothly (e.g. grey to white).
const veil = { r: 0, g: 0, b: 0, opacity: 0 }
let veilElement: HTMLElement | null = null

function applyVeil() {
  if (!veilElement) return
  const { r, g, b, opacity } = veil
  veilElement.style.backgroundColor = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
  veilElement.style.opacity = String(opacity)
}

/** The UI registers the full-screen colour layer used by flash() and fade(). */
export function registerVeil(el: HTMLElement | null) {
  veilElement = el
  applyVeil()
}

/** Flashes a colour, then goes back to what the veil showed before (a fade stays in place). */
export async function flash(color = '#ffffff', duration = 250) {
  // "Reduce shaking and flashes": a soft, slower fade instead of a hard flash (or nothing).
  const soft = reducedMotion()
  const peak = soft ? scenes.comfort.reducedFlash : 1
  if (peak <= 0) return
  const before = { ...veil }
  // Over a fade that is already stronger, a soft flash would only dim the screen.
  if (soft && before.opacity >= peak) return
  const c = parseColor(color)
  Object.assign(veil, { r: c.r, g: c.g, b: c.b })
  const rise = soft ? Math.max(duration * 0.5, 200) : duration * 0.25
  await sceneTween(veil, { opacity: peak }, { duration: rise, ease: 'quadOut' }, applyVeil).done
  await sceneTween(
    veil,
    { opacity: before.opacity, r: before.r, g: before.g, b: before.b },
    { duration: duration * 0.75, ease: 'quadIn' },
    applyVeil,
  ).done
}

/**
 * Fades to a colour and keeps it. Calling it again with another colour crossfades (colour and
 * opacity move together). fade(null) fades the colour layer away.
 */
export async function fade(color: string | null, duration = 500) {
  if (color === null) {
    await sceneTween(veil, { opacity: 0 }, { duration, ease: 'sineInOut' }, applyVeil).done
    return
  }
  const c = parseColor(color)
  // Nothing visible yet: start from the new colour, so it doesn't fade up from the old one.
  if (veil.opacity < 0.01) Object.assign(veil, { r: c.r, g: c.g, b: c.b })
  await sceneTween(
    veil,
    { r: c.r, g: c.g, b: c.b, opacity: c.a },
    { duration, ease: 'sineInOut' },
    applyVeil,
  ).done
}

// ---------------------------------------------------------------- reset

/** Puts everything back after an event. */
/**
 * Back to normal after an event: camera, shakes, and (unless `keepStage`) the characters' places and
 * the fade colour. A route keeps the stage from one event to the next (scene/stage.ts).
 */
export function resetEffects({ keepStage = false } = {}) {
  if (keepStage) {
    // Moves still running land where they were going.
    for (const fx of actorFx.values()) finishTweens(fx)
  } else {
    for (const fx of actorFx.values()) stopTweens(fx)
    actorFx.clear()
  }
  stopTweens(camera)
  endQuakes()
  Object.assign(camera, { zoom: 1, x: 50, y: 50, shakeX: 0, shakeY: 0 })
  applyCamera()
  if (keepStage) finishTweens(veil)
  else {
    stopTweens(veil)
    veil.opacity = 0
    applyVeil()
  }
}

/** The fade colour over the stage (fade()), to carry or save it. */
export function veilState(): { r: number; g: number; b: number; opacity: number } {
  return { ...veil }
}

export function setVeilState(state: { r: number; g: number; b: number; opacity: number } | null) {
  stopTweens(veil)
  Object.assign(veil, state ?? { opacity: 0 })
  applyVeil()
}

// ---------------------------------------------------------------- skipping

/** Scene tweens: instant while skipping (see playback.ts) or under a chapter card, else tweened. */
function sceneTween<T extends { [K in keyof T]: number }>(
  object: T,
  to: Partial<T>,
  options: TweenOptions = {},
  onUpdate?: (target: T) => void,
) {
  // Under a chapter card nobody sees it: at once too.
  const timed =
    isSkippingEffects() || isUnderCard()
      ? { ...options, duration: 0, delay: 0, repeat: 0 }
      : options
  return tween(object, to, timed, onUpdate)
}

/** Jumps every running scene effect to its end (used when skipping starts). */
export function finishSceneEffects() {
  finishTweens(veil)
  finishTweens(camera)
  endQuakes()
  for (const fx of actorFx.values()) finishTweens(fx)
}

usePlaybackStore.subscribe((state, previous) => {
  if (state.active && !previous.active && isSkippingEffects()) finishSceneEffects()
})
