// Image and sound quality, sizes and memory. Edit freely: this is game content, not engine.
// Two builds: the normal one (`pnpm build`) keeps everything exactly as in your files, the lite one
// (`--lite`, for weaker devices) shrinks big pictures and sounds. Dev always uses your files.
import { defineMedia } from '@/core/media'

export default defineMedia({
  images: {
    // First matching rule wins (paths inside src/content).
    convert: [
      // Gallery CGs: lossless WebP. Lite: half size, lossy.
      { match: 'gallery/**', format: 'webp', lite: { scale: 0.5, quality: 85 } },
      // Event backgrounds (put them in a folder called backgrounds): same as CGs.
      { match: '**/backgrounds/**', format: 'webp', lite: { scale: 0.5, quality: 85 } },
      // Everything else (pixel art, tilesets, sprites, portraits): lossless WebP in both builds.
      // Their sizes are in pixels, so they can't be shrunk.
      { match: '**', format: 'webp' },
    ],

    // Extras → Gallery grid.
    thumbnails: { width: 480, quality: 80 },

    // Images of recently left maps kept loaded (MB), on top of the current map's.
    memoryMB: { desktop: 1024, mobile: 256, browser: 512 },
  },

  audio: {
    convert: [
      // Voices: speech sounds fine at a low bitrate.
      { match: 'audio/voice/**', format: 'flac', lite: { opusKbps: 48 } },
      // Music, ambience, sound effects.
      { match: '**', format: 'flac', lite: { opusKbps: 96 } },
    ],

    // Sounds kept ready to play (MB) besides the ones playing right now. A minute of stereo music
    // takes about 21 MB once loaded, whatever the file size. Older ones are dropped first and
    // simply load again when needed.
    memoryMB: { desktop: 256, mobile: 64, browser: 128 },
  },

  events: {
    // Pictures an event loads ahead of the one on screen.
    preloadAhead: 3,
  },
})
