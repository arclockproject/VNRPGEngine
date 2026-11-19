// src/content/**/*.vn -> a .gen.ts event module next to each file (on start, and on save in dev).
// Unknown ids (characters, poses, items…) are reported with line and column.
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'
import { checkVn } from './check.ts'
import { compileVn } from './compile.ts'
import { collectVnIds, type VnIds } from './ids.ts'
import { checkRouteVn, compileRouteVn } from './route.ts'

const CONTENT_DIR = 'src/content'
const VN = /\.vn$/i

const output = (source: string) => source.replace(VN, '.gen.ts')

function findScripts(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return findScripts(full)
    return VN.test(entry.name) ? [full] : []
  })
}

/** Compiles one script. Returns true if the generated file changed. */
export function generateFromVn(
  source: string,
  root: string,
  warn: (message: string) => void,
  ids: VnIds = collectVnIds(root),
) {
  const label = path.relative(path.join(root, CONTENT_DIR), source).replaceAll(path.sep, '/')
  const text = readFileSync(source, 'utf8')
  // src/content/routes/<name>/index.vn is a route (the story's order); everything else an event.
  const isRoute = label.startsWith('routes/')
  const { code, errors } = isRoute ? compileRouteVn(text, label) : compileVn(text, label)
  for (const e of errors) warn(`[vn] ${label}:${e.line}: ${e.message}`)
  for (const p of isRoute ? checkRouteVn(text, ids) : checkVn(text, ids))
    warn(`[vn] ${label}:${p.line}:${p.column + 1}: ${p.message}`)
  const out = output(source)
  if (existsSync(out) && readFileSync(out, 'utf8') === code) return false
  writeFileSync(out, code)
  return true
}

export function generateAllVn(root: string, warn: (message: string) => void = console.warn) {
  let changed = false
  const ids = collectVnIds(root)
  for (const source of findScripts(path.join(root, CONTENT_DIR))) {
    changed = generateFromVn(source, root, warn, ids) || changed
  }
  return changed
}

export function vnPlugin(): Plugin {
  let root = process.cwd()
  return {
    name: 'game-vn',
    configResolved(config) {
      root = config.root
    },
    buildStart() {
      generateAllVn(root, (message) => this.warn(message))
    },
    configureServer(server) {
      const log = server.config.logger
      const onChange = (file: string) => {
        if (!VN.test(file)) return
        if (generateFromVn(file, root, (m) => log.warn(m)))
          log.info(`[vn] updated ${path.relative(root, file)}`, { timestamp: true })
      }
      server.watcher.on('add', onChange)
      server.watcher.on('change', onChange)
      server.watcher.on('unlink', (file) => {
        if (VN.test(file)) rmSync(output(file), { force: true })
      })
    },
  }
}
