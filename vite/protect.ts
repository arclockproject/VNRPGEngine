// Vite plugin, build only: the media lock (src/content/config/protect.ts). After the build is written it
// encrypts every matching file in the output folder (format: src/core/protect/format.ts), writes the
// service worker that unlocks them on the web and Android (media-lock.js, from src/core/protect/sw.ts)
// and lock.json, which Electron's main process reads to unlock them itself.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { build as esbuild } from 'esbuild'
import { type Plugin, runnerImport } from 'vite'
import { keyFromText, lockBytes } from '../electron/mediaLock.ts'
import {
  isLocked,
  type LockInfo,
  type ProtectConfig,
  shouldLock,
} from '../src/core/protect/format.ts'

const CONFIG_FILE = 'src/content/config/protect.ts'
const WORKER_SOURCE = 'src/core/protect/sw.ts'
export const WORKER_FILE = 'media-lock.js'
export const LOCK_FILE = 'lock.json'

/** Every file under `dir`, as paths relative to it with '/'. */
function filesIn(dir: string, prefix = ''): string[] {
  return readdirSync(path.join(dir, prefix), { withFileTypes: true }).flatMap((entry) => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) return filesIn(dir, relative)
    return entry.isFile() ? [relative] : []
  })
}

/** Locks the matching files in a built game folder. Returns how many were locked. */
export function lockFolder(dir: string, media: ProtectConfig['media']): number {
  const key = keyFromText(media.key)
  let count = 0
  for (const file of filesIn(dir)) {
    if (!shouldLock(file, media)) continue
    const full = path.join(dir, file)
    const bytes = readFileSync(full)
    if (isLocked(bytes)) continue
    writeFileSync(full, lockBytes(bytes, key))
    count++
  }
  return count
}

export function protectPlugin(): Plugin {
  let media: ProtectConfig['media'] | undefined
  let root = process.cwd()
  let outDir = ''
  return {
    name: 'game-media-lock',
    apply: 'build',
    async config(userConfig) {
      root = path.resolve(userConfig.root ?? process.cwd())
      // Loaded through Vite so the content file's '@/core/...' import resolves.
      const result = await runnerImport<{ default: ProtectConfig }>(path.join(root, CONFIG_FILE), {
        configFile: false,
        root,
        resolve: { alias: userConfig.resolve?.alias },
        logLevel: 'silent',
      })
      media = result.module.default.media
      return { define: { __MEDIA_LOCK__: JSON.stringify(media.enabled) } }
    },
    configResolved(resolved) {
      outDir = path.resolve(resolved.root, resolved.build.outDir)
    },
    async closeBundle() {
      if (!media?.enabled) return
      const count = lockFolder(outDir, media)
      const info: LockInfo = { key: keyFromText(media.key), extensions: media.extensions }
      const worker = await esbuild({
        entryPoints: [path.join(root, WORKER_SOURCE)],
        bundle: true,
        write: false,
        format: 'iife',
        target: 'es2022',
        minify: true,
        logLevel: 'silent',
        define: {
          __LOCK_KEY__: JSON.stringify(info.key),
          __LOCK_EXTENSIONS__: JSON.stringify(info.extensions),
        },
      })
      writeFileSync(path.join(outDir, WORKER_FILE), worker.outputFiles[0]?.text ?? '')
      writeFileSync(path.join(outDir, LOCK_FILE), JSON.stringify(info))
      console.log(`media lock: ${count} file(s) locked`)
    },
  }
}
