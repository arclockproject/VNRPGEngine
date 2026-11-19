// Android Play Store bundles: the base download may be at most 500 MB, so when the game is bigger
// its media files move into "install-time asset packs" (up to 1.5 GB each, 4 GB in all). Play
// installs them together with the app and Android reads them like the app's own files, so the
// game finds them at the same paths and no game code changes.
import {
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'

const MB = 1024 * 1024
/** Base download limit is 500 MB; leave room for the app's code and libraries. */
export const BASE_LIMIT = 450 * MB
/** Per asset pack the limit is 1.5 GB. */
export const PACK_LIMIT = 1400 * MB
/** All install-time packs + base together. */
export const TOTAL_LIMIT = 4000 * MB

/** Files that may move into a pack (code, HTML and small data stay in the base). */
export const MEDIA = /\.(webp|avif|png|jpe?g|gif|wav|ogg|mp3|m4a|opus|flac|mp4|webm)$/i

export interface SizedFile {
  /** Relative to the web root, / separators. */
  path: string
  bytes: number
}

export function listFiles(root: string, dir = root): SizedFile[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return listFiles(root, full)
    return [
      { path: path.relative(root, full).split(path.sep).join('/'), bytes: statSync(full).size },
    ]
  })
}

export const totalBytes = (files: SizedFile[]) => files.reduce((sum, f) => sum + f.bytes, 0)

/**
 * Which files go into which pack. No packs when everything fits the base. Otherwise every media
 * file moves out, biggest first, each into the first pack with room.
 */
export function planPacks(
  files: SizedFile[],
  limits = { base: BASE_LIMIT, pack: PACK_LIMIT, total: TOTAL_LIMIT },
): SizedFile[][] {
  const total = totalBytes(files)
  if (total <= limits.base) return []
  if (total > limits.total) {
    throw new Error(
      `The game is ${Math.round(total / MB)} MB; Play installs at most ${Math.round(limits.total / MB)} MB ` +
        'with the app. Bigger games need download-later (fast-follow) packs, which this build does not make yet.',
    )
  }
  const media = files.filter((f) => MEDIA.test(f.path)).sort((a, b) => b.bytes - a.bytes)
  const base = total - totalBytes(media)
  if (base > limits.base) {
    throw new Error(
      `Code and data (not media) are ${Math.round(base / MB)} MB, over the ${Math.round(limits.base / MB)} MB base limit.`,
    )
  }
  const packs: { files: SizedFile[]; bytes: number }[] = []
  for (const file of media) {
    if (file.bytes > limits.pack)
      throw new Error(`${file.path} is bigger than one asset pack may be.`)
    let pack = packs.find((p) => p.bytes + file.bytes <= limits.pack)
    if (!pack) {
      pack = { files: [], bytes: 0 }
      packs.push(pack)
    }
    pack.files.push(file)
    pack.bytes += file.bytes
  }
  return packs.map((p) => p.files)
}

export const packName = (index: number) => `asset_pack_${index + 1}`

/** Removes packs from an earlier bundle build (Gradle then builds a normal app again). */
export function clearPacks(androidDir: string): void {
  rmSync(path.join(androidDir, 'asset-packs.txt'), { force: true })
  for (const entry of readdirSync(androidDir)) {
    if (/^asset_pack_\d+$/.test(entry)) rmSync(path.join(androidDir, entry), { recursive: true })
  }
}

/**
 * Moves the planned files from the app's copy of the game (android/app/src/main/assets/public) into
 * pack modules, at the same path, and tells Gradle about them (settings.gradle, app/build.gradle).
 */
export function writePacks(androidDir: string, packs: SizedFile[][]): void {
  clearPacks(androidDir)
  if (packs.length === 0) return
  const webRoot = path.join(androidDir, 'app/src/main/assets/public')
  packs.forEach((files, index) => {
    const name = packName(index)
    const moduleDir = path.join(androidDir, name)
    for (const file of files) {
      const target = path.join(moduleDir, 'src/main/assets/public', file.path)
      mkdirSync(path.dirname(target), { recursive: true })
      renameSync(path.join(webRoot, file.path), target)
    }
    writeFileSync(
      path.join(moduleDir, 'build.gradle'),
      [
        "apply plugin: 'com.android.asset-pack'",
        '',
        'assetPack {',
        `    packName = "${name}"`,
        '    dynamicDelivery {',
        '        deliveryType = "install-time"',
        '    }',
        '}',
        '',
      ].join('\n'),
    )
  })
  writeFileSync(
    path.join(androidDir, 'asset-packs.txt'),
    `${packs.map((_, i) => packName(i)).join('\n')}\n`,
  )
}
