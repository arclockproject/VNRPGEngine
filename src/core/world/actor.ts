// Animated sprites on the map: SpriteView plays Aseprite animations, Actor adds facing,
// scripted walks and talking on top (NPCs). The player uses a SpriteView directly.
import { Assets, Container, Rectangle, Sprite, Texture } from 'pixi.js'
import type { Facing, TilePos, WalkStep } from '../define'
import { lang } from '../lang'
import { isFastForward } from '../scene/replay'
import { frameAt, pickAnimation, type WalkLeg, walkLegs } from '../sprite/anim'
import { type AsepriteSpriteData, type SpriteAnimationData, spriteSheet } from '../sprite/types'
import type { Box } from './grid'
import type { LayoutObject } from './layout'

const textureCache = new WeakMap<AsepriteSpriteData, Texture[]>()

/** One texture per frame image (cached per sprite sheet). The sheet must be preloaded. */
function cellTextures(data: AsepriteSpriteData): Texture[] {
  // The language's own sheet when it has one (same layout). The language may change while a map
  // is shown: its sheet only loads with the next map, so until then any loaded sheet is used.
  const sheets = [
    spriteSheet(data, lang.current()),
    data.sheet,
    ...Object.values(data.sheets ?? {}),
  ]
  const loaded = sheets.find((url) => Assets.cache.has(url)) ?? data.sheet
  const base = Assets.get<Texture>(loaded)
  let textures = textureCache.get(data)
  // textures.ts may have freed the sheet and loaded it again: the old frames are dead.
  if (!textures || textures[0]?.source !== base.source) {
    base.source.scaleMode = 'nearest' // Aseprite art is pixel art
    textures = data.cells.map(
      ([x, y]) =>
        new Texture({
          source: base.source,
          frame: new Rectangle(x ?? 0, y ?? 0, data.box.w, data.box.h),
        }),
    )
    textureCache.set(data, textures)
  }
  return textures
}

interface Playing {
  state: string
  name: string
  flip: boolean
  animation: SpriteAnimationData
  times: number | undefined
  start: number
  loop: boolean
  onDone?: () => void
}

/** A sprite sheet drawn with its feet (canvas bottom centre) at `view`'s position. */
export class SpriteView {
  /** Position this at the feet, in map pixels. */
  readonly view = new Container()
  readonly data: AsepriteSpriteData
  private readonly sprite: Sprite
  private readonly textures: Texture[]
  private readonly names: string[]
  private playing: Playing | undefined

  constructor(data: AsepriteSpriteData) {
    this.data = data
    this.textures = cellTextures(data)
    this.names = Object.keys(data.animations)
    this.sprite = new Sprite(this.textures[0])
    // The origin (feet) sits at the view's position.
    this.sprite.position.set(data.box.x - data.origin.x, data.box.y - data.origin.y)
    this.view.addChild(this.sprite)
  }

  /** Pixels from the feet up to the top of the drawn image. */
  get height() {
    return this.data.origin.y - this.data.box.y
  }

  has(state: string) {
    return this.names.some((n) => n === state || n.startsWith(`${state}_`))
  }

  /**
   * Shows `state` facing `facing`. Keeps the running animation's timing if it's already the one
   * showing (unless `restart`). Falls back to idle, then to the first animation.
   * `times` plays a looping animation that many times; onDone runs when a finite one ends.
   */
  show(
    state: string,
    facing: Facing,
    options: { restart?: boolean; times?: number; onDone?: () => void } = {},
  ) {
    const same = this.playing?.state === state && !options.restart
    const start = same && this.playing ? this.playing.start : performance.now()
    this.start(state, facing, start, options.times, options.onDone)
  }

  /** Same animation, new direction: keeps its timing, repeat count and onDone. */
  turn(facing: Facing) {
    const p = this.playing
    if (p) this.start(p.state, facing, p.start, p.times, p.onDone)
  }

  private start(
    state: string,
    facing: Facing,
    start: number,
    times: number | undefined,
    onDone: (() => void) | undefined,
  ) {
    const pick =
      pickAnimation(this.names, state, facing) ??
      pickAnimation(this.names, 'idle', facing) ??
      (this.names[0] ? { name: this.names[0], flip: false } : undefined)
    if (!pick) return
    const source = this.data.animations[pick.name] as SpriteAnimationData
    const animation = times !== undefined ? { ...source, repeat: Math.max(1, times) } : source
    this.playing = {
      ...pick,
      state,
      animation,
      times,
      start,
      loop: animation.repeat === 0,
      onDone,
    }
    this.view.scale.x = pick.flip ? -1 : 1
    this.update(performance.now())
  }

  update(now: number) {
    const playing = this.playing
    if (!playing) return
    const { cell, done } = frameAt(playing.animation, now - playing.start, playing.loop)
    const texture = this.textures[cell]
    if (texture && this.sprite.texture !== texture) this.sprite.texture = texture
    if (done && playing.onDone) {
      const onDone = playing.onDone
      playing.onDone = undefined
      onDone()
    }
  }
}

type Mode =
  | { kind: 'idle' }
  | { kind: 'animation'; state: string; resolve: () => void }
  | { kind: 'walk'; legs: WalkLeg[]; resolve: () => void }

/** A sprite object on the map (NPC): facing, animations, scripted walks, talk animation. */
export class Actor {
  readonly id: string
  readonly sprite: SpriteView
  /** Top-left of its tile, in tiles (fractional while walking). */
  x: number
  y: number
  facing: Facing
  speed: number
  /** The World's own copy: `at` follows the actor so interaction and labels move with it. */
  readonly object: LayoutObject
  private readonly tileSize: number
  /** Tells the World that collision changed (a walk started or ended). */
  private readonly onSolidChange: () => void
  private idleState: string
  private mode: Mode = { kind: 'idle' }
  private talking = false

  constructor(
    object: LayoutObject,
    data: AsepriteSpriteData,
    tileSize: number,
    onSolidChange: () => void,
  ) {
    this.object = object
    this.tileSize = tileSize
    this.onSolidChange = onSolidChange
    this.id = object.id ?? object.character ?? 'sprite'
    this.sprite = new SpriteView(data)
    // Off-grid objects (MapObject.offset) start at their exact spot.
    this.x = object.at.x + (object.offset?.x ?? 0)
    this.y = object.at.y + (object.offset?.y ?? 0)
    this.facing = object.facing ?? 'down'
    this.speed = object.speed ?? 3
    this.idleState = object.animation ?? 'idle'
    if (!this.sprite.has(this.idleState)) {
      console.warn(`[map] "${this.id}" has no animation "${this.idleState}"`)
      this.idleState = 'idle'
    }
    this.showIdle()
    this.place()
  }

  get walking() {
    return this.mode.kind === 'walk'
  }

  /** Hidden: not drawn, not solid, can't be talked to (see World). */
  get hidden() {
    return !this.sprite.view.visible
  }

  setHidden(hidden: boolean) {
    if (hidden === this.hidden) return
    this.sprite.view.visible = !hidden
    this.onSolidChange()
  }

  /** Schedule entry applied last (World), and a counter so an older schedule walk can't win. */
  scheduleIndex: number | undefined
  scheduleRun = 0

  /** Feet position (bottom centre of its object area), in map pixels. */
  feet() {
    const { w, h } = this.object.size ?? { w: 1, h: 1 }
    return { x: (this.x + w / 2) * this.tileSize, y: (this.y + h) * this.tileSize }
  }

  /**
   * Its slices of one kind as boxes in tiles, or undefined when it has none ("collision": then it
   * blocks its whole object area as tiles; "interact": then its collision boxes are used).
   */
  boxes(kind: 'collision' | 'interact' | 'triggers' = 'collision'): Box[] | undefined {
    const collision = this.sprite.data[kind]
    if (collision.length === 0) return kind === 'interact' ? this.boxes('collision') : undefined
    const feet = this.feet()
    const ts = this.tileSize
    return collision.map((b) => ({
      x0: (feet.x + b.x) / ts,
      y0: (feet.y + b.y) / ts,
      x1: (feet.x + b.x + b.w) / ts,
      y1: (feet.y + b.y + b.h) / ts,
    }))
  }

  /** Pixel y of the top of the drawn sprite (for its label). */
  top() {
    return this.feet().y - this.sprite.height
  }

  face(facing: Facing) {
    this.facing = facing
    this.refresh()
  }

  setTalking(talking: boolean) {
    if (talking === this.talking) return
    this.talking = talking
    if (this.mode.kind === 'idle') this.showIdle()
  }

  play(state: string, options: { times?: number; hold?: boolean } = {}): Promise<void> {
    if (!this.sprite.has(state)) {
      console.warn(`[map] "${this.id}" has no animation "${state}"`)
      return Promise.resolve()
    }
    this.finish()
    return new Promise((resolve) => {
      const done = () => {
        if (this.mode.kind === 'animation' && this.mode.resolve === resolve) {
          this.mode = { kind: 'idle' }
          if (!options.hold) this.showIdle()
        }
        resolve()
      }
      this.mode = { kind: 'animation', state, resolve }
      const looping = this.loops(state) && options.times === undefined
      if (isFastForward() && !looping) {
        this.mode = { kind: 'idle' }
        if (!options.hold) this.showIdle()
        resolve()
        return
      }
      this.sprite.show(state, this.facing, {
        restart: true,
        times: options.times,
        onDone: looping ? undefined : done,
      })
      // Looping animations keep going until idle()/walk()/play(); the promise resolves now.
      if (looping) resolve()
    })
  }

  idle(state?: string) {
    this.finish()
    if (state) {
      if (this.sprite.has(state)) this.idleState = state
      else console.warn(`[map] "${this.id}" has no animation "${state}"`)
    }
    this.showIdle()
  }

  walk(steps: readonly WalkStep[]): Promise<void> {
    let legs: WalkLeg[]
    try {
      legs = walkLegs({ x: this.x, y: this.y }, steps, this.speed)
    } catch (error) {
      return Promise.reject(error)
    }
    this.finish()
    if (legs.length === 0) return Promise.resolve()
    const last = legs[legs.length - 1]
    if (isFastForward() && last) {
      // Replaying a scene: arrive at once.
      this.x = last.x
      this.y = last.y
      this.facing = last.facing
      this.showIdle()
      this.place()
      this.onSolidChange()
      return Promise.resolve()
    }
    return new Promise((resolve) => {
      this.mode = { kind: 'walk', legs, resolve }
      this.onSolidChange()
      this.startLeg()
    })
  }

  teleport(pos: TilePos, facing?: Facing) {
    this.finish()
    this.x = pos.x
    this.y = pos.y
    if (facing) this.facing = facing
    this.showIdle()
    this.place()
    this.onSolidChange()
  }

  update(dt: number, now: number) {
    if (this.mode.kind === 'walk') this.step(dt)
    this.sprite.update(now)
    this.place()
  }

  /** Ends whatever runs now (its promise resolves), e.g. before a new command or on map exit. */
  finish() {
    const mode = this.mode
    this.mode = { kind: 'idle' }
    if (mode.kind !== 'idle') mode.resolve()
    if (mode.kind === 'walk') this.onSolidChange()
  }

  private step(dt: number) {
    if (this.mode.kind !== 'walk') return
    let budget = dt
    while (budget > 0 && this.mode.kind === 'walk') {
      const leg = this.mode.legs[0]
      if (!leg) break
      const dx = leg.x - this.x
      const dy = leg.y - this.y
      const distance = Math.abs(dx) + Math.abs(dy) // legs are straight lines
      const reach = leg.speed * budget
      if (reach < distance) {
        this.x += (dx / distance) * reach
        this.y += (dy / distance) * reach
        break
      }
      // Leg done: spend the rest of this frame on the next one.
      this.x = leg.x
      this.y = leg.y
      budget -= distance / leg.speed
      this.mode.legs.shift()
      if (this.mode.legs.length > 0) this.startLeg()
      else {
        const { resolve } = this.mode
        this.mode = { kind: 'idle' }
        this.showIdle()
        this.onSolidChange()
        resolve()
      }
    }
  }

  private startLeg() {
    if (this.mode.kind !== 'walk') return
    const leg = this.mode.legs[0]
    if (!leg) return
    this.facing = leg.facing
    this.sprite.show('walk', this.facing)
  }

  private loops(state: string) {
    const name = Object.keys(this.sprite.data.animations).find(
      (n) => n === state || n.startsWith(`${state}_`),
    )
    const animation = name ? this.sprite.data.animations[name] : undefined
    return animation?.repeat === 0
  }

  private showIdle() {
    const state = this.talking && this.sprite.has('talk') ? 'talk' : this.idleState
    this.sprite.show(state, this.facing)
  }

  /** Re-picks the animation for the current facing (keeps what is playing). */
  private refresh() {
    if (this.mode.kind === 'idle') this.showIdle()
    else this.sprite.turn(this.facing)
  }

  private place() {
    const feet = this.feet()
    this.sprite.view.position.set(feet.x, feet.y)
    this.sprite.view.zIndex = feet.y
    // Interaction and onEnter checks use the tile it is (mostly) on; offset keeps the rest.
    const at = { x: Math.round(this.x), y: Math.round(this.y) }
    this.object.at = at
    const offset = { x: this.x - at.x, y: this.y - at.y }
    if (Math.abs(offset.x) > 1e-6 || Math.abs(offset.y) > 1e-6) this.object.offset = offset
    else delete this.object.offset
  }
}
