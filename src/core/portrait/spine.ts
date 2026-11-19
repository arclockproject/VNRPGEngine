// Spine portraits: a character animated with a Spine export (the editor's Export: a skeleton .skel
// or .json, its .atlas and page images). The Vite plugin (vite/spine) turns each export into a
// <name>.gen.ts with its files and the typed names of its animations and skins; fromSpine() says
// which animation is which pose, the mouth while talking, blinking, and which skins are parts.
//
// Core code may only import TYPES from this file (it holds the lazy import of the runtime, and a
// value import would put the runtime into every build). The Spine runtime is never imported here: each portrait carries a load() that imports it the
// first time the portrait is shown. A game with no Spine character never ships the runtime.
// Using the Spine runtime in a game needs a Spine Editor licence (see the guide).
import type { FaceArea } from './define'

/** A box in Spine units (y up from the skeleton's root): x / y = its lower left corner. */
export interface SpineBox {
  x: number
  y: number
  width: number
  height: number
}

/** One Spine export, as written by vite/spine into <name>.gen.ts. */
export interface SpineExport<A extends string = string, S extends string = string> {
  /** The Spine version it was exported with. */
  version: string
  /** URL of the skeleton (.skel binary or .json). */
  skeleton: string
  binary: boolean
  /** URL of the .atlas file. */
  atlas: string
  /** Page image name in the .atlas -> its URL. */
  pages: Record<string, string>
  animations: readonly A[]
  skins: readonly S[]
  /** Every animation and skin fits in this box. */
  box: SpineBox
}

/** Used by the generated <name>.gen.ts files only. */
export function defineSpineExport<const A extends string, const S extends string>(
  data: SpineExport<A, S>,
): SpineExport<A, S> {
  return data
}

declare const spinePartsType: unique symbol

/** A built Spine portrait. `E` = expression (pose) names, `P` = part name -> option names. */
export interface SpinePortrait<E extends string = string, P = Record<string, string>> {
  kind: 'spine'
  data: SpineExport
  /** Portrait size in portrait pixels (= Spine units of `box`). */
  width: number
  height: number
  /** What is drawn, in Spine units. */
  box: SpineBox
  expressions: Record<
    E,
    { intro?: string; animation: string; loop: boolean; parts: Record<string, string | null> }
  >
  /** Part -> option -> its skins (none = nothing). */
  parts: Record<string, Record<string, readonly string[]>>
  /** Part -> option shown when nothing else picks one. */
  defaults: Record<string, string | null>
  talk?: { animation: string }
  blink?: { animation: string; everyMs: [number, number] }
  /** Crossfade between animations, in seconds. */
  mix: number
  /** Own crossfade for a pair: 'from>to' -> seconds. */
  mixes: Record<string, number>
  faceArea?: FaceArea
  faceAreas?: Partial<Record<E, FaceArea>>
  /** Loads the Spine runtime (once) and returns it. */
  load: () => Promise<typeof import('./spineRuntime')>
  /** Type-only: part names, for show('driver', { parts: { hat: 'party' } }). */
  readonly [spinePartsType]?: P
}

type PartChoice<L> = { [K in keyof L]?: (keyof L[K] & string) | null }

/**
 * A Spine portrait from an export (`import driver from './spine/driver.gen'`).
 * - expressions: pose name -> animation (looping), or { intro, animation, loop, parts }. The first is
 *   the default pose. Pose names are what show('driver', { pose }) and `driver:happy:` take.
 *   intro: an animation played once first, then `animation` loops ("1 2 3 4 5 6 7 5 6 7…": make
 *   1-4 the intro and 5-7 the loop in Spine). They join without a crossfade unless mixes sets one.
 * - mix: crossfade in seconds whenever the animation changes (default 0.2): every bone eases from
 *   where it is into the new animation. mixes: its own time for one pair, { 'idle>wave': 0.4 }.
 * - parts: changeable pieces made of skins, e.g. { hat: { cap: 'hat/cap', none: null } }.
 *   A skin can hold any number of attachments (meshes too) in any slots, so one option can be a
 *   whole outfit. An option can also be several skins: { winter: ['outfit/coat', 'acc/scarf'] }.
 *   The export's "default" skin is always on; parts add theirs on top.
 * - talk: an animation laid over the pose while their line types (or their voice plays).
 * - blink: an animation laid over now and then (every 2-6 s, or everyMs).
 * - box: what is drawn, in Spine units (default: the generated box, where every animation fits).
 * - faceArea: where the face is (side image, Settings → Voices), in portrait pixels from the box's
 *   top left corner. Per pose: faceAreas.
 */
export function fromSpine<
  A extends string,
  S extends string,
  const E extends string,
  const L extends Record<
    string,
    Record<string, NoInfer<S> | readonly NoInfer<S>[] | null>
  > = Record<never, never>,
>(
  data: SpineExport<A, S>,
  options: {
    expressions: Record<
      E,
      | NoInfer<A>
      | { intro?: NoInfer<A>; animation: NoInfer<A>; loop?: boolean; parts?: PartChoice<L> }
    >
    parts?: L
    defaults?: { parts?: PartChoice<L> }
    talk?: NoInfer<A>
    blink?: NoInfer<A> | { animation: NoInfer<A>; everyMs?: [number, number] }
    mix?: number
    mixes?: Partial<Record<`${NoInfer<A>}>${NoInfer<A>}`, number>>
    box?: SpineBox
    faceArea?: FaceArea
    faceAreas?: Partial<Record<E, FaceArea>>
  },
): SpinePortrait<E, { [K in keyof L]: keyof L[K] & string }> {
  const box = options.box ?? data.box
  const expressions = {} as SpinePortrait<E>['expressions']
  for (const [name, value] of Object.entries(options.expressions) as [
    E,
    A | { intro?: A; animation: A; loop?: boolean; parts?: PartChoice<L> },
  ][]) {
    expressions[name] =
      typeof value === 'string'
        ? { animation: value, loop: true, parts: {} }
        : {
            ...(value.intro ? { intro: value.intro } : {}),
            animation: value.animation,
            loop: value.loop ?? true,
            parts: (value.parts ?? {}) as Record<string, string | null>,
          }
  }
  const parts: Record<string, Record<string, readonly string[]>> = {}
  for (const [part, choices] of Object.entries(options.parts ?? {}) as [
    string,
    Record<string, string | readonly string[] | null>,
  ][]) {
    parts[part] = {}
    for (const [option, skins] of Object.entries(choices))
      (parts[part] as Record<string, readonly string[]>)[option] =
        skins === null ? [] : typeof skins === 'string' ? [skins] : skins
  }
  const defaults: Record<string, string | null> = {}
  for (const [part, choices] of Object.entries(parts))
    defaults[part] = Object.keys(choices)[0] ?? null
  Object.assign(defaults, options.defaults?.parts ?? {})
  const blink =
    options.blink === undefined
      ? undefined
      : typeof options.blink === 'string'
        ? { animation: options.blink, everyMs: [2000, 6000] as [number, number] }
        : { animation: options.blink.animation, everyMs: options.blink.everyMs ?? [2000, 6000] }
  return {
    kind: 'spine',
    data,
    width: box.width,
    height: box.height,
    box,
    expressions,
    parts,
    defaults,
    ...(options.talk ? { talk: { animation: options.talk } } : {}),
    ...(blink ? { blink } : {}),
    mix: options.mix ?? 0.2,
    mixes: (options.mixes ?? {}) as Record<string, number>,
    ...(options.faceArea ? { faceArea: options.faceArea } : {}),
    ...(options.faceAreas ? { faceAreas: options.faceAreas } : {}),
    load: () => import('./spineRuntime'),
  } as SpinePortrait<E, { [K in keyof L]: keyof L[K] & string }>
}

/** Which option each part shows: defaults, then the pose's own, then what show() set. */
export function spineParts(
  portrait: SpinePortrait,
  pose: string | null,
  parts: Record<string, string | null> | undefined,
): Record<string, string | null> {
  const first = Object.keys(portrait.expressions)[0]
  const expression =
    portrait.expressions[pose ?? first ?? ''] ?? (first ? portrait.expressions[first] : undefined)
  return { ...portrait.defaults, ...(expression?.parts ?? {}), ...(parts ?? {}) }
}
