// Speech bubbles over NPCs and the player on the map (npc.bark('Hi!')). Drawn in the unscaled
// overlay so text stays crisp; the World moves them to each speaker's head every frame.
import { Container, Graphics, Text, type TextStyleOptions } from 'pixi.js'
import { bubbleLook as look } from './mapLook'
import { barkDuration } from './npc'

const FADE_MS = look.fadeMs
const PAD = look.padding
const TAIL = look.tail

interface Bubble {
  view: Container
  age: number
  duration: number
  resolve: () => void
  /** Emotes pop up (a quick overshoot) instead of only fading in. */
  pop?: boolean
}

export class Bubbles {
  readonly view = new Container()
  private readonly items = new Map<string, Bubble>()
  /** Size relative to normal (the World sets it from the screen height). */
  private scale = 1

  /**
   * Shows `text` over `key` ('player' or an NPC id); replaces its previous bubble.
   * `emote` = a small balloon with one big symbol that pops up (src/content/emotes.ts).
   */
  show(
    key: string,
    text: string,
    duration = barkDuration(text),
    emote?: { color?: string; size: number; fill: string; outline: string },
  ): Promise<void> {
    this.remove(key)
    const view = new Container()
    const fill = emote?.fill ?? look.fill
    const outline = emote?.outline ?? look.outline
    const label = new Text({
      text,
      style: {
        fontFamily: look.font,
        fontSize: emote?.size ?? look.size,
        fontWeight: (emote ? '800' : look.weight) as TextStyleOptions['fontWeight'],
        fill: emote?.color ?? look.color,
        wordWrap: true,
        wordWrapWidth: look.maxWidth,
        align: 'center',
      },
      resolution: (window.devicePixelRatio || 1) * this.scale,
    })
    const w = Math.ceil(label.width) + PAD * 2
    const h = Math.ceil(label.height) + PAD * 2
    const top = -h - TAIL
    const shape = new Graphics()
      .roundRect(-w / 2, top, w, h, look.radius)
      .fill(fill)
      .stroke({ color: outline, width: look.outlineWidth })
      .poly([-TAIL, -TAIL, TAIL, -TAIL, 0, 0])
      .fill(fill)
      .moveTo(-TAIL, -TAIL)
      .lineTo(0, 0)
      .lineTo(TAIL, -TAIL)
      .stroke({ color: outline, width: look.outlineWidth })
    label.position.set(-label.width / 2, top + PAD)
    view.addChild(shape, label)
    view.scale.set(this.scale)
    view.alpha = 0
    this.view.addChild(view)
    return new Promise((resolve) => {
      this.items.set(key, { view, age: 0, duration, resolve, pop: emote !== undefined })
    })
  }

  /** Resizes every bubble, now and later ones. */
  setScale(scale: number): void {
    this.scale = scale
    const resolution = (window.devicePixelRatio || 1) * scale
    for (const bubble of this.items.values()) {
      bubble.view.scale.set(scale)
      for (const child of bubble.view.children)
        if (child instanceof Text) child.resolution = resolution
    }
  }

  has(key: string): boolean {
    return this.items.has(key)
  }

  /** Removes a bubble at once (its promise resolves). */
  remove(key: string): void {
    const bubble = this.items.get(key)
    if (!bubble) return
    this.items.delete(key)
    bubble.view.destroy({ children: true })
    bubble.resolve()
  }

  clear(): void {
    for (const key of [...this.items.keys()]) this.remove(key)
  }

  /**
   * Ages and places the bubbles. `anchor` gives the screen point above a speaker's head, or null
   * when they're gone (the bubble then closes).
   */
  update(deltaMs: number, anchor: (key: string) => { x: number; y: number } | null): void {
    for (const [key, bubble] of this.items) {
      const at = anchor(key)
      bubble.age += deltaMs
      if (!at || bubble.age >= bubble.duration + FADE_MS) {
        this.remove(key)
        continue
      }
      const fadeIn = Math.min(1, bubble.age / FADE_MS)
      const fadeOut = Math.min(1, (bubble.duration + FADE_MS - bubble.age) / FADE_MS)
      bubble.view.alpha = Math.min(fadeIn, fadeOut)
      if (bubble.pop) {
        // 0 → 1.25 → 1 over the first 220 ms.
        const t = Math.min(1, bubble.age / 220)
        const size = t < 0.6 ? (t / 0.6) * 1.25 : 1.25 - ((t - 0.6) / 0.4) * 0.25
        bubble.view.scale.set(this.scale * size)
      }
      bubble.view.position.set(Math.round(at.x), Math.round(at.y))
    }
  }
}
