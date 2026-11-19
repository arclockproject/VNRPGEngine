// CSS for drawing an image or atlas frame as a part of a portrait. Everything is in % of the
// base image, so the portrait scales freely.
import type { ImageSource } from './define'

export interface PartCss {
  display: string
  left: string
  top: string
  width: string
  height: string
  backgroundImage: string
  backgroundSize: string
  backgroundPosition: string
}

const pct = (value: number) => `${value}%`

export const HIDDEN: PartCss = {
  display: 'none',
  left: '0',
  top: '0',
  width: '0',
  height: '0',
  backgroundImage: 'none',
  backgroundSize: 'auto',
  backgroundPosition: '0 0',
}

/**
 * Places `source` at (x, y) on a base image of size baseW × baseH.
 * Plain image files need their pixel size (`fileSize`); until it is known the part is hidden.
 */
export function partCss(
  source: ImageSource,
  x: number,
  y: number,
  baseW: number,
  baseH: number,
  fileSize?: { w: number; h: number },
): PartCss {
  if (typeof source === 'string') {
    if (!fileSize || fileSize.w === 0) return HIDDEN
    return {
      display: 'block',
      left: pct((x / baseW) * 100),
      top: pct((y / baseH) * 100),
      width: pct((fileSize.w / baseW) * 100),
      height: pct((fileSize.h / baseH) * 100),
      backgroundImage: `url("${source}")`,
      backgroundSize: '100% 100%',
      backgroundPosition: '0 0',
    }
  }
  // Atlas frame: scale the whole sheet so the frame fills the element, then shift it into view.
  const { sheetWidth: sw, sheetHeight: sh, w, h } = source
  const posX = sw === w ? 0 : (source.x / (sw - w)) * 100
  const posY = sh === h ? 0 : (source.y / (sh - h)) * 100
  return {
    display: 'block',
    left: pct((x / baseW) * 100),
    top: pct((y / baseH) * 100),
    width: pct((w / baseW) * 100),
    height: pct((h / baseH) * 100),
    backgroundImage: `url("${source.atlas}")`,
    backgroundSize: `${(sw / w) * 100}% ${(sh / h) * 100}%`,
    backgroundPosition: `${posX}% ${posY}%`,
  }
}
