// Turns an Aseprite file in src/content/gallery/ into a layered CG (src/core/gallery.ts):
// one flattened picture + one PNG per toggle layer (trimmed to its pixels) + a typed module.
//
// Rules:
// - Layers and plain groups ("folders") are always drawn, hidden or not. "_name" is ignored;
//   "#name" is a marker, never drawn.
// - A layer or group named "+name" is a toggle: off unless a variant turns it on (hide toggles in
//   Aseprite while you paint; that does not matter here).
// - Layer order = drawing order, so a toggle can sit under always-drawn layers (tears under hair).
// - Toggle layers are trimmed to their visible pixels, with their place on the canvas: a few tears
//   are a tiny image, not a full-screen one (a full one costs width × height × 4 bytes of memory
//   once shown, even if almost empty). Places are stored in canvas pixels; the game turns them into
//   fractions, so they still line up in the lite build's smaller pictures.
// - Only normal blending is drawn (like portraits).
import { type Bitmap, composite, ignored, toId, trim } from './portrait.ts'
import type { AseFile, AseLayer } from './read.ts'

export type CgPart = { toggle: string | null; image: Bitmap }

export interface CgBuild {
  width: number
  height: number
  /** Every always-drawn layer flattened (the picture with no toggles on). */
  flat: Uint8Array
  /** Draw order, bottom first. toggle null = a run of always-drawn layers. */
  parts: CgPart[]
}

/** Any .aseprite file in src/content/gallery, backgrounds or insets is a layered picture. */
export const isCgSource = (file: string) =>
  file
    .split(/[\\/]/)
    .some(
      (part, i, all) =>
        ['gallery', 'backgrounds', 'insets'].includes(part) && all[i - 1] === 'content',
    )

export function buildCg(file: AseFile, warn: (message: string) => void): CgBuild {
  const parts: CgPart[] = []
  const allStatic: AseLayer[] = []
  let run: AseLayer[] = []
  const toggles = new Set<string>()

  const flushRun = () => {
    if (run.length === 0) return
    const image = trim(file, composite(file, run))
    if (image) parts.push({ toggle: null, image })
    run = []
  }

  const visit = (layer: AseLayer) => {
    if (layer.name.startsWith('+')) {
      if (layer.type === 2) return warn(`"${layer.name}": tilemap layers are not supported`)
      const name = toId(layer.name.slice(1))
      if (!name)
        return warn(`"${layer.name}": toggle names need letters/digits/_ (starting with a letter)`)
      if (toggles.has(name)) return warn(`"${layer.name}": a toggle "${name}" already exists`)
      toggles.add(name)
      flushRun()
      const image = trim(file, composite(file, [layer]))
      if (!image) return warn(`"${layer.name}" is empty, skipped`)
      parts.push({ toggle: name, image })
      return
    }
    if (ignored(layer)) return
    if (layer.type === 2) return warn(`"${layer.name}": tilemap layers are not supported, skipped`)
    if (layer.type === 1 && layer.name.startsWith('@'))
      warn(`"${layer.name}": @parts are for portraits; in a CG use "+name" toggles. Drawn as is.`)
    if (layer.type === 1) {
      for (const child of layer.children) visit(child)
      return
    }
    run.push(layer)
    allStatic.push(layer)
  }

  for (const root of file.roots) visit(root)
  flushRun()
  if (toggles.size === 0) warn('no "+name" toggle layers: this is a plain picture')
  return { width: file.width, height: file.height, flat: composite(file, allStatic), parts }
}

/** File names next to the source, e.g. pond.gen.png, pond.crying.part.gen.png. */
export function cgFileNames(base: string, build: CgBuild): (string | null)[] {
  const runs = build.parts.filter((p) => p.toggle === null).length
  let run = 0
  return build.parts.map((part) => {
    if (part.toggle !== null) return `${base}.${part.toggle}.part.gen.png`
    run++
    // A single run of always-drawn layers is the flattened picture itself: no second file.
    return runs === 1 ? null : `${base}.base${run}.part.gen.png`
  })
}

/**
 * One language's version of a CG ("<name>.<lang>" layers): `flat` is its own flattened picture
 * (null = same as the source language's), `files[i]` its own file for part i (null = same).
 */
export interface CgLanguage {
  lang: string
  build: CgBuild
  flat: string | null
  files: (string | null)[]
}

const samePixels = (a: Uint8Array, b: Uint8Array) => Buffer.from(a).equals(Buffer.from(b))

/**
 * Compares a language's build with the source one: which pictures differ and need their own files
 * (named like the source's, with the language after the base name: pond.ja.gen.png,
 * pond.ja.crying.part.gen.png). Null when the language changes the toggles (left out, warned).
 */
export function cgLanguage(
  base: string,
  build: CgBuild,
  lang: string,
  theirs: CgBuild,
  warn: (message: string) => void,
): CgLanguage | null {
  const same =
    theirs.parts.length === build.parts.length &&
    theirs.parts.every((p, i) => p.toggle === build.parts[i]?.toggle)
  if (!same) {
    warn(`the ${lang} layers change the toggles; ${lang} is left out`)
    return null
  }
  const flat = samePixels(build.flat, theirs.flat) ? null : `${base}.${lang}.gen.png`
  const names = cgFileNames(`${base}.${lang}`, theirs)
  const files = theirs.parts.map((part, i) => {
    const mine = build.parts[i] as CgPart
    const changed =
      part.image.x !== mine.image.x ||
      part.image.y !== mine.image.y ||
      part.image.width !== mine.image.width ||
      part.image.height !== mine.image.height ||
      !samePixels(part.image.pixels, mine.image.pixels)
    return changed ? (names[i] ?? null) : null
  })
  if (!flat && files.every((f) => f === null)) return null
  return { lang, build: theirs, flat, files }
}

/** The generated TypeScript module. `files[i]` null = part i is the flattened picture. */
export function renderCgModule(
  sourceName: string,
  flatName: string,
  build: CgBuild,
  files: (string | null)[],
  languages: CgLanguage[] = [],
): string {
  const imports = [`import image from './${flatName}'`]
  const whole = `x: 0, y: 0, w: ${build.width}, h: ${build.height}`
  const partLine = (part: CgPart, src: string, indent: string) => {
    const toggle = part.toggle === null ? 'null' : `'${part.toggle}'`
    const { x, y, width, height } = part.image
    return `${indent}{ toggle: ${toggle}, src: ${src}, x: ${x}, y: ${y}, w: ${width}, h: ${height} },`
  }
  const parts = build.parts.map((part, i) => {
    const file = files[i]
    if (!file) return `    { toggle: null, src: image, ${whole} },`
    imports.push(`import part${i} from './${file}'`)
    return partLine(part, `part${i}`, '    ')
  })
  const langLines: string[] = []
  for (const { lang, build: theirs, flat, files: own } of languages) {
    const flatId = flat ? `image_${lang}` : 'image'
    if (flat) imports.push(`import ${flatId} from './${flat}'`)
    langLines.push(`    ${lang}: {`, `      image: ${flatId},`, '      parts: [')
    theirs.parts.forEach((part, i) => {
      const file = own[i]
      if (file) {
        imports.push(`import part${i}_${lang} from './${file}'`)
        langLines.push(partLine(part, `part${i}_${lang}`, '        '))
      } else if (!files[i]) {
        // The source's flattened picture: this language's flattened picture.
        langLines.push(`        { toggle: null, src: ${flatId}, ${whole} },`)
      } else {
        langLines.push(partLine(build.parts[i] as CgPart, `part${i}`, '        '))
      }
    })
    langLines.push('      ],', '    },')
  }
  const names = build.parts.flatMap((p) => (p.toggle === null ? [] : [`'${p.toggle}'`]))
  return [
    `// AUTO-GENERATED from ${sourceName} by vite/aseprite. Do not edit: change the .aseprite file instead.`,
    "import type { LayeredCg } from '@/core/gallery'",
    ...imports,
    '',
    `const cg: LayeredCg<${names.length ? names.join(' | ') : 'never'}> = {`,
    `  width: ${build.width},`,
    `  height: ${build.height},`,
    '  image,',
    '  parts: [',
    ...parts,
    '  ],',
    ...(langLines.length ? ['  langs: {', ...langLines, '  },'] : []),
    '}',
    '',
    'export default cg',
    '',
  ].join('\n')
}
