// Draws the current map with PixiJS and runs the player each frame.
// One World (and one Pixi Application) lives for the whole game; maps are swapped inside it.
// PixiJS normally builds its shader code with new Function; this import makes it work without, so the
// game runs under its Content-Security-Policy (src/content/config/security.ts). Keep it before 'pixi.js'.
import 'pixi.js/unsafe-eval'
import {
  Application,
  Assets,
  Container,
  Graphics,
  Matrix,
  Rectangle,
  Sprite,
  Text,
  Texture,
  type Ticker,
} from 'pixi.js'
import ambientConfig from '@/content/ambient'
import battleConfig from '@/content/battle'
import player from '@/content/config/player'
import screen from '@/content/config/screen'
import emotes from '@/content/emotes'
import terrainConfig from '@/content/terrain'
import type { TerrainKind } from '@/core/terrain'
import { audio } from '../audio/manager'
import type {
  Facing,
  LightConfig,
  MapObject,
  MapObjectContext,
  ScheduleEntry,
  TilePos,
  WalkStep,
  WeatherKind,
  WorldApi,
} from '../define'
import { reportError } from '../errors'
import { getGame } from '../gameRef'
import { input } from '../input/manager'
import { actionLabel } from '../input/prompt'
import { lang, t } from '../lang'
import { clock } from '../managers/clock'
import { difficulty } from '../managers/difficulty'
import { onTalking } from '../portrait/talking'
import type { AudioId, PropId } from '../registry'
import { stripMarkup } from '../scene/markup'
import { isFastForward } from '../scene/replay'
import { facingToward, type WalkLeg, walkLegs } from '../sprite/anim'
import { isDefeated, objectSprite, propMemory, propSetup, resolveObject } from '../sprite/resolve'
import { collisionBounds, spriteSheet } from '../sprite/types'
import { useSystemStore } from '../stores/system'
import { Actor, SpriteView } from './actor'
import { Atmosphere, type ScreenLight } from './atmosphere'
import { Bubbles } from './bubbles'
import { type CameraTarget, WorldCamera } from './camera'
import { DebugOverlay } from './debugOverlay'
import {
  type Box,
  cameraOffset,
  facingFrom,
  findPath,
  type Grid,
  hasOffset,
  inBoxes,
  isActor,
  moveBox,
  objectArea,
  objectContains,
  objectPos,
  offsetBoxes,
  tilesAround,
} from './grid'
import {
  blockedCells,
  clipLayout,
  type DrawLayer,
  type DrawTile,
  type Layout,
  type LayoutObject,
  layoutImages,
  nearestFree,
  type SortedPiece,
  stampBoxes,
  stampObjects,
  stampSolid,
  type TexRef,
} from './layout'
import { labelStyle, promptStyle, promptTouchText } from './mapLook'
import { npcHandle } from './npc'
import { Pictures } from './pictures'
import { hopArc, jumpLanding, pushBlocked, shifted } from './push'
import { activeEntry } from './schedule'
import { noteLoaded } from './textures'

/** Map-level settings the world needs besides the layout. */
export interface MapSettings {
  title: string
  zoom?: number
  background?: string
  outdoor?: boolean
  minimap?: boolean
  lighting?: { tint: string; strength?: number }
  weather?: { kind: WeatherKind; intensity?: number }
  music?: AudioId | null
  ambient?: AudioId | null
}

/** What game.props.spawn places (see managers/props.ts). */
export interface PropSpawn {
  id: string
  prop: string
  at: TilePos
  facing?: Facing
  properties?: Record<string, string | number | boolean>
}

const STEP_OF: Record<Facing, TilePos> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}
/** How far in front of the player's hitbox "facing something" reaches, in tiles. */
/** What World.minimap() hands to the HUD minimap. Positions are in tiles. */
export interface MinimapData {
  map: string
  /** The map said `minimap: false`. */
  hidden: boolean
  width: number
  height: number
  /** Row-major, the live collision grid: do not change it. */
  solid: readonly boolean[]
  player: { x: number; y: number }
  doors: { x: number; y: number }[]
  actors: { x: number; y: number }[]
}

const REACH = player.reach

/** Pathfinding steps -> walk steps. */
const toWalkSteps = (path: { facing: Facing; tiles: number }[], speed?: number): WalkStep[] =>
  path.map((p) => ({ [p.facing]: p.tiles, ...(speed ? { speed } : {}) }))

/** Tiles to walk after a map change or a battle before another random battle can start. */
const MIN_STEPS_BETWEEN_BATTLES = battleConfig.encounters.minSteps

export class World {
  readonly app: Application
  /** Scaled by zoom: everything in map pixels (tile × tileSize). */
  private readonly root = new Container()
  /** Not scaled: labels and prompts stay crisp. */
  private readonly overlay = new Container()

  private map: MapSettings | undefined
  private grid: Grid | undefined
  private tileSize = 32
  private objects: LayoutObject[] = []
  /** The map's own objects and collision (structures are stamped on top of these). */
  private baseObjects: LayoutObject[] = []
  private baseSolid: boolean[] = []
  /** The map's own collision boxes (tile collision shapes), and with structures stamped on. */
  private baseBoxes: Box[] = []
  private stampedBoxes: Box[] = []
  private belowGroup: Container | undefined
  private objectGroup: Container | undefined
  private aboveGroup: Container | undefined
  private readonly structures = new Map<
    string,
    {
      layout: Layout
      at: TilePos
      below: Container
      above: Container
      objects: LayoutObject[]
      views: Container[]
    }
  >()
  /** Animated tiles: their sprite swaps texture as time passes. */
  private animated: {
    sprite: Sprite
    frames: { texture: Texture; duration: number }[]
    total: number
  }[] = []
  private readonly textures = new Map<string, Texture>()
  private labels: { object: MapObject; text: Text }[] = []
  /** Sprite objects (NPCs) by id, for world.npc(id). */
  private readonly actors = new Map<string, Actor>()
  /** Collision of map + structures, before actors are added. */
  private stampedSolid: boolean[] = []
  private readonly playerShape = new Graphics()
  /** Set when player.sprite is (created on the first build, once its sheet is loaded). */
  private playerSprite: SpriteView | undefined
  private playerView: Container = this.playerShape
  private playerMoving = false
  /** Collision boxes of standing NPCs that have collision slices (tiles). */
  private actorBoxes: Box[] = []
  /** Every collision box the player bumps into: map + structures + off-grid objects + NPCs. */
  private solidBoxes: Box[] = []
  /** Player hitbox: half size in tiles, and where the feet are from its centre (pixels). */
  private hitbox = { hx: player.size / 2, hy: player.size / 2, feetX: 0, feetY: 0 }
  private readonly prompt = new Text({ text: promptTouchText, style: promptStyle })
  /** Id of the current map (for prop memory). */
  private mapId = ''
  /** Props added with addProp, by id. */
  private readonly spawned = new Map<string, LayoutObject>()
  /** A scripted player walk (cutscenes): input is ignored meanwhile. */
  private playerScript: { legs: WalkLeg[]; resolve: () => void } | null = null
  /** What the camera looks at, its pans and the script zoom (camera.ts). */
  private readonly camera = new WorldCamera((target) => this.cameraTargetPos(target))
  /** Size of labels, bubbles and the prompt: screen height / map.textHeight. */
  private textScale = 1
  private lastOffset = { x: 0, y: 0 }
  private readonly atmosphere = new Atmosphere()
  /** Speech bubbles (npc.bark / player.bark). */
  private readonly bubbles = new Bubbles()
  /** The map's own music (to go back to after a zone) and the sounds applied last. */
  private baseMusic: AudioId | null = null
  private sounds: { music?: AudioId | null; ambient?: AudioId | null } = {}
  /** Random battles: the tile the player was on, and tiles walked since the last fight. */
  private lastTile = ''
  private stepsSinceBattle = 0
  /** What the ground is at each cell (src/content/terrain.ts names), and tiles walked for footsteps. */
  private terrain: (string | undefined)[] = []
  private stepsSinceSound = 0
  /** Walking against something that can be pushed or jumped: which, and for how long (ms). */
  private leaning: { key: string; ms: number } | null = null
  /** An object is sliding after a push: the player waits for it. */
  private pushing = false
  /** A jump over a gap in progress (t: 0..1). */
  private hop: { fromX: number; fromY: number; toX: number; toY: number; t: number } | null = null
  /** Tiled image layers: behind the map, and over it. */
  private backdrop: Pictures | undefined
  private overlayPictures: Pictures | undefined
  /** Set by world.lighting(): wins over the map's own lighting until the next map. */
  private lightingOverride = false
  /** Dev panel "show collision" (debugOverlay.ts). */
  private readonly debug = new DebugOverlay(this.overlay, labelStyle)
  private readonly pos = { x: 0, y: 0, facing: 'down' as Facing }
  private standingOn = new Set<MapObject>()
  private tickCallbacks = new Set<(dt: number) => void>()
  /** Set while an object's handler runs, so the player can't trigger it twice. */
  private busy = false
  /** Which handler run owns `busy`: a run that was dropped must not clear a newer one. */
  private runId = 0
  private stopConfirm: (() => void) | undefined

  constructor(app: Application) {
    this.app = app
    app.stage.addChild(this.root, this.overlay)
    this.overlay.addChild(this.atmosphere.view)
    this.prompt.anchor.set(0.5, 1)
    this.prompt.visible = false
    this.overlay.addChild(this.bubbles.view, this.prompt)
    app.ticker.add(this.tick)
    // NPCs play their "talk" animation while their line types out in an event.
    onTalking((talkers) => {
      for (const actor of this.actors.values())
        actor.setTalking(!!actor.object.character && talkers.includes(actor.object.character))
    })
  }

  /** Puts the canvas into `host` and keeps it sized to it. Returns a detach function. */
  attach(host: HTMLElement) {
    host.appendChild(this.app.canvas)
    this.app.resizeTo = host
    this.app.resize()
    return () => {
      if (this.app.canvas.parentElement === host) host.removeChild(this.app.canvas)
    }
  }

  /** Loads every image a layout uses. `onProgress` gets 0..1. Returns their URLs. */
  async preload(layout: Layout, onProgress?: (progress: number) => void): Promise<string[]> {
    const urls = new Set(layoutImages(layout))
    if (player.texture) urls.add(player.texture)
    // The sheets of the language in use (layers named "<name>.<lang>"); the others never load.
    const language = lang.current()
    if (player.sprite) urls.add(spriteSheet(player.sprite, language))
    for (const object of layout.objects) {
      const sprite = objectSprite(object)
      if (sprite) urls.add(spriteSheet(sprite, language))
    }
    if (urls.size > 0) await Assets.load([...urls], onProgress)
    if (layout.pixelated) {
      // Pixel art: keep hard edges when the map is zoomed.
      for (const url of urls) Assets.get<Texture>(url).source.scaleMode = 'nearest'
    }
    noteLoaded(urls)
    onProgress?.(1)
    return [...urls]
  }

  /** Builds a map layout (images must be preloaded) and places the player. */
  build(settings: MapSettings, layout: Layout, spawn: TilePos & { facing?: Facing }, mapId = '') {
    this.clear()
    this.map = settings
    this.mapId = mapId
    this.tileSize = layout.tileSize
    for (const warning of layout.warnings) console.warn(`[map "${settings.title}"] ${warning}`)
    // Own copies (actors move their object's `at` as they walk), with props and doors resolved.
    this.baseObjects = layout.objects
      .map((o) => resolveObject({ ...o, at: { ...o.at } }, mapId))
      .filter((o) => !isDefeated(o, mapId))
    this.objects = this.baseObjects
    this.baseSolid = layout.solid
    this.baseBoxes = layout.boxes
    this.stampedBoxes = layout.boxes
    this.grid = { width: layout.width, height: layout.height, solid: layout.solid }
    if (player.sprite && !this.playerSprite) {
      this.playerSprite = new SpriteView(player.sprite)
      this.playerView = this.playerSprite.view
    }
    this.hitbox = playerHitbox(layout.tileSize)
    this.app.renderer.background.color = settings.background ?? '#000000'

    // Draw order: map below → structures below → objects + player → map above → structures above.
    this.belowGroup = new Container()
    // Objects, NPCs and the player are drawn by their feet: lower on screen = in front.
    this.objectGroup = new Container({ sortableChildren: true })
    this.aboveGroup = new Container()
    // Pictures from Tiled image layers: far hills behind everything, fog and clouds over it.
    const pictures = layout.pictures ?? []
    this.backdrop = new Pictures(pictures.filter((p) => !p.above))
    this.overlayPictures = new Pictures(pictures.filter((p) => p.above))
    this.terrain = layout.terrain ?? []
    this.stepsSinceSound = 0
    this.root.addChild(
      this.backdrop.view,
      this.belowGroup,
      this.objectGroup,
      this.aboveGroup,
      this.overlayPictures.view,
    )
    for (const layer of layout.below) this.belowGroup.addChild(this.drawLayer(layer, layout.width))
    // Sorted layers (houses, fences) go in among the objects, by their bottom edge.
    for (const piece of layout.sorted)
      this.objectGroup.addChild(this.drawPiece(piece, layout.width, { x: 0, y: 0 }))
    for (const object of this.objects) this.addObjectView(object, this.objectGroup)
    this.applyActorSolids()
    // The player walks between the "below" and "above" layers (under roofs and treetops).
    this.objectGroup.addChild(this.playerView)
    for (const layer of layout.above) this.aboveGroup.addChild(this.drawLayer(layer, layout.width))
    this.root.addChild(this.debug.graphics)
    // Spawn tiles mean "stand in the middle of this tile".
    this.place(spawn.x + 0.5, spawn.y + 0.5, spawn.facing ?? 'down')
    this.stopConfirm = input.on('confirm', () => this.interact())
    // Camera on the player, the map's own lighting and weather.
    this.camera.reset()
    this.lightingOverride = false
    const light = settings.lighting
    this.atmosphere.setTint(light?.tint ?? null, light?.strength ?? 0.5)
    this.atmosphere.setWeather(settings.weather?.kind ?? null, settings.weather?.intensity)
    // Omitted music keeps what plays now (the maps manager starts the map's own music).
    this.baseMusic = settings.music === undefined ? audio.currentMusic() : settings.music
    this.sounds = {}
    this.stepsSinceBattle = 0
    this.runSetups(this.baseObjects)
  }

  /** Runs props' setup hooks (e.g. show a chest that is already open). */
  private runSetups(objects: MapObject[]) {
    for (const object of objects) {
      const setup = propSetup(object, this.mapId)
      if (!setup) continue
      Promise.resolve(setup({ game: getGame(), world: this.api(), object })).catch(
        (error: unknown) => console.error('[prop setup]', error),
      )
    }
  }

  // ---------------------------------------------------------------- spawned props

  /** Adds a prop (images must be preloaded). Same id = replaced. */
  addProp(spawn: PropSpawn) {
    if (!this.objectGroup) return
    this.removeProp(spawn.id)
    const object = resolveObject(
      {
        id: spawn.id,
        prop: spawn.prop as PropId,
        at: { ...spawn.at },
        ...(spawn.facing ? { facing: spawn.facing } : {}),
        properties: { ...spawn.properties },
      },
      this.mapId,
    )
    this.spawned.set(spawn.id, object)
    this.baseObjects = [...this.baseObjects, object]
    this.addObjectView(object, this.objectGroup)
    this.restamp()
    this.runSetups([object])
  }

  removeProp(id: string) {
    const object = this.spawned.get(id)
    if (!object) return
    this.spawned.delete(id)
    this.removeObjects([object])
    this.baseObjects = this.baseObjects.filter((o) => o !== object)
    this.restamp()
  }

  /** Removes the views, actors and labels of objects. */
  private removeObjects(objects: MapObject[]) {
    for (const [actorId, actor] of this.actors) {
      if (!objects.includes(actor.object)) continue
      actor.finish()
      actor.sprite.view.destroy({ children: true })
      this.actors.delete(actorId)
    }
    this.labels = this.labels.filter(({ object, text }) => {
      if (!objects.includes(object)) return true
      text.destroy()
      return false
    })
  }

  /** Images of props that may be spawned (sprite sheets). */
  async preloadSprites(urls: string[]): Promise<string[]> {
    const missing = urls.filter((url) => !Assets.cache.has(url))
    if (missing.length > 0) await Assets.load(missing)
    noteLoaded(urls)
    return urls
  }

  /** Draws an object (tile, or coloured block) into `parent` and adds its label. */
  private addObjectView(object: LayoutObject, parent: Container) {
    const ts = this.tileSize
    const { w, h } = object.size ?? { w: 1, h: 1 }
    const pos = objectPos(object)
    const x = pos.x * ts
    const y = pos.y * ts
    let view: Container | undefined
    const sprite = objectSprite(object)
    if (sprite) {
      const actor = new Actor(object, sprite, ts, () => this.applyActorSolids())
      if (this.actors.has(actor.id))
        console.warn(`[map "${this.map?.title}"] two sprite objects are called "${actor.id}"`)
      this.actors.set(actor.id, actor)
      // A pushed object stays where it was left (unless pushReset).
      if (object.pushable && object.id && !object.pushReset) {
        const memory = propMemory(this.mapId, object.id)
        const px = memory.get('pushedX')
        const py = memory.get('pushedY')
        if (typeof px === 'number' && typeof py === 'number') actor.teleport({ x: px, y: py })
      }
      view = actor.sprite.view
    } else if (object.tile) view = this.tileSprite(object.tile, x, y, w * ts, h * ts)
    else if (object.color) {
      const inset = ts * 0.1
      view = new Graphics()
        .roundRect(x + inset, y + inset, w * ts - inset * 2, h * ts - inset * 2, ts * 0.2)
        .fill(object.color)
    }
    if (view) {
      // Sorted by the bottom edge (actors keep their own zIndex up to date).
      if (!sprite) view.zIndex = y + h * ts
      parent.addChild(view)
    }
    if (object.label) {
      const text = new Text({ text: t(object.label), style: labelStyle })
      text.anchor.set(0.5, 1)
      text.scale.set(this.textScale)
      text.resolution = (window.devicePixelRatio || 1) * this.textScale
      this.overlay.addChild(text)
      this.labels.push({ object, text })
    }
    return view
  }

  // ---------------------------------------------------------------- structures

  /** Stamps a structure layout at `at` (replacing one with the same id). Images must be preloaded. */
  addStructure(id: string, full: Layout, at: TilePos) {
    if (!this.grid || !this.belowGroup || !this.aboveGroup || !this.objectGroup) return
    this.removeStructure(id)
    // Anything outside the map is cut off (forced placements may hang over the edge).
    const layout = clipLayout(full, at, this.grid)
    const ts = this.tileSize
    const below = new Container({ x: at.x * ts, y: at.y * ts })
    const above = new Container({ x: at.x * ts, y: at.y * ts })
    for (const layer of layout.below) below.addChild(this.drawLayer(layer, layout.width))
    for (const layer of layout.above) above.addChild(this.drawLayer(layer, layout.width))
    this.belowGroup.addChild(below)
    this.aboveGroup.addChild(above)
    const objects = stampObjects({ layout, at }).map((o) => resolveObject(o, this.mapId))
    const pieces = layout.sorted.map((piece) => this.drawPiece(piece, layout.width, at))
    for (const view of pieces) this.objectGroup.addChild(view)
    const views = [
      ...pieces,
      ...objects
        .map((o) => this.addObjectView(o, this.objectGroup as Container))
        .filter((v) => v !== undefined),
    ]
    this.structures.set(id, { layout, at, below, above, objects, views })
    this.restamp()
    this.runSetups(objects)
  }

  removeStructure(id: string) {
    const placed = this.structures.get(id)
    if (!placed) return
    for (const [id, actor] of this.actors) {
      if (!placed.objects.includes(actor.object)) continue
      actor.finish()
      this.actors.delete(id)
    }
    for (const view of [placed.below, placed.above, ...placed.views])
      view.destroy({ children: true })
    this.labels = this.labels.filter(({ object, text }) => {
      if (!placed.objects.includes(object)) return true
      text.destroy()
      return false
    })
    this.structures.delete(id)
    this.restamp()
  }

  /** Collision + objects = the base map with every structure stamped on top. */
  private restamp() {
    if (!this.grid) return
    const stamps = [...this.structures.values()]
    this.stampedSolid = stampSolid(this.baseSolid, this.grid.width, this.grid.height, stamps)
    this.stampedBoxes = stampBoxes(this.baseBoxes, this.grid.width, this.grid.height, stamps)
    this.objects = [...this.baseObjects, ...stamps.flatMap((s) => s.objects)]
    this.applyActorSolids()
    this.standingOn = new Set(this.objectsUnderPlayer())
  }

  /**
   * Collision = map + structures + solid actors on their tile. Walking actors don't block
   * (scripts choose their path); they block again where they stop.
   */
  private applyActorSolids() {
    const grid = this.grid
    if (!grid) return
    const solid = (this.stampedSolid.length ? this.stampedSolid : this.baseSolid).slice()
    this.actorBoxes = []
    for (const actor of this.actors.values()) {
      if (!actor.object.solid || actor.walking || actor.hidden) continue
      // Collision slices: exact boxes (e.g. just the feet). Otherwise the whole object area.
      const boxes = actor.boxes()
      if (boxes) {
        this.actorBoxes.push(...boxes)
        continue
      }
      const { w, h } = actor.object.size ?? { w: 1, h: 1 }
      const { x: ax, y: ay } = actor.object.at
      for (let y = ay; y < ay + h; y++)
        for (let x = ax; x < ax + w; x++)
          if (x >= 0 && y >= 0 && x < grid.width && y < grid.height)
            solid[y * grid.width + x] = true
    }
    grid.solid = solid
    this.solidBoxes = [...this.staticBoxes(), ...this.actorBoxes]
    this.unstickPlayer()
  }

  /** Collision boxes that don't move: map + structures + solid objects placed between tiles. */
  private staticBoxes(): Box[] {
    return [...this.stampedBoxes, ...offsetBoxes(this.objects)]
  }

  /** Collision as whole tiles (a tile any box touches counts as solid), for pathfinding. */
  private pathGrid(): boolean[] {
    const grid = this.grid
    if (!grid) return []
    return blockedCells(grid.solid, grid.width, grid.height, this.staticBoxes())
  }

  /** If a wall appeared where the player stands, move them to the nearest walkable tile. */
  private unstickPlayer() {
    const grid = this.grid
    if (!grid) return
    const here = { x: Math.floor(this.pos.x), y: Math.floor(this.pos.y) }
    const { hx, hy } = this.hitbox
    const { x, y } = this.pos
    const inBox = this.staticBoxes().some(
      (b) => x + hx > b.x0 && x - hx < b.x1 && y + hy > b.y0 && y - hy < b.y1,
    )
    if (!grid.solid[here.y * grid.width + here.x] && !inBox) return
    const free = nearestFree(this.pathGrid(), grid.width, grid.height, here)
    if (!free) return
    this.pos.x = free.x + 0.5
    this.pos.y = free.y + 0.5
  }

  /** Map size, for checking where structures fit. */
  size() {
    return this.grid ? { width: this.grid.width, height: this.grid.height } : undefined
  }

  /** A piece of a sorted layer (see SortedPiece), placed at `at` (tiles), sorted by its bottom. */
  private drawPiece(piece: SortedPiece, width: number, at: TilePos): Container {
    const ts = this.tileSize
    const container = new Container({ alpha: piece.opacity, x: at.x * ts, y: at.y * ts })
    for (const { i, tile } of piece.cells) {
      const x = (i % width) * ts
      const y = Math.floor(i / width) * ts
      const w = tile.tex.w || ts
      const h = tile.tex.h || ts
      container.addChild(this.tileSprite(tile, x, y + ts - h, w, h))
    }
    container.zIndex = (at.y + piece.bottom) * ts
    return container
  }

  /** One layer of tiles: a Sprite per tile. */
  private drawLayer(layer: DrawLayer, width: number): Container {
    const ts = this.tileSize
    const container = new Container({ alpha: layer.opacity })
    layer.tiles.forEach((tile, i) => {
      if (!tile) return
      const x = (i % width) * ts
      const y = Math.floor(i / width) * ts
      // Whole-image tiles fill the cell; tileset tiles keep their size, anchored bottom-left (like Tiled).
      const w = tile.tex.w || ts
      const h = tile.tex.h || ts
      container.addChild(this.tileSprite(tile, x, y + ts - h, w, h))
    })
    return container
  }

  /** A Sprite for a tile at (x, y) sized w × h, with Tiled's flips and animation. */
  private tileSprite(tile: DrawTile, x: number, y: number, w: number, h: number): Sprite {
    const sprite = new Sprite(this.texture(tile.tex))
    sprite.anchor.set(0.5)
    const sx = w / (sprite.texture.width || w)
    const sy = h / (sprite.texture.height || h)
    // Tiled applies the diagonal flip first (swap x and y), then horizontal, then vertical.
    let [m00, m01, m10, m11] = tile.flipD ? [0, 1, 1, 0] : [1, 0, 0, 1]
    if (tile.flipH) [m00, m01] = [-m00, -m01]
    if (tile.flipV) [m10, m11] = [-m10, -m11]
    sprite.setFromMatrix(new Matrix(m00 * sx, m10 * sx, m01 * sy, m11 * sy, x + w / 2, y + h / 2))
    if (tile.frames) {
      const frames = tile.frames.map((f) => ({
        texture: this.texture(f.tex),
        duration: Math.max(1, f.duration),
      }))
      this.animated.push({ sprite, frames, total: frames.reduce((sum, f) => sum + f.duration, 0) })
    }
    return sprite
  }

  /** Cached sub-texture for an image rectangle (w 0 = whole image). */
  private texture(ref: TexRef): Texture {
    if (!ref.w) return Assets.get<Texture>(ref.image)
    const key = `${ref.image}#${ref.x},${ref.y},${ref.w},${ref.h}`
    let texture = this.textures.get(key)
    if (!texture) {
      const base = Assets.get<Texture>(ref.image)
      texture = new Texture({
        source: base.source,
        frame: new Rectangle(ref.x, ref.y, ref.w, ref.h),
      })
      this.textures.set(key, texture)
    }
    return texture
  }

  /** Removes the current map. */
  clear() {
    this.stopConfirm?.()
    this.stopConfirm = undefined
    this.playerView.removeFromParent()
    this.debug.clear()
    this.playerScript?.resolve()
    this.playerScript = null
    this.camera.finish()
    this.bubbles.clear()
    this.spawned.clear()
    for (const actor of this.actors.values()) actor.finish()
    this.actors.clear()
    this.stampedSolid = []
    this.root.removeChildren().forEach((child) => {
      child.destroy({ children: true })
    })
    for (const { text } of this.labels) text.destroy()
    this.labels = []
    // Sub-textures point at map images that textures.ts may free once the next map is built.
    for (const texture of this.textures.values()) texture.destroy()
    this.textures.clear()
    this.animated = []
    this.tickCallbacks.clear()
    this.standingOn.clear()
    this.map = undefined
    this.grid = undefined
    this.objects = []
    this.baseObjects = []
    this.baseSolid = []
    this.baseBoxes = []
    this.stampedBoxes = []
    this.solidBoxes = []
    this.actorBoxes = []
    this.structures.clear()
    this.belowGroup = this.objectGroup = this.aboveGroup = undefined
    this.backdrop = this.overlayPictures = undefined
    this.terrain = []
    this.prompt.visible = false
  }

  /** The API content gets in map hooks. */
  api(): WorldApi {
    const world = this
    return {
      player: {
        get x() {
          return world.pos.x
        },
        get y() {
          return world.pos.y
        },
        get facing() {
          return world.pos.facing
        },
        teleport: (pos, facing) => world.place(pos.x + 0.5, pos.y + 0.5, facing),
        place: (x, y, facing) => world.place(x, y, facing),
        face: (facing) => {
          world.pos.facing = facing
          world.drawPlayer()
        },
        walk: (...steps) => world.playerWalk(steps),
        walkTo: (pos, options) => world.playerWalkTo(pos, options?.speed),
        bark: (text, options) => world.bark('player', text, options),
        emote: (name, options) => world.emote('player', name, options),
      },
      camera: {
        follow: (target, options) =>
          world.camera.follow(
            target === 'player' ? { kind: 'player' } : { kind: 'npc', id: target },
            options?.duration ?? 600,
          ),
        panTo: (pos, options) =>
          world.camera.follow({ kind: 'point', x: pos.x, y: pos.y }, options?.duration ?? 600),
        reset: (options) => {
          const duration = options?.duration ?? 600
          return Promise.all([
            world.camera.follow({ kind: 'player' }, duration),
            world.camera.zoomTo(1, duration),
          ]).then(() => undefined)
        },
        zoom: (level, options) => world.camera.zoomTo(level, options?.duration ?? 600),
      },
      lighting: (tint, options) => {
        world.lightingOverride = true
        world.atmosphere.setTint(tint, options?.strength ?? 0.5, options?.duration ?? 0)
      },
      weather: (kind, options) => world.atmosphere.setWeather(kind, options?.intensity),
      root: this.root,
      tileSize: this.tileSize,
      terrain: () => this.terrainUnderPlayer(),
      onTick: (callback) => {
        this.tickCallbacks.add(callback)
        return () => this.tickCallbacks.delete(callback)
      },
      npc: (id: string) => this.npc(id),
    }
  }

  /** Script handle for a sprite object (see NpcApi). */
  npc(id: string) {
    return npcHandle(
      id,
      () => this.actors.get(id),
      () => (this.map ? { x: this.pos.x, y: this.pos.y } : undefined),
      (actor, to, speed) => {
        const grid = this.grid
        if (!grid) return null
        const from = { x: Math.round(actor.x), y: Math.round(actor.y) }
        const path = findPath(this.pathGrid(), grid.width, grid.height, from, to)
        return path && toWalkSteps(path, speed)
      },
      (text, options) => this.bark(id, text, options),
      (name, options) => this.emote(id, name, options),
    )
  }

  /**
   * Music and ambient sound: a zone the player stands in wins over the map; the map's ambient
   * defaults to its weather's sound. Only changes are sent, so scripts can still play music.
   */
  private updateSounds() {
    if (!this.map) return
    let music: AudioId | null | undefined
    let ambient: AudioId | null | undefined
    for (const o of this.standingOn) {
      if (music === undefined && o.music !== undefined) music = o.music
      if (ambient === undefined && o.ambient !== undefined) ambient = o.ambient
    }
    music = music === undefined ? this.baseMusic : music
    if (ambient === undefined) {
      const weather = this.atmosphere.weather
      ambient =
        this.map.ambient !== undefined
          ? this.map.ambient
          : weather
            ? (ambientConfig.weather[weather] ?? null)
            : null
    }
    if (music !== this.sounds.music) {
      if (this.sounds.music !== undefined || music !== null) {
        if (music) audio.music(music)
        else audio.stopMusic()
      }
      this.sounds.music = music
    }
    if (ambient !== this.sounds.ambient) {
      audio.ambient(ambient)
      this.sounds.ambient = ambient
    }
  }

  /**
   * Moves NPCs with a schedule when their next entry starts. The first time (map entry) they are
   * put in place at once. Waits while an event or object handler runs (scripts may move them).
   */
  private updateSchedules() {
    const waiting = this.busy || useSystemStore.getState().event !== null
    for (const actor of this.actors.values()) {
      const schedule = actor.object.schedule
      if (!schedule || schedule.length === 0) continue
      const index = activeEntry(schedule, clock.minutes())
      if (index === actor.scheduleIndex) continue
      const first = actor.scheduleIndex === undefined
      if (waiting && !first) continue
      actor.scheduleIndex = index
      const entry = schedule[index]
      if (entry) void this.applySchedule(actor, entry, first)
    }
  }

  private async applySchedule(actor: Actor, entry: ScheduleEntry, instant: boolean) {
    const run = ++actor.scheduleRun
    const current = () => actor.scheduleRun === run && this.actors.get(actor.id) === actor
    const jump = instant || entry.walk === false || actor.hidden
    if (entry.at && jump) actor.teleport(entry.at, entry.facing)
    if (!entry.hidden) actor.setHidden(false)
    if (entry.at && !jump) {
      await this.npc(actor.id).walkTo(entry.at)
      if (!current()) return
    }
    if (entry.facing) actor.face(entry.facing)
    if (entry.animation) actor.idle(entry.animation)
    if (entry.hidden) actor.setHidden(true)
  }

  /** A speech bubble over the player or an NPC (translated, markup removed). */
  bark(key: string, text: string, options: { duration?: number } = {}): Promise<void> {
    if (isFastForward()) return Promise.resolve()
    if (key !== 'player' && !this.actors.has(key)) return Promise.resolve()
    return this.bubbles.show(key, stripMarkup(t(text)), options.duration)
  }

  /** An emote balloon over the player or an NPC (src/content/emotes.ts). */
  emote(key: string, name: string, options: { duration?: number } = {}): Promise<void> {
    if (isFastForward()) return Promise.resolve()
    if (key !== 'player' && !this.actors.has(key)) return Promise.resolve()
    const entry = (emotes.list as Record<string, string | { text: string; color?: string }>)[name]
    if (entry === undefined) {
      console.warn(`[map] emote("${name}"): no such emote in src/content/emotes.ts`)
      return Promise.resolve()
    }
    const look = typeof entry === 'string' ? { text: entry } : entry
    return this.bubbles.show(key, look.text, options.duration ?? emotes.durationMs, {
      color: look.color,
      size: emotes.size,
      fill: emotes.balloon.fill,
      outline: emotes.balloon.outline,
    })
  }

  // ---------------------------------------------------------------- scripted player + camera

  private playerWalk(steps: readonly WalkStep[]): Promise<void> {
    let legs: WalkLeg[]
    try {
      legs = walkLegs(this.pos, steps, player.speed)
    } catch (error) {
      return Promise.reject(error)
    }
    this.playerScript?.resolve()
    const last = legs[legs.length - 1]
    if (legs.length === 0 || (isFastForward() && last)) {
      // Replaying a scene: arrive at once.
      if (last) this.place(last.x, last.y, last.facing)
      this.playerScript = null
      return Promise.resolve()
    }
    return new Promise((resolve) => {
      this.playerScript = { legs, resolve }
    })
  }

  private async playerWalkTo(to: TilePos, speed?: number): Promise<boolean> {
    const grid = this.grid
    if (!grid) return false
    const from = { x: Math.floor(this.pos.x), y: Math.floor(this.pos.y) }
    const path = findPath(this.pathGrid(), grid.width, grid.height, from, to)
    if (!path) {
      console.warn(`[map] the player can't walk to ${to.x},${to.y}`)
      return false
    }
    // First to the middle of the current tile, then tile by tile.
    const dx = from.x + 0.5 - this.pos.x
    const dy = from.y + 0.5 - this.pos.y
    const centre: WalkStep[] = []
    if (Math.abs(dx) > 0.01) centre.push(dx > 0 ? { right: dx } : { left: -dx })
    if (Math.abs(dy) > 0.01) centre.push(dy > 0 ? { down: dy } : { up: -dy })
    const withSpeed = speed ? centre.map((c) => ({ ...c, speed })) : centre
    await this.playerWalk([...withSpeed, ...toWalkSteps(path, speed)])
    return true
  }

  private stepPlayerScript(dt: number) {
    const script = this.playerScript
    if (!script) return
    let budget = dt
    while (budget > 0 && this.playerScript === script) {
      const leg = script.legs[0]
      if (!leg) break
      if (this.pos.facing !== leg.facing || !this.playerMoving) {
        this.pos.facing = leg.facing
        this.playerMoving = true
        this.drawPlayer()
      }
      const dx = leg.x - this.pos.x
      const dy = leg.y - this.pos.y
      const distance = Math.abs(dx) + Math.abs(dy)
      const reach = leg.speed * budget
      if (reach < distance) {
        this.pos.x += (dx / distance) * reach
        this.pos.y += (dy / distance) * reach
        break
      }
      this.pos.x = leg.x
      this.pos.y = leg.y
      budget -= distance / leg.speed
      script.legs.shift()
      if (script.legs.length === 0) {
        this.playerScript = null
        this.playerMoving = false
        this.drawPlayer()
        // Arriving on an exit/trigger doesn't fire it; the player has to step on it again.
        this.standingOn = new Set(this.objectsUnderPlayer())
        script.resolve()
      }
    }
  }

  /** Resizes labels, bubbles and the prompt (re-rendered sharp at the new size). */
  private setTextScale(scale: number) {
    if (Math.abs(scale - this.textScale) < 0.01) return
    this.textScale = scale
    const resolution = (window.devicePixelRatio || 1) * scale
    for (const text of [this.prompt, ...this.labels.map((l) => l.text)]) {
      text.scale.set(scale)
      text.resolution = resolution
    }
    this.bubbles.setScale(scale)
  }

  /** Where a camera target is right now, in tiles. */
  private cameraTargetPos(target: CameraTarget): { x: number; y: number } {
    if (target.kind === 'point') return { x: target.x, y: target.y }
    if (target.kind === 'npc') {
      const actor = this.actors.get(target.id)
      if (actor) {
        const feet = actor.feet()
        return { x: feet.x / this.tileSize, y: (feet.y - actor.sprite.height / 2) / this.tileSize }
      }
    }
    return { x: this.pos.x, y: this.pos.y }
  }

  // ---------------------------------------------------------------- dev tools

  /** Where the player is (dev panel). */
  debugInfo() {
    if (!this.map) return null
    return {
      x: Math.round(this.pos.x * 100) / 100,
      y: Math.round(this.pos.y * 100) / 100,
      tile: { x: Math.floor(this.pos.x), y: Math.floor(this.pos.y) },
      facing: this.pos.facing,
      clock: clock.label(),
    }
  }

  /**
   * The map exactly as it is on the game screen right now (what the camera shows, not the whole
   * map), full size. Null if it can't be read.
   */
  screenCanvas(): HTMLCanvasElement | null {
    try {
      return this.app.renderer.extract.canvas({
        target: this.app.stage,
        frame: this.app.screen,
        // What shows where the map draws nothing (the map's own background colour).
        clearColor: this.app.renderer.background.color,
      }) as HTMLCanvasElement
    } catch (error) {
      console.warn('[world] screenshot failed', error)
      return null
    }
  }

  /** Puts the player at an exact tile position. Objects there don't fire onEnter. */
  private place(x: number, y: number, facing: Facing = this.pos.facing) {
    this.pos.x = x
    this.pos.y = y
    this.pos.facing = facing
    this.standingOn = new Set(this.objectsUnderPlayer())
    this.drawPlayer()
  }

  private drawPlayer() {
    if (this.playerSprite) {
      this.playerSprite.show(this.playerMoving ? 'walk' : 'idle', this.pos.facing)
      return
    }
    const ts = this.tileSize
    const size = player.size * ts
    const g = this.playerShape
    g.clear()
    g.roundRect(-size / 2, -size / 2, size, size, size * 0.3).fill(player.color)
    // A small dot shows which way the player faces.
    const d = size * 0.28
    const offset = { up: [0, -d], down: [0, d], left: [-d, 0], right: [d, 0] }[this.pos.facing]
    g.circle(offset[0] ?? 0, offset[1] ?? 0, size * 0.12).fill('#1b1b1b')
  }

  private objectsAt(tile: TilePos) {
    return this.objects.filter((o) => {
      const actor = this.actorOf(o)
      return objectContains(o, tile) && !actor?.hidden && !actor?.walking
    })
  }

  /**
   * The object the player would interact with: a sprite whose "interact" area (or collision)
   * is just in front of the player, else the tile in front, else the tile underfoot.
   */
  private interactable() {
    const step = STEP_OF[this.pos.facing]
    const probe = {
      x: this.pos.x + step.x * (this.hitbox.hx + REACH),
      y: this.pos.y + step.y * (this.hitbox.hy + REACH),
    }
    for (const actor of this.actors.values()) {
      // NPCs can't be talked to while they walk.
      if (actor.hidden || actor.walking) continue
      if (actor.object.onInteract && inBoxes(actor.boxes('interact'), probe.x, probe.y))
        return actor.object
    }
    // Objects placed between tiles: by their exact area.
    const offGrid = this.objects.find(
      (o) =>
        o.onInteract &&
        hasOffset(o) &&
        !this.actorOf(o) &&
        inBoxes([objectArea(o)], probe.x, probe.y),
    )
    if (offGrid) return offGrid
    const { here, ahead } = tilesAround(this.pos.x, this.pos.y, this.pos.facing)
    return (
      this.objectsAt(ahead).find((o) => o.onInteract) ??
      this.objectsAt(here).find((o) => o.onInteract)
    )
  }

  /**
   * Objects the player stands on: by tile, except sprites with "trigger" slices and objects
   * placed between tiles, which count when the player's centre is inside them.
   */
  private objectsUnderPlayer(): MapObject[] {
    const tile = tilesAround(this.pos.x, this.pos.y, this.pos.facing).here
    const result: MapObject[] = []
    for (const o of this.objects) {
      const actor = this.actorOf(o)
      if (actor?.hidden) continue
      const triggers = actor?.boxes('triggers')
      if (triggers) {
        if (inBoxes(triggers, this.pos.x, this.pos.y)) result.push(o)
      } else if (!actor && hasOffset(o)) {
        if (inBoxes([objectArea(o)], this.pos.x, this.pos.y)) result.push(o)
      } else if (objectContains(o, tile)) result.push(o)
    }
    return result
  }

  /** True while a map object's onInteract/onEnter handler runs. The clock waits. Ambient barks don't count. */
  get interacting() {
    return this.busy
  }

  /**
   * Forgets the handler that is running. For events.abort(): the aborted event never finishes, so
   * the handler waiting for it never returns, and the player would stay frozen for good.
   */
  dropInteraction() {
    this.runId++
    this.busy = false
  }

  private kindAt(x: number, y: number): TerrainKind | undefined {
    const grid = this.grid
    if (!grid || x < 0 || y < 0 || x >= grid.width || y >= grid.height) return undefined
    const name = this.terrain[y * grid.width + x]
    return name ? (terrainConfig.kinds as Record<string, TerrainKind>)[name] : undefined
  }

  /** The pushable object right in front of the player, if any. */
  private pushableAhead(): Actor | undefined {
    const step = STEP_OF[this.pos.facing]
    const probe = {
      x: this.pos.x + step.x * (this.hitbox.hx + REACH),
      y: this.pos.y + step.y * (this.hitbox.hy + REACH),
    }
    for (const actor of this.actors.values()) {
      const object = actor.object
      if (!object.pushable || actor.hidden || actor.walking || hasOffset(object)) continue
      if (inBoxes(actor.boxes() ?? [objectArea(object)], probe.x, probe.y)) return actor
    }
    return undefined
  }

  /**
   * The player keeps walking into something (`blockedAhead`): after a short lean a pushable
   * object slides one tile, or the player hops over a jumpable tile (terrain `jump`).
   */
  private pushOrJump(dt: number, blockedAhead: boolean) {
    const grid = this.grid
    if (!blockedAhead || !grid) {
      this.leaning = null
      return
    }
    const facing = this.pos.facing
    const actor = this.pushableAhead()
    const here = tilesAround(this.pos.x, this.pos.y, facing).here
    let land = actor
      ? null
      : jumpLanding(here, facing, grid, this.pathGrid(), (x, y) => this.kindAt(x, y))
    // Not onto a character or a barrel either.
    if (land && inBoxes(this.actorBoxes, land.x + 0.5, land.y + 0.5)) land = null
    const key = actor ? `push:${actor.id}` : land ? `jump:${land.x},${land.y}` : ''
    if (!key) {
      this.leaning = null
      return
    }
    if (this.leaning?.key !== key) this.leaning = { key, ms: 0 }
    this.leaning.ms += dt * 1000
    if (this.leaning.ms < (actor ? player.push.delayMs : player.jump.delayMs)) return
    this.leaning = null
    if (actor) this.push(actor, facing)
    else if (land) {
      const sound = player.jump.sound
      if (sound && audio.has(sound)) audio.sfx(sound, { volume: 0.6 })
      this.hop = {
        fromX: this.pos.x,
        fromY: this.pos.y,
        toX: land.x + 0.5,
        toY: land.y + 0.5,
        t: 0,
      }
    }
  }

  /** Slides a pushable object one tile, if nothing is in the way. */
  private push(actor: Actor, facing: Facing) {
    const grid = this.grid
    if (!grid) return
    const own = objectArea(actor.object)
    const others: Box[] = []
    for (const other of this.actors.values()) {
      if (other === actor || other.hidden || !other.object.solid) continue
      others.push(...(other.boxes() ?? [objectArea(other.object)]))
    }
    if (pushBlocked(shifted(own, facing), own, grid, this.pathGrid(), others)) return
    const from = { ...actor.object.at }
    const sound = player.push.sound
    if (sound && audio.has(sound)) audio.sfx(sound, { volume: 0.6 })
    const map = this.mapId
    this.pushing = true
    void actor.walk([{ [facing]: 1, speed: player.push.speed }]).finally(() => {
      // The map changed while it slid: nothing left to do here.
      if (map !== this.mapId || this.actors.get(actor.id) !== actor) return
      this.pushing = false
      const object = actor.object
      const to = { ...object.at }
      if (object.id && !object.pushReset) {
        const memory = propMemory(map, object.id)
        memory.set('pushedX', to.x)
        memory.set('pushedY', to.y)
      }
      const centre = {
        x: to.x + (object.size?.w ?? 1) / 2,
        y: to.y + (object.size?.h ?? 1) / 2,
      }
      // What it now stands on (a pressure plate, a hole): by trigger slices, else by tile.
      const on = this.objects
        .filter(
          (o) =>
            o !== object &&
            o.id &&
            inBoxes(this.actorOf(o)?.boxes('triggers') ?? [objectArea(o)], centre.x, centre.y),
        )
        .map((o) => o.id as string)
      const hook = object.onPushed
      if (hook) this.run(object, (ctx) => hook({ ...ctx, from, to, on }))
    })
  }

  private stepHop(dt: number) {
    const hop = this.hop
    if (!hop) return
    hop.t = Math.min(1, hop.t + (dt * 1000) / Math.max(1, player.jump.ms))
    this.pos.x = hop.fromX + (hop.toX - hop.fromX) * hop.t
    this.pos.y = hop.fromY + (hop.toY - hop.fromY) * hop.t
    if (hop.t < 1) return
    this.hop = null
    this.checkEnter()
  }

  private frozen() {
    return (
      this.busy ||
      this.pushing ||
      this.hop !== null ||
      this.playerScript !== null ||
      useSystemStore.getState().mapTransition !== null
    )
  }

  private interact(): boolean {
    if (!this.map || this.frozen()) return false
    const object = this.interactable()
    if (!object?.onInteract) return false
    this.run(object, object.onInteract)
    return true
  }

  private run(object: MapObject, handler: (ctx: MapObjectContext) => void | Promise<void>) {
    this.busy = true
    const run = ++this.runId
    // NPCs look at the player while talking, then turn back (unless the script turned them).
    const actor = [...this.actors.values()].find((a) => a.object === object)
    let turned: { from: Facing; to: Facing } | undefined
    if (actor && object.turnToPlayer !== false && !actor.walking) {
      const to = facingToward({ x: actor.x + 0.5, y: actor.y + 0.5 }, this.pos, actor.facing)
      turned = { from: actor.facing, to }
      actor.face(to)
    }
    Promise.resolve(handler({ game: getGame(), world: this.api(), object }))
      .catch((error: unknown) => console.error('[map object]', error))
      .finally(() => {
        if (run !== this.runId) return
        this.busy = false
        if (actor && turned && actor.facing === turned.to && !actor.walking) actor.face(turned.from)
      })
  }

  private readonly tick = (ticker: Ticker) => {
    const grid = this.grid
    if (!this.map || !grid) return
    const dt = Math.min(ticker.deltaMS / 1000, 0.1)

    if (this.hop) this.stepHop(dt)
    else if (this.playerScript) this.stepPlayerScript(dt)
    else if (!this.frozen()) {
      const move = input.move('map')
      const ground = this.groundHere()
      // On a ladder: up and down only, always facing it.
      if (ground?.ladder) move.x = 0
      const facing = ground?.ladder ? 'up' : facingFrom(move.x, move.y, this.pos.facing)
      const moving = move.x !== 0 || move.y !== 0
      if (facing !== this.pos.facing || moving !== this.playerMoving) {
        this.pos.facing = facing
        this.playerMoving = moving
        this.drawPlayer()
      }
      if (move.x !== 0 || move.y !== 0) {
        const step = player.speed * (ground?.speed ?? 1) * dt
        const next = moveBox(
          grid,
          this.pos.x,
          this.pos.y,
          { x: this.hitbox.hx, y: this.hitbox.hy },
          move.x * step,
          move.y * step,
          this.solidBoxes,
        )
        // Still walking into what is ahead: push it, or jump over it.
        const ahead = STEP_OF[facing]
        const wanted = move.x * ahead.x + move.y * ahead.y
        const advanced = (next.x - this.pos.x) * ahead.x + (next.y - this.pos.y) * ahead.y
        this.pos.x = next.x
        this.pos.y = next.y
        this.checkEnter()
        if (!this.frozen()) this.pushOrJump(dt, wanted > 0.5 && advanced < 1e-4)
      } else this.leaning = null
    } else if (this.playerMoving) {
      this.playerMoving = false
      this.drawPlayer()
    }
    for (const callback of this.tickCallbacks) callback(dt)
    // NPCs keep animating (and walking) during events and while the player is frozen.
    const now = performance.now()
    for (const actor of this.actors.values()) actor.update(dt, now)
    this.updateSchedules()
    this.updateSounds()
    this.playerSprite?.update(now)
    this.animateTiles()
    this.layout()
  }

  /** Animated tiles all follow one clock, so tiles of the same animation stay in sync. */
  private animateTiles() {
    if (this.animated.length === 0) return
    const now = performance.now()
    for (const tile of this.animated) {
      let t = now % tile.total
      for (const frame of tile.frames) {
        if (t < frame.duration) {
          if (tile.sprite.texture !== frame.texture) tile.sprite.texture = frame.texture
          break
        }
        t -= frame.duration
      }
    }
  }

  private actorOf(object: MapObject) {
    if (!isActor(object)) return undefined
    for (const actor of this.actors.values()) if (actor.object === object) return actor
    return undefined
  }

  /** Fires onEnter for objects the player just stepped onto. */
  private checkEnter() {
    const here = this.objectsUnderPlayer()
    const entered = here.filter((o) => !this.standingOn.has(o))
    this.standingOn = new Set(here)
    const target = entered.find((o) => o.onEnter)
    if (target?.onEnter) this.run(target, target.onEnter)
    else this.rollEncounter()
  }

  /** What a minimap draws: walls, the player, doors and characters (tiles). Null = no map. */
  minimap(): MinimapData | null {
    const grid = this.grid
    if (!grid || !this.map) return null
    const centre = (box: Box) => ({ x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2 })
    return {
      map: this.mapId,
      hidden: this.map.minimap === false,
      width: grid.width,
      height: grid.height,
      solid: grid.solid,
      player: { x: this.pos.x, y: this.pos.y },
      doors: this.objects
        .filter((o) => o.door)
        .map((o) => ({
          x: objectPos(o).x + (o.size?.w ?? 1) / 2,
          y: objectPos(o).y + (o.size?.h ?? 1) / 2,
        })),
      actors: this.actorBoxes.map(centre),
    }
  }

  /** The terrain name under the player's feet (src/content/terrain.ts), or undefined. */
  terrainUnderPlayer(): string | undefined {
    const grid = this.grid
    if (!grid) return undefined
    const x = Math.floor(this.pos.x)
    const y = Math.floor(this.pos.y + this.hitbox.hy * 0.9)
    if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) return undefined
    return this.terrain[y * grid.width + x]
  }

  private groundHere(): TerrainKind | undefined {
    const name = this.terrainUnderPlayer()
    return name ? (terrainConfig.kinds as Record<string, TerrainKind>)[name] : undefined
  }

  /** A new tile walked: its footstep, and what the ground does to the party. */
  private stepOnGround() {
    const ground = this.groundHere()
    const steps = terrainConfig.footsteps
    const sound = ground?.footstep ?? steps.default
    this.stepsSinceSound++
    if (sound && this.stepsSinceSound >= steps.everyTiles && audio.has(sound)) {
      this.stepsSinceSound = 0
      audio.sfx(sound, {
        volume: steps.volume,
        rate: 1 + (Math.random() * 2 - 1) * steps.pitchSpread,
      })
    }
    if (ground?.damage) {
      const game = getGame()
      let hurt = false
      for (const id of game.party.members()) {
        const hp = game.party.current(id, 'hp' as never)
        const damage = Math.round(ground.damage * difficulty.rate('terrainDamage'))
        const loss = Math.min(damage, ground.lethal ? hp : Math.max(0, hp - 1))
        if (loss <= 0) continue
        game.party.change(id, 'hp' as never, -loss)
        hurt = true
      }
      if (hurt && ground.damageSound && audio.has(ground.damageSound))
        audio.sfx(ground.damageSound, { volume: 0.6 })
      // Everyone down on lethal ground: the same as a lost battle.
      if (
        ground.lethal &&
        game.party.members().length > 0 &&
        game.party.members().every((id) => game.party.current(id, 'hp' as never) <= 0)
      )
        void game.gameOver().catch((error: unknown) => reportError('game over', error))
    }
  }

  /** Each new tile walked in an encounter zone may start a battle (never in the first steps). */
  private rollEncounter() {
    const tile = `${Math.floor(this.pos.x)},${Math.floor(this.pos.y)}`
    if (tile === this.lastTile) return
    this.lastTile = tile
    this.stepsSinceBattle++
    this.stepOnGround()
    const zone = [...this.standingOn].find((o) => o.encounters && o.encounters.groups.length > 0)
    if (!zone?.encounters || this.stepsSinceBattle < MIN_STEPS_BETWEEN_BATTLES) return
    const chance =
      (zone.encounters.rate ?? battleConfig.encounters.rate) *
      (this.groundHere()?.encounters ?? 1) *
      difficulty.rate('encounters')
    if (Math.random() >= chance) return
    const encounters = zone.encounters
    this.stepsSinceBattle = 0
    this.run(zone, ({ game }) => game.battles.encounter(encounters).then(() => {}))
  }

  /** Lights of objects (and the player) in screen pixels. */
  private screenLights(ox: number, oy: number, zoom: number, px: number, py: number) {
    const ts = this.tileSize
    const lights: ScreenLight[] = []
    const add = (light: LightConfig, x: number, y: number, seed: number) =>
      lights.push({
        x: x + (light.offset?.x ?? 0) * zoom,
        y: y + (light.offset?.y ?? 0) * zoom,
        radius: (light.radius ?? 3) * ts * zoom,
        color: light.color ?? '#ffd59a',
        intensity: light.intensity ?? 1,
        flicker: light.flicker ?? 0,
        seed,
      })
    this.objects.forEach((object, i) => {
      if (!object.light) return
      const actor = this.actorOf(object)
      if (actor?.hidden) return
      if (actor) {
        const feet = actor.feet()
        const middle = feet.y - actor.sprite.height / 2
        add(object.light, ox + feet.x * zoom, oy + middle * zoom, i * 7.3)
        return
      }
      const { w, h } = object.size ?? { w: 1, h: 1 }
      const p = objectPos(object)
      add(object.light, ox + (p.x + w / 2) * ts * zoom, oy + (p.y + h / 2) * ts * zoom, i * 7.3)
    })
    // The player's own light, and the carried items that are switched on (a lit lantern).
    if (player.light) add(player.light, px + ox, py + oy, 0.5)
    getGame()
      .items.lights()
      .forEach((light, i) => {
        add(light, px + ox, py + oy, 0.5 + (i + 1) * 3.1)
      })
    return lights
  }

  /** Zoom, camera, and the unscaled overlay. */
  private layout() {
    const grid = this.grid
    if (!grid || !this.map) return
    const ts = this.tileSize
    const { width, height } = this.app.screen
    const zoom = this.camera.zoom(height, ts, this.map.zoom ?? 1)
    this.setTextScale(height / screen.map.textHeight)
    const s = this.textScale
    this.root.scale.set(zoom)
    const px = this.pos.x * ts * zoom
    const py = this.pos.y * ts * zoom
    this.camera.update()
    const ox = Math.round(cameraOffset(this.camera.at.x * ts * zoom, width, grid.width * ts * zoom))
    const oy = Math.round(
      cameraOffset(this.camera.at.y * ts * zoom, height, grid.height * ts * zoom),
    )
    this.root.position.set(ox, oy)
    // Outdoor maps follow the clock unless a script or the map set their own colour.
    if (!this.lightingOverride && !this.map.lighting && this.map.outdoor) {
      const { tint, strength } = clock.tint()
      this.atmosphere.setTint(tint, strength)
    }
    const scroll = { x: ox - this.lastOffset.x, y: oy - this.lastOffset.y }
    this.lastOffset = { x: ox, y: oy }
    this.atmosphere.update(
      this.app.ticker.deltaMS / 1000,
      width,
      height,
      scroll,
      this.screenLights(ox, oy, zoom, px, py),
    )
    const seconds = this.app.ticker.deltaMS / 1000
    this.backdrop?.update(seconds, ox, oy, zoom, width, height)
    this.overlayPictures?.update(seconds, ox, oy, zoom, width, height)
    this.debug.draw(
      {
        grid: this.grid,
        tileSize: ts,
        solidBoxes: this.solidBoxes,
        actors: this.actors.values(),
        objects: this.objects,
        hitbox: this.hitbox,
        pos: this.pos,
      },
      ox,
      oy,
      zoom,
    )
    if (this.playerSprite) {
      // pos is the hitbox centre; the sprite's origin (feet) is drawn relative to it.
      const feetY = this.pos.y * ts + this.hitbox.feetY
      // A jump lifts the sprite; its place in the drawing order stays on the ground.
      const lift = this.hop ? hopArc(this.hop.t) * player.jump.height * ts : 0
      this.playerView.position.set(this.pos.x * ts + this.hitbox.feetX, feetY - lift)
      this.playerView.zIndex = feetY
    } else {
      this.playerView.position.set(this.pos.x * ts, this.pos.y * ts)
      this.playerView.zIndex = (this.pos.y + player.size / 2) * ts
    }

    for (const { object, text } of this.labels) {
      const actor = this.actorOf(object)
      text.visible = !actor?.hidden
      if (actor) {
        const feet = actor.feet()
        text.position.set(ox + feet.x * zoom, oy + actor.top() * zoom - 2 * s)
        continue
      }
      const w = object.size?.w ?? 1
      const p = objectPos(object)
      text.position.set(ox + (p.x + w / 2) * ts * zoom, oy + p.y * ts * zoom - 2 * s)
    }
    // Bubbles above heads (and above the name label, if there is one).
    const playerHead = () => {
      const feet = py + (this.playerSprite ? this.hitbox.feetY : (player.size / 2) * ts) * zoom
      const height = this.playerSprite ? this.playerSprite.height : player.size * ts
      return { x: px + ox, y: oy + feet - height * zoom - 4 * s }
    }
    this.bubbles.update(this.app.ticker.deltaMS, (key) => {
      if (key === 'player') return playerHead()
      const actor = this.actors.get(key)
      if (!actor || actor.hidden) return null
      const label = actor.object.label ? 16 : 0
      return { x: ox + actor.feet().x * zoom, y: oy + actor.top() * zoom - (4 + label) * s }
    })

    const target = this.frozen() ? undefined : this.interactable()
    this.prompt.visible = target !== undefined
    if (target) {
      // The confirm key/button (E, A, ✕…), or look/map.ts prompt.touch on touch screens.
      const label = actionLabel('confirm')?.label ?? promptTouchText
      if (this.prompt.text !== label) this.prompt.text = label
      // Above the head: the top of the sprite, or of the square without one.
      const head = playerHead()
      this.prompt.position.set(head.x, head.y)
      // A bubble over the player hides the prompt behind it.
      this.prompt.visible = !this.bubbles.has('player')
    }
  }
}

/**
 * The player's hitbox in tiles: the sprite's collision slices (their bounding box) when it has
 * them, else the player.size square with the feet at its bottom edge.
 */
function playerHitbox(tileSize: number) {
  const box = player.sprite ? collisionBounds(player.sprite) : undefined
  if (!box) {
    const half = player.size / 2
    return { hx: half, hy: half, feetX: 0, feetY: half * tileSize }
  }
  // Feet (origin) relative to the box centre, in pixels.
  return {
    hx: box.w / 2 / tileSize,
    hy: box.h / 2 / tileSize,
    feetX: -(box.x + box.w / 2),
    feetY: -(box.y + box.h / 2),
  }
}

/** Creates the Pixi Application and the World. Use getWorld() instead (it loads this lazily). */
export async function createWorld(): Promise<World> {
  const app = new Application()
  await app.init({
    resizeTo: window,
    background: '#000000',
    antialias: false,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
    preference: 'webgl',
    roundPixels: true,
  })
  return new World(app)
}
