// The Spine runtime side of Spine portraits. Only ever loaded through a portrait's load() (see
// spine.ts), so a game without Spine characters never ships @esotericsoftware/spine-pixi-v8.
//
// Exports load the way the Spine runtime documents it: the skeleton and the .atlas go through
// Pixi's Assets with the runtime's own loaders, the .atlas pages by their names in the atlas
// (`data.images`, because the build renames files), then Spine.from().
//
// One hidden WebGL renderer draws every Spine portrait on screen, each into its own plain 2D
// canvas, once per frame. One WebGL context however many characters are shown, and the pictures
// are ordinary canvases (screenshots and save pictures copy them like any other).
import { Skin, Spine } from '@esotericsoftware/spine-pixi-v8'
import { Assets, autoDetectRenderer, type Renderer, Ticker } from 'pixi.js'
import type { FaceArea } from './define'
import { type SpineExport, type SpinePortrait, spineParts } from './spine'

let renderer: Renderer | null = null
let rendererLoading: Promise<Renderer> | null = null
function getRenderer(): Promise<Renderer> {
  rendererLoading ??= autoDetectRenderer({
    preference: 'webgl',
    width: 256,
    height: 256,
    backgroundAlpha: 0,
    antialias: true,
    resolution: 1,
  }).then((made) => {
    renderer = made
    return made
  })
  return rendererLoading
}

/** Each export is added to Assets once, under its own aliases. */
const exports = new Map<SpineExport, Promise<{ skeleton: string; atlas: string }>>()
let nextId = 0
function loadExport(data: SpineExport) {
  let loading = exports.get(data)
  if (!loading) {
    const id = nextId++
    const skeleton = `spine:${id}:skeleton`
    const atlas = `spine:${id}:atlas`
    Assets.add({
      alias: skeleton,
      src: data.skeleton,
      // Set by hand: a small file may be inlined into a data: URL that has no file extension.
      parser: data.binary ? 'spineSkeletonLoader' : 'loadJson',
    })
    Assets.add({
      alias: atlas,
      src: data.atlas,
      parser: 'spineTextureAtlasLoader',
      data: { images: data.pages },
    })
    loading = Assets.load([skeleton, atlas]).then(() => ({ skeleton, atlas }))
    exports.set(data, loading)
  }
  return loading
}

/** One portrait on screen. */
export interface SpineHandle {
  /** Where it is drawn. Its pixel size is set by the view. */
  setCanvas(canvas: HTMLCanvasElement | null): void
  /** Draw only this part of the portrait (portrait pixels), e.g. the face. Null = all of it. */
  setCrop(crop: FaceArea | null): void
  setPose(pose: string | null, parts?: Record<string, string | null>): void
  setTalking(talking: boolean): void
  destroy(): void
}

interface Live {
  spine: Spine
  draw: () => void
}
const live = new Set<Live>()
let ticker: Ticker | null = null

function startLoop() {
  if (ticker) return
  ticker = new Ticker()
  ticker.add(() => {
    const seconds = Math.min(0.1, (ticker?.deltaMS ?? 16) / 1000)
    for (const entry of live) {
      entry.spine.update(seconds)
      entry.draw()
    }
  })
  ticker.start()
}

function stopLoopIfIdle() {
  if (live.size > 0 || !ticker) return
  ticker.destroy()
  ticker = null
}

export async function createSpineHandle(portrait: SpinePortrait): Promise<SpineHandle> {
  const [names] = await Promise.all([loadExport(portrait.data), getRenderer()])
  const spine = Spine.from({ ...names, autoUpdate: false })
  const { skeleton, state } = spine
  state.data.defaultMix = portrait.mix
  for (const [pair, seconds] of Object.entries(portrait.mixes)) {
    const [from, to] = pair.split('>')
    if (from && to) state.data.setMix(from, to, seconds)
  }
  const box = portrait.box

  let canvas: HTMLCanvasElement | null = null
  let crop: FaceArea | null = null
  let pose: string | null = null
  let skinKey = ''
  let talking = false
  let blinkTimer: ReturnType<typeof setTimeout> | undefined
  let gone = false

  /** Back to what the pose shows, after an overlay (talk, blink) ends. */
  const settle = () => {
    skeleton.setupPoseSlots()
    state.apply(skeleton)
  }

  const setSkins = (chosen: Record<string, string | null>) => {
    const names = Object.entries(chosen).flatMap(([part, option]) =>
      option === null ? [] : (portrait.parts[part]?.[option] ?? []),
    )
    const key = names.join('|')
    if (key === skinKey) return
    skinKey = key
    const combined = new Skin('parts')
    if (skeleton.data.defaultSkin) combined.addSkin(skeleton.data.defaultSkin)
    for (const name of names) {
      const skin = skeleton.data.findSkin(name)
      if (skin) combined.addSkin(skin)
      else console.warn(`[spine] no skin "${name}" in this export`)
    }
    skeleton.setSkin(combined)
    settle()
  }

  const scheduleBlink = () => {
    const blink = portrait.blink
    if (!blink || gone) return
    const [min, max] = blink.everyMs
    blinkTimer = setTimeout(
      () => {
        if (gone) return
        const entry = state.setAnimation(2, blink.animation, false)
        entry.listener = {
          complete: () => {
            state.clearTrack(2)
            settle()
          },
        }
        scheduleBlink()
      },
      min + Math.random() * (max - min),
    )
  }

  const draw = () => {
    const target = renderer
    if (!canvas || !target || canvas.width === 0 || canvas.height === 0) return
    const area = crop ?? { x: 0, y: 0, w: box.width, h: box.height }
    const width = canvas.width
    const height = canvas.height
    // The shared canvas only grows: resizing it every frame would be slow.
    if (target.width < width || target.height < height)
      target.resize(Math.max(target.width, width), Math.max(target.height, height))
    const scale = Math.min(width / area.w, height / area.h)
    spine.scale.set(scale)
    // Spine is y up from the root; the portrait is y down from the box's top left corner.
    spine.x = (-box.x - area.x) * scale + (width - area.w * scale) / 2
    spine.y = (box.y + box.height - area.y) * scale
    target.render({ container: spine, clear: true })
    const context = canvas.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, width, height)
    context.drawImage(target.canvas as HTMLCanvasElement, 0, 0, width, height, 0, 0, width, height)
  }

  const entry: Live = { spine, draw }
  live.add(entry)
  startLoop()
  scheduleBlink()

  return {
    setCanvas(next) {
      canvas = next
    },
    setCrop(next) {
      crop = next
    },
    setPose(next, parts) {
      const first = Object.keys(portrait.expressions)[0] ?? null
      const name = next && portrait.expressions[next] ? next : first
      if (next && !portrait.expressions[next])
        console.warn(`[spine] no pose "${next}": using "${first}"`)
      setSkins(spineParts(portrait, name, parts))
      if (name === pose || !name) return
      pose = name
      const expression = portrait.expressions[name]
      if (!expression) return
      if (expression.intro) {
        // The intro once, then the loop straight after it (Spine's queue): no crossfade between them
        // unless mixes sets one for this pair.
        state.setAnimation(0, expression.intro, false)
        const next = state.addAnimation(0, expression.animation, expression.loop, 0)
        next.setMixDuration(portrait.mixes[`${expression.intro}>${expression.animation}`] ?? 0, 0)
      } else state.setAnimation(0, expression.animation, expression.loop)
    },
    setTalking(next) {
      const talk = portrait.talk
      if (!talk || next === talking) return
      talking = next
      if (next) state.setAnimation(1, talk.animation, true)
      else {
        state.clearTrack(1)
        settle()
      }
    },
    destroy() {
      gone = true
      clearTimeout(blinkTimer)
      live.delete(entry)
      spine.destroy()
      stopLoopIfIdle()
    },
  }
}
