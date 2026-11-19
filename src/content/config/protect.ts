// Media lock: built games ship their pictures, sounds and videos encrypted, so they can't simply be
// opened from the game folder. Edit freely: this is game content, not engine.
// It only stops casual browsing: the game must unlock its own files, so the key is inside the game
// (the same as every engine). Dev (pnpm dev:*) never locks anything.
import { defineProtect } from '@/core/protect/format'

export default defineProtect({
  media: {
    enabled: true,
    // Any text, made up once for this game. Changing it later changes every locked file, so the
    // next update re-downloads all media.
    key: 'xTHzR1jCK2FH1a8Vpij2UHSd',
    // File endings to lock.
    extensions: [
      'webp',
      'avif',
      'png',
      'jpg',
      'jpeg',
      'gif',
      'wav',
      'ogg',
      'opus',
      'mp3',
      'm4a',
      'flac',
      'mp4',
      'webm',
    ],
    // Files that stay plain: the browser tab icon is read by the browser itself.
    skip: ['icon.png'],
  },
})
