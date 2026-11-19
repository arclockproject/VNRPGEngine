// Movies (src/content/movies/<id>/index.ts): videos that play full screen in events with
// movie('<id>') and unlock in Extras → Movies once they have played.

import type { MovieOptions } from './scene/types'
import type { VariantValue } from './variants'

export interface MovieConfig extends MovieOptions {
  /** Only in the version of the game built with this content variant (src/content/config/variants.ts); left out of the others. */
  only?: VariantValue
  /** Name in Extras → Movies (translated). */
  title: string
  /** The video file: `import video from './intro.webm'` (mp4 or webm). */
  video: string
  /** Picture on its Extras tile. Default: the video's first frame. */
  poster?: string
}

/** Movies are loaded up front, so their files must not import `game`. */
export function defineMovie(config: MovieConfig): MovieConfig {
  return config
}
