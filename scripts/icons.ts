// pnpm icons: the Android launcher icons, made from src/content/assets/icon/:
//   icon.square.*      ic_launcher        older Android (48 dp)
//   icon.round.*       ic_launcher_round  launchers that show round icons (48 dp)
//   icon.foreground.*  ic_launcher_foreground  adaptive icon, front layer (108 dp)
//   icon.background.*  ic_launcher_background  adaptive icon, back layer (optional: else the
//                      colour app.ts iconBackground)
//   icon.monochrome.*  ic_launcher_monochrome  Android 13 themed icons (optional)
// png, webp, jpg or svg. One kind is never made from another. Each size Android needs is scaled
// down from the biggest file of that kind, unless a hand-made one is there:
// icon.round.96.png is used as it is wherever exactly 96 px are needed.
// Also writes the colours (icon background, splash) into res/values/game_colors.xml.
// The outputs are git-ignored; scripts/build.ts runs this before every Android build.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import sharp from 'sharp'
import app from '../src/content/config/app.ts'
import { ICON_DIR, resolveApp } from '../src/core/app.ts'

const ROOT = resolve(import.meta.dirname, '..')
/** Where the icons come from and go (tests point them at a temporary folder). */
export interface IconPaths {
  source: string
  res: string
  stamp: string
}

const DEFAULT_PATHS: IconPaths = {
  source: join(ROOT, 'src/content', ICON_DIR),
  res: join(ROOT, 'android/app/src/main/res'),
  stamp: join(ROOT, 'android/icons.stamp'),
}
/** Bump when the outputs change shape, so old ones are rewritten. */
const SCRIPT_VERSION = 1

/** Android density folders and their scale (mdpi = 1 px per dp). */
export const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 } as const

/** Icon kinds: their Android name, size in dp, and whether a game must have one. */
export const KINDS = {
  square: { out: 'ic_launcher', dp: 48, required: true },
  round: { out: 'ic_launcher_round', dp: 48, required: true },
  foreground: { out: 'ic_launcher_foreground', dp: 108, required: true },
  background: { out: 'ic_launcher_background', dp: 108, required: false },
  monochrome: { out: 'ic_launcher_monochrome', dp: 108, required: false },
} as const
export type IconKind = keyof typeof KINDS

const EXTENSIONS = ['png', 'webp', 'jpg', 'jpeg', 'svg']

/** One file of the icon folder. `size`: from its name (icon.round.96.png), null = no size in it. */
export interface IconFile {
  name: string
  kind: IconKind
  size: number | null
  /** Real pixel size; null for svg (drawn at any size). */
  width: number | null
  height: number | null
}

/** icon.<kind>[.<size>].<ext> -> kind and size; null for other files (icon.png is the main one). */
export function parseIconName(name: string): { kind: IconKind; size: number | null } | null {
  const match = /^icon\.([a-z]+)(?:\.(\d+))?\.([a-z]+)$/i.exec(name)
  if (!match) return null
  const [, kind, size, ext] = match as unknown as [string, string, string | undefined, string]
  if (!(kind in KINDS) || !EXTENSIONS.includes(ext.toLowerCase())) return null
  return { kind: kind as IconKind, size: size ? Number(size) : null }
}

/** One Android file to write: where, how many px, and from which file (scaled or as it is). */
export interface IconOutput {
  path: string
  px: number
  from: string
  scale: boolean
}

/** Which file makes each Android icon. Pure: errors are returned, nothing is read or written. */
export function planIcons(files: IconFile[]): { outputs: IconOutput[]; errors: string[] } {
  const outputs: IconOutput[] = []
  const errors: string[] = []
  for (const file of files) {
    if (file.width !== null && file.width !== file.height) {
      errors.push(`${file.name} is ${file.width}x${file.height}: icons must be square.`)
    }
    if (file.size !== null && file.width !== null && file.width !== file.size) {
      errors.push(`${file.name} is ${file.width}x${file.height}, but its name says ${file.size}.`)
    }
  }
  for (const [kind, info] of Object.entries(KINDS) as [IconKind, (typeof KINDS)[IconKind]][]) {
    const ofKind = files.filter((file) => file.kind === kind)
    if (ofKind.length === 0) {
      if (info.required) {
        errors.push(
          `${ICON_DIR}/icon.${kind}.png (or .svg / .webp) is missing (Android ${info.out}).`,
        )
      }
      continue
    }
    // An svg can be drawn at any size, so it counts as the biggest.
    const pixels = (file: IconFile) => file.width ?? Number.POSITIVE_INFINITY
    const biggest = [...ofKind].sort((a, b) => pixels(b) - pixels(a))[0] as IconFile
    for (const [density, scale] of Object.entries(DENSITIES)) {
      const px = Math.round(info.dp * scale)
      const path = `mipmap-${density}/${info.out}.png`
      const handMade = ofKind.find((file) => file.size === px)
      if (handMade) {
        outputs.push({ path, px, from: handMade.name, scale: false })
      } else if (pixels(biggest) >= px) {
        outputs.push({ path, px, from: biggest.name, scale: biggest.width !== px })
      } else {
        errors.push(
          `${path} needs ${px}x${px} px, but the biggest ${kind} icon (${biggest.name}) is ${biggest.width}x${biggest.width}: add a bigger one or icon.${kind}.${px}.png.`,
        )
      }
    }
  }
  return { outputs, errors }
}

/** The adaptive icon xml (mipmap-anydpi-v26): image or colour background, monochrome when given. */
export function adaptiveIconXml(hasBackgroundImage: boolean, hasMonochrome: boolean): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- Written by scripts/icons.ts from src/content/${ICON_DIR}. Do not edit. -->
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="${hasBackgroundImage ? '@mipmap/ic_launcher_background' : '@color/ic_launcher_background'}"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>${hasMonochrome ? '\n    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>' : ''}
</adaptive-icon>
`
}

/** A CSS-style colour as Android wants it: #RGB / #RRGGBB / #RRGGBBAA -> #RRGGBB / #AARRGGBB. */
export function androidColour(css: string, label: string): string {
  const hex = css.trim().replace(/^#/, '')
  if (!/^([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex)) {
    throw new Error(`${label} "${css}" (src/content/config/app.ts): use a #rrggbb colour.`)
  }
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex
  return `#${full.length === 8 ? full.slice(6) + full.slice(0, 6) : full}`.toUpperCase()
}

async function readIconFiles(SOURCE: string): Promise<IconFile[]> {
  if (!existsSync(SOURCE)) return []
  const files: IconFile[] = []
  for (const name of readdirSync(SOURCE).sort()) {
    const parsed = parseIconName(name)
    if (!parsed) continue
    const isSvg = name.toLowerCase().endsWith('.svg')
    const meta = isSvg ? null : await sharp(join(SOURCE, name)).metadata()
    files.push({
      name,
      ...parsed,
      width: meta?.width ?? null,
      height: meta?.height ?? null,
    })
  }
  return files
}

/** Makes every Android icon file. Returns false when nothing needed doing. Throws on a problem. */
export async function generateIcons(
  paths: IconPaths = DEFAULT_PATHS,
  colours: { iconBackground: string; splashBackground: string } = resolveApp(app),
): Promise<boolean> {
  const { source: SOURCE, res: RES, stamp: STAMP } = paths
  const APP = colours
  const files = await readIconFiles(SOURCE)
  const { outputs, errors } = planIcons(files)
  if (errors.length > 0)
    throw new Error(`Icons (src/content/${ICON_DIR}):\n- ${errors.join('\n- ')}`)

  const hash = createHash('sha256')
  hash.update(String(SCRIPT_VERSION))
  hash.update(`${APP.iconBackground}|${APP.splashBackground}`)
  for (const file of files) hash.update(file.name).update(readFileSync(join(SOURCE, file.name)))
  const stamp = hash.digest('hex')
  const written = outputs.every((output) => existsSync(join(RES, output.path)))
  if (written && existsSync(STAMP) && readFileSync(STAMP, 'utf8') === stamp) return false

  // Old outputs first: a kind that was removed (monochrome, background image) must not linger.
  for (const density of Object.keys(DENSITIES)) {
    const dir = join(RES, `mipmap-${density}`)
    if (!existsSync(dir)) continue
    for (const name of readdirSync(dir)) if (name.startsWith('ic_launcher')) rmSync(join(dir, name))
  }
  for (const output of outputs) {
    const target = join(RES, output.path)
    mkdirSync(join(target, '..'), { recursive: true })
    const source = join(SOURCE, output.from)
    // svg: drawn at the needed size (density), not scaled from a small bitmap.
    const image = output.from.toLowerCase().endsWith('.svg')
      ? sharp(source, { density: 300 })
      : sharp(source)
    await image
      .resize(output.px, output.px, { fit: 'fill', kernel: 'lanczos3' })
      .png()
      .toFile(target)
  }
  const has = (kind: IconKind) => files.some((file) => file.kind === kind)
  const anydpi = join(RES, 'mipmap-anydpi-v26')
  mkdirSync(anydpi, { recursive: true })
  const xml = adaptiveIconXml(has('background'), has('monochrome'))
  writeFileSync(join(anydpi, 'ic_launcher.xml'), xml)
  writeFileSync(join(anydpi, 'ic_launcher_round.xml'), xml)
  writeFileSync(
    join(RES, 'values/game_colors.xml'),
    `<?xml version="1.0" encoding="utf-8"?>
<!-- Written by scripts/icons.ts from src/content/config/app.ts. Do not edit. -->
<resources>
    <color name="ic_launcher_background">${androidColour(APP.iconBackground, 'iconBackground')}</color>
    <color name="splash_background">${androidColour(APP.splashBackground, 'splashBackground')}</color>
</resources>
`,
  )
  writeFileSync(STAMP, stamp)
  return true
}

if (process.argv[1] === import.meta.filename) {
  try {
    console.log((await generateIcons()) ? '[icons] written' : '[icons] up to date')
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
}
