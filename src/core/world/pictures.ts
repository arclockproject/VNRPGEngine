// Pictures behind or over the map (Tiled image layers): far hills that move slower than the map
// (parallax), fog and clouds that drift. Drawn inside the map's root container, so they zoom
// with it.
import { Assets, Container, type Texture, TilingSprite } from 'pixi.js'
import type { PictureLayer } from './layout'

interface Shown {
  layer: PictureLayer
  sprite: TilingSprite
  texture: Texture
}

export class Pictures {
  readonly view = new Container()
  private shown: Shown[] = []
  private time = 0

  /** Images must be loaded already (World.preload). */
  constructor(layers: readonly PictureLayer[]) {
    for (const layer of layers) {
      if (!Assets.cache.has(layer.image)) continue
      const texture = Assets.get<Texture>(layer.image)
      const sprite = new TilingSprite({ texture, width: texture.width, height: texture.height })
      sprite.alpha = layer.opacity
      if (layer.blend) sprite.blendMode = layer.blend
      this.view.addChild(sprite)
      this.shown.push({ layer, sprite, texture })
    }
  }

  get empty(): boolean {
    return this.shown.length === 0
  }

  /**
   * `ox`/`oy` = where the map's top-left is on screen (px), `zoom` = screen px per map px,
   * `width`/`height` = the screen. Everything here is in map pixels (the root is scaled).
   */
  update(dt: number, ox: number, oy: number, zoom: number, width: number, height: number) {
    this.time += dt
    for (const { layer, sprite, texture } of this.shown) {
      const driftX = layer.drift.x * this.time
      const driftY = layer.drift.y * this.time
      // A layer with parallax p is drawn as if the camera had only moved p of the way.
      const shiftX = layer.x + driftX - (ox * (1 - layer.parallax.x)) / zoom
      const shiftY = layer.y + driftY - (oy * (1 - layer.parallax.y)) / zoom
      if (layer.repeat.x) {
        // Cover the screen and slide the pattern instead of the sprite.
        sprite.x = -ox / zoom
        sprite.width = width / zoom
        sprite.tilePosition.x = shiftX - sprite.x
      } else {
        sprite.x = shiftX
        sprite.width = texture.width
        sprite.tilePosition.x = 0
      }
      if (layer.repeat.y) {
        sprite.y = -oy / zoom
        sprite.height = height / zoom
        sprite.tilePosition.y = shiftY - sprite.y
      } else {
        sprite.y = shiftY
        sprite.height = texture.height
        sprite.tilePosition.y = 0
      }
    }
  }
}
