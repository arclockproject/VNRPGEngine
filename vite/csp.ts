// Vite plugin: puts the Content-Security-Policy from src/content/config/security.ts into the built
// index.html (a <meta> tag, so it works the same on the web, in Electron's app:// pages and in the
// Android WebView). Build only: the dev server needs inline scripts and a WebSocket for hot reload.
import path from 'node:path'
import { type Plugin, runnerImport } from 'vite'
import { cspText, type SecurityConfig } from '../src/core/security.ts'

const CONFIG_FILE = 'src/content/config/security.ts'

/** The <meta> tag for a policy. */
export function cspMeta(policy: string): string {
  const escaped = policy.replaceAll('&', '&amp;').replaceAll('"', '&quot;')
  return `<meta http-equiv="Content-Security-Policy" content="${escaped}" />`
}

/** Adds the tag right after <head>, before anything that loads. */
export function addCsp(html: string, policy: string | null): string {
  if (policy === null) return html
  return html.replace(/<head([^>]*)>/i, (head) => `${head}\n    ${cspMeta(policy)}`)
}

export function cspPlugin(): Plugin {
  let config: Promise<SecurityConfig> | undefined
  return {
    name: 'game-csp',
    apply: 'build',
    configResolved(resolved) {
      // Loaded through Vite so the content file's '@/core/...' import resolves.
      config = runnerImport<{ default: SecurityConfig }>(path.join(resolved.root, CONFIG_FILE), {
        configFile: false,
        root: resolved.root,
        resolve: { alias: resolved.resolve.alias },
        logLevel: 'silent',
      }).then((result) => result.module.default)
    },
    transformIndexHtml: {
      order: 'post',
      async handler(html) {
        return config ? addCsp(html, cspText(await config)) : html
      },
    },
  }
}
