// The map camera: what it follows, pans between targets and the script zoom. World owns one and
// asks it each frame where to look. No PixiJS in here.
import screen from '@/content/config/screen'
import { isFastForward } from '../scene/replay'

export type CameraTarget =
  | { kind: 'player' }
  | { kind: 'npc'; id: string }
  | { kind: 'point'; x: number; y: number }

interface Pan {
  from: { x: number; y: number }
  start: number
  duration: number
  resolve: () => void
}

interface ZoomTween {
  from: number
  to: number
  start: number
  duration: number
  resolve: () => void
}

/** Sine in-out, 0..1. */
const ease = (t: number) => 0.5 - Math.cos(Math.PI * t) / 2

export class WorldCamera {
  /** Tile position the camera centres on. */
  readonly at = { x: 0, y: 0 }
  private target: CameraTarget = { kind: 'player' }
  private pan: Pan | null = null
  /** Script zoom (camera.zoom) on top of the map's own, and its tween. */
  private scriptZoom = 1
  private zoomTween: ZoomTween | null = null
  /** Where a target is right now, in tiles (the world knows its player and NPCs). */
  private readonly locate: (target: CameraTarget) => { x: number; y: number }

  constructor(locate: (target: CameraTarget) => { x: number; y: number }) {
    this.locate = locate
  }

  /** Follows `target` from now on, moving there over `wanted` ms (0 = at once). */
  follow(target: CameraTarget, wanted: number): Promise<void> {
    const duration = isFastForward() ? 0 : wanted
    this.pan?.resolve()
    this.pan = null
    this.target = target
    if (duration <= 0) {
      const to = this.locate(target)
      this.at.x = to.x
      this.at.y = to.y
      return Promise.resolve()
    }
    return new Promise((resolve) => {
      this.pan = { from: { ...this.at }, start: performance.now(), duration, resolve }
    })
  }

  /** Script zoom: 1 = the map's own zoom. */
  zoomTo(level: number, wanted: number): Promise<void> {
    const to = level > 0 && Number.isFinite(level) ? level : 1
    const duration = isFastForward() ? 0 : wanted
    this.zoomTween?.resolve()
    this.zoomTween = null
    if (duration <= 0) {
      this.scriptZoom = to
      return Promise.resolve()
    }
    return new Promise((resolve) => {
      this.zoomTween = { from: this.scriptZoom, to, start: performance.now(), duration, resolve }
    })
  }

  /** Screen pixels per art pixel: depends on the screen height only, not its resolution. */
  zoom(height: number, tileSize: number, mapZoom: number): number {
    const tween = this.zoomTween
    if (tween) {
      const t = Math.min(1, (performance.now() - tween.start) / tween.duration)
      // Even steps in log space feel like a steady zoom.
      this.scriptZoom = tween.from * (tween.to / tween.from) ** ease(t)
      if (t >= 1) {
        this.scriptZoom = tween.to
        this.zoomTween = null
        tween.resolve()
      }
    }
    const fit = height / (tileSize * screen.map.tilesHigh)
    const zoom = fit * mapZoom * this.scriptZoom
    return screen.map.pixelPerfect ? Math.max(1, Math.round(zoom)) : zoom
  }

  /** Once a frame: moves `at` to the target (or along the pan towards it). */
  update() {
    const to = this.locate(this.target)
    const pan = this.pan
    if (!pan) {
      this.at.x = to.x
      this.at.y = to.y
      return
    }
    const e = ease(Math.min(1, (performance.now() - pan.start) / pan.duration))
    this.at.x = pan.from.x + (to.x - pan.from.x) * e
    this.at.y = pan.from.y + (to.y - pan.from.y) * e
    if (performance.now() - pan.start >= pan.duration) {
      this.pan = null
      pan.resolve()
    }
  }

  /** A new map: on the player at once, nothing running. */
  reset() {
    this.finish()
    this.target = { kind: 'player' }
    const to = this.locate(this.target)
    this.at.x = to.x
    this.at.y = to.y
  }

  /** The map is going away: nobody may wait on a pan or zoom forever. */
  finish() {
    this.pan?.resolve()
    this.pan = null
    this.zoomTween?.resolve()
    this.zoomTween = null
    this.scriptZoom = 1
  }
}
