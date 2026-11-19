// What the built game may load and run (its Content-Security-Policy). Edit freely: this is game
// content, not engine. It only applies to built games (pnpm build:*), not to pnpm dev:*.
// The game's own files are always allowed. Add an address here only when the game really talks to
// it; anything not listed is blocked by the browser and shows as an error in the console.
import { defineSecurity } from '@/core/security'

export default defineSecurity({
  contentSecurityPolicy: {
    enabled: true,
    allow: {
      // fetch() / WebSocket targets, e.g. 'https://api.example.com'
      connect: [],
      // Pictures, sounds/videos and fonts from other sites, e.g. 'https://cdn.example.com'
      images: [],
      media: [],
      fonts: [],
      // Stylesheets from other sites, e.g. 'https://fonts.googleapis.com'
      styles: [],
      // Scripts from other sites: each one runs with the game's rights. Keep empty if you can.
      scripts: [],
      // Pages shown in an <iframe>
      frames: [],
    },
    // true lets scripts turn text into code (eval). Only for a library that needs it.
    allowEval: false,
  },
})
