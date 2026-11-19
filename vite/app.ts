// src/content/config/app.ts in the page: the <title> is the game's name, and icon.png (browser tab,
// Electron window) is the app icon from src/content, served in dev and written into the build.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'
import app from '../src/content/config/app.ts'
import { MAIN_ICON, resolveApp } from '../src/core/app.ts'

const APP = resolveApp(app)
const CONTENT = join(import.meta.dirname, '../src/content')

/** The app icon file on disk. */
export const appIconPath = (): string => join(CONTENT, MAIN_ICON)

/** A colour safe to put into a <style> (anything odd falls back to black). */
const cssColour = (value: string) => (/^[\w#(),.%\s-]+$/.test(value) ? value : '#000000')

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function appPlugin(): Plugin {
  return {
    name: 'game-app',
    // The page's own background before the game draws: app.ts splashBackground (like Android).
    transformIndexHtml: (html) =>
      html
        .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(APP.name)}</title>`)
        .replace(
          '</head>',
          `  <style>html { background: ${cssColour(APP.splashBackground)}; }</style>\n  </head>`,
        ),
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/icon.png') return next()
        res.setHeader('Content-Type', 'image/png')
        res.end(readFileSync(appIconPath()))
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'icon.png', source: readFileSync(appIconPath()) })
    },
  }
}

/** The game's version for __APP_VERSION__. */
export const appVersion = APP.version
