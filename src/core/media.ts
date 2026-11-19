// Types for src/content/config/media.ts: how images and sounds are converted by the build (normal and
// lite), gallery thumbnails, image memory, and how far events load ahead. Read by
// vite/media/ (build) and the game (textures.ts, scene/preload.ts). Must not import content.

/** Settings for the lite build (`--lite`, for weaker devices). */
export interface LiteImage {
  /** Size factor, e.g. 0.5 = half width and height. Only for pictures shown scaled to the screen
   * (CGs, backgrounds): pixel art, tilesets and sprite sheets must keep their size. */
  scale?: number
  /** 1-100 = lossy. Leave it out for lossless. */
  quality?: number
}

/** One image rule. The first rule whose `match` fits an image is used. */
export interface ImageRule {
  /** Glob, relative to src/content: 'gallery/**', '**\/backgrounds/**', '**' (everything). */
  match: string
  /** 'keep' = ship the original file. */
  format: 'webp' | 'avif' | 'keep'
  /** 1-100 = lossy. Leave it out for lossless: every pixel stays exactly as in your file. */
  quality?: number
  /** The lite build. Leave it out to use the same as the normal build. */
  lite?: LiteImage
}

/** One sound rule (paths relative to src/content, e.g. 'audio/voice/**'). First match wins. */
export interface AudioRule {
  match: string
  /** 'flac' = lossless, sounds exactly the same. Only uncompressed files (WAV, AIFF) are converted;
   * files that are already compressed (OGG, MP3, M4A, MP4, OPUS, FLAC) are shipped as they are. */
  format: 'flac' | 'keep'
  /** The lite build: Opus at this bitrate (kbit/s), from any sound file. Leave it out = as above. */
  lite?: { opusKbps: number }
}

export interface MediaConfig {
  images: {
    /** Used by `pnpm build` (dev always serves the originals). A converted file that comes out
     * bigger than the original is dropped and the original is shipped. */
    convert: readonly ImageRule[]
    /** Gallery thumbnails, made from the pictures in src/content/gallery/ (unless one sets its own). */
    thumbnails: {
      /** Width in px (height keeps the picture's shape). */
      width: number
      /** WebP quality 1-100. */
      quality: number
    }
    /**
     * Megabytes of map images (tilesets, sprite sheets) kept loaded besides the current map's, so
     * going back to a recent map is instant. Older ones are freed. The current map is never freed.
     * An image takes about width × height × 4 bytes (a 2048×2048 tileset ≈ 16 MB).
     */
    memoryMB: {
      /** Desktop app (PC, Steam Deck). */
      desktop: number
      /** Android app. */
      mobile: number
      /** Web browser. */
      browser: number
    }
  }
  audio: {
    convert: readonly AudioRule[]
    /**
     * Megabytes of loaded sounds kept besides those playing. A loaded sound takes about
     * seconds × 44100 × channels × 4 bytes (a minute of stereo music ≈ 21 MB). The least recently
     * used go first; a dropped sound loads again when it is next played.
     */
    memoryMB: {
      desktop: number
      mobile: number
      browser: number
    }
  }
  events: {
    /** Pictures (backgrounds, CGs, portraits) an event loads before it needs them, counted from
     * the one on screen. More = less waiting on slow devices, more memory. */
    preloadAhead: number
  }
}

export function defineMedia(config: MediaConfig): MediaConfig {
  return config
}
