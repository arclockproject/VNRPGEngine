// Dev panel "show collision": collision (red), NPC/prop boxes (orange), triggers (green),
// interaction (blue), objects (yellow) with their ids, and the player's hitbox (cyan).
import { type Container, Graphics, Text, type TextStyleOptions } from 'pixi.js'
import type { MapObject } from '../define'
import { useDevStore } from '../dev/store'
import { type Box, type Grid, objectPos } from './grid'
import type { LayoutObject } from './layout'

/** What the overlay reads from the world each frame. */
export interface DebugView {
  grid: Grid | undefined
  tileSize: number
  solidBoxes: readonly Box[]
  actors: Iterable<{ boxes(kind: 'triggers' | 'interact'): readonly Box[] | undefined }>
  objects: readonly LayoutObject[]
  hitbox: { hx: number; hy: number }
  pos: { x: number; y: number }
}

export class DebugOverlay {
  /** In map pixels: add it to the world's scaled root. */
  readonly graphics = new Graphics()
  private texts: { object: MapObject; text: Text }[] = []
  private readonly labelStyle: TextStyleOptions
  /** Not scaled with the map, so the ids stay readable. */
  private readonly labels: Container

  constructor(labels: Container, labelStyle: TextStyleOptions) {
    this.labels = labels
    this.labelStyle = labelStyle
  }

  private dropTexts() {
    for (const { text } of this.texts) text.destroy()
    this.texts = []
  }

  /** The map is going away. */
  clear() {
    this.graphics.removeFromParent()
    this.graphics.clear()
    this.dropTexts()
  }

  draw(view: DebugView, ox: number, oy: number, zoom: number) {
    const g = this.graphics
    g.clear()
    if (!useDevStore.getState().showCollision) {
      if (this.texts.length > 0) this.dropTexts()
      return
    }
    const grid = view.grid
    if (!grid) return
    const ts = view.tileSize
    for (let i = 0; i < grid.solid.length; i++) {
      if (grid.solid[i]) g.rect((i % grid.width) * ts, Math.floor(i / grid.width) * ts, ts, ts)
    }
    g.fill({ color: 0xff1744, alpha: 0.28 })
    const box = (b: Box) => g.rect(b.x0 * ts, b.y0 * ts, (b.x1 - b.x0) * ts, (b.y1 - b.y0) * ts)
    for (const b of view.solidBoxes) box(b)
    g.fill({ color: 0xff9100, alpha: 0.6 })
    for (const actor of view.actors) for (const b of actor.boxes('triggers') ?? []) box(b)
    g.fill({ color: 0x00e676, alpha: 0.35 })
    for (const actor of view.actors) for (const b of actor.boxes('interact') ?? []) box(b)
    g.stroke({ color: 0x2979ff, width: 1 })
    for (const o of view.objects) {
      const { w, h } = o.size ?? { w: 1, h: 1 }
      const p = objectPos(o)
      g.rect(p.x * ts + 0.5, p.y * ts + 0.5, w * ts - 1, h * ts - 1)
    }
    g.stroke({ color: 0xffea00, width: 1, alpha: 0.8 })
    const { hx, hy } = view.hitbox
    g.rect((view.pos.x - hx) * ts, (view.pos.y - hy) * ts, hx * 2 * ts, hy * 2 * ts)
    g.stroke({ color: 0x18ffff, width: 1 })

    // Object ids, kept in sync with the objects on the map.
    const named = view.objects.filter((o) => o.id || o.prop || o.door)
    if (named.length !== this.texts.length || named.some((o, i) => this.texts[i]?.object !== o)) {
      this.dropTexts()
      this.texts = named.map((object) => {
        const name = object.id ?? object.prop ?? ''
        const text = new Text({
          text: object.door ? `${name} → ${object.door.map}` : name,
          style: { ...this.labelStyle, fontSize: 10, fill: '#ffea00' },
        })
        text.anchor.set(0, 0)
        this.labels.addChild(text)
        return { object, text }
      })
    }
    for (const { object, text } of this.texts) {
      const p = objectPos(object)
      text.position.set(ox + p.x * ts * zoom + 2, oy + p.y * ts * zoom + 1)
    }
  }
}
