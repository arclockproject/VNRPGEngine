// Sound conversion for the build (src/content/config/media.ts audio.convert), with ffmpeg-static.
// Normal build: uncompressed files (WAV, AIFF) become FLAC (lossless); everything else is shipped
// as it is. Lite build: any sound becomes Opus at the rule's bitrate.
import { spawn } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { cpus } from 'node:os'
import path from 'node:path'
import type { AudioRule } from '../../src/core/media.ts'
import { cacheDirFor, once } from './cache.ts'

// ffmpeg-static is CommonJS: its export is the binary's path (null on unsupported systems).
const ffmpegPath = createRequire(import.meta.url)('ffmpeg-static') as string | null

/** Sound files the build looks at (the same list the registry accepts in src/content/audio). */
export const AUDIO_FILE = /\.(wav|aiff?|flac|ogg|oga|opus|mp3|m4a|aac|mp4|webm)$/i
const UNCOMPRESSED = /\.(wav|aiff?)$/i

export type AudioPlan = { codec: 'flac' } | { codec: 'opus'; kbps: number }

export function audioPlan(
  rule: AudioRule | undefined,
  file: string,
  lite: boolean,
): AudioPlan | null {
  if (!rule) return null
  if (lite && rule.lite) return { codec: 'opus', kbps: rule.lite.opusKbps }
  if (rule.format === 'flac' && UNCOMPRESSED.test(file)) return { codec: 'flac' }
  return null
}

// ffmpeg uses one core per file; more at once than cores only queues up.
let active = 0
const waiting: (() => void)[] = []
async function slot<T>(job: () => Promise<T>): Promise<T> {
  if (active >= Math.max(1, cpus().length)) await new Promise<void>((r) => waiting.push(r))
  active++
  try {
    return await job()
  } finally {
    active--
    waiting.shift()?.()
  }
}

function ffmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error('ffmpeg-static has no binary for this system'))
    const child = spawn(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', ...args])
    let errors = ''
    child.stderr.on('data', (chunk) => {
      errors += chunk
    })
    child.on('error', reject)
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(errors.trim() || `ffmpeg exit ${code}`)),
    )
  })
}

/** The file to ship for `file`: a converted copy in `cacheDir`, or `file` itself. */
export function convertAudio(
  file: string,
  plan: AudioPlan | null,
  cacheDir: string,
  warn: (message: string) => void = console.warn,
): Promise<string> {
  if (!plan) return Promise.resolve(file)
  const dir = cacheDirFor(cacheDir, readFileSync(file), plan)
  const out = path.join(dir, `${path.parse(file).name}.${plan.codec}`)
  // Per file name: two files with the same bytes share `dir`, but each has its own output.
  const keep = `${out}.keep-original`
  return once(out, async () => {
    if (existsSync(out)) return out
    if (existsSync(keep)) return file
    mkdirSync(dir, { recursive: true })
    const codec =
      plan.codec === 'flac'
        ? ['-c:a', 'flac', '-compression_level', '8', '-f', 'flac']
        : ['-c:a', 'libopus', '-b:a', `${plan.kbps}k`, '-f', 'opus']
    // Written under another name first, so a failed run never leaves a broken file in the cache.
    const partial = `${out}.partial`
    try {
      // -vn: an .mp4 / .webm may carry a picture or video; only the sound is kept.
      await slot(() => ffmpeg(['-i', file, '-vn', '-map_metadata', '-1', ...codec, partial]))
      renameSync(partial, out)
    } catch (error) {
      rmSync(partial, { force: true })
      warn(`[media] kept ${file} as it is: ${error instanceof Error ? error.message : error}`)
      writeFileSync(keep, '')
      return file
    }
    if (statSync(out).size >= statSync(file).size) {
      writeFileSync(keep, '')
      return file
    }
    return out
  })
}
