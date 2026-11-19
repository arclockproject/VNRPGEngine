// Draws a layered portrait: base image + one element per layer, with auto-blink and mouth flaps.
// Blinks and flaps write straight to the layer elements, so React never re-renders for them.
import { Box } from '@mui/material'
import { useEffect, useRef, useState } from 'react'
import scenes from '@/content/scenes'
import { lang, useLangStore } from '../lang'
import { type LayeredPortrait, type PartOption, portraitUrls, resolveParts } from './define'
import { imageSize, loadImage } from './images'
import { HIDDEN, type PartCss, partCss } from './style'
import { onTalking, voiceLevel } from './talking'

/** How often a mouth checks how loud the voice clip is, ms. */
const VOICE_FRAME_MS = scenes.voice.lipSync.checkMs ?? 40

interface Props {
  /** Character id: mouth flaps run while this character's line types. */
  id: string
  portrait: LayeredPortrait
  expression: string | null
  parts?: Record<string, string | null>
  alt?: string
  /** Largest CSS height of the whole portrait. */
  height: string
  /** Largest CSS width. Whichever limit is hit first wins; the shape never stretches. */
  maxWidth?: string
}

/**
 * The CSS of one layer showing `option`, in the player's language: the option's own version for
 * it (Aseprite layers named "<name>.<lang>"), and an image file's "<name>.<lang>.<ext>" twin.
 */
function optionCss(portrait: LayeredPortrait, layerName: string, option: string | null): PartCss {
  const layer = portrait.layers[layerName]
  const chosen: PartOption | undefined = option === null ? undefined : layer?.options[option]
  if (!layer || chosen === undefined) return HIDDEN
  const own = typeof chosen === 'object' && 'src' in chosen ? chosen : { src: chosen }
  const placed = ('langs' in own ? own.langs?.[lang.current()] : undefined) ?? own
  const source = typeof placed.src === 'string' ? lang.image(placed.src) : placed.src
  return partCss(
    source,
    placed.x ?? layer.x,
    placed.y ?? layer.y,
    portrait.width,
    portrait.height,
    typeof source === 'string' ? imageSize(source) : undefined,
  )
}

/** Swaps a layer's image by writing to its element (no React render). */
function showPart(
  el: HTMLDivElement | null | undefined,
  portrait: LayeredPortrait,
  layer: string,
  option: string | null,
) {
  if (el) Object.assign(el.style, optionCss(portrait, layer, option))
}

export function LayeredPortraitView({
  id,
  portrait,
  expression,
  parts,
  alt,
  height,
  maxWidth,
}: Props) {
  const [, setLoaded] = useState(0)
  // Redraws in a newly picked language (each part picks its version there, see optionCss).
  const language = useLangStore((s) => s.id)
  const elements = useRef<Record<string, HTMLDivElement | null>>({})
  const resolved = resolveParts(portrait, expression, parts)
  /** What each layer should show when not blinking/talking. */
  const current = useRef(resolved)
  useEffect(() => {
    current.current = resolved
  })

  // Load every image up front (in the player's language): sizes for plain files, and no flicker
  // on the first blink.
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new language loads its own files
  useEffect(() => {
    let alive = true
    const urls = portraitUrls(portrait).map((url) => lang.image(url))
    void Promise.all(urls.map(loadImage)).then(() => {
      if (alive) setLoaded((n) => n + 1)
    })
    return () => {
      alive = false
    }
  }, [portrait, language])

  // Auto-blink.
  useEffect(() => {
    const blink = portrait.blink
    if (!blink) return
    const show = (layer: string, option: string | null) =>
      showPart(elements.current[layer], portrait, layer, option)
    let timer: ReturnType<typeof setTimeout>
    const schedule = () => {
      const [min, max] = blink.everyMs
      timer = setTimeout(
        () => {
          const open = current.current[blink.layer] ?? null
          // Only blink when the eyes are actually open (not e.g. already closed or hidden).
          if (open !== null && open !== blink.closed) {
            show(blink.layer, blink.closed)
            timer = setTimeout(() => {
              show(blink.layer, current.current[blink.layer] ?? null)
              schedule()
            }, blink.closedMs)
          } else {
            schedule()
          }
        },
        min + Math.random() * (max - min),
      )
    }
    schedule()
    return () => clearTimeout(timer)
  }, [portrait])

  // Mouth flaps while this character's line is typing.
  useEffect(() => {
    const talk = portrait.talk
    if (!talk) return
    const show = (layer: string, option: string | null) =>
      showPart(elements.current[layer], portrait, layer, option)
    let flap: ReturnType<typeof setInterval> | undefined
    const stop = () => {
      if (flap) clearInterval(flap)
      flap = undefined
      show(talk.layer, current.current[talk.layer] ?? null)
    }
    let talking: string | null = null
    const unsubscribe = onTalking((talkers, mode) => {
      if (!talkers.includes(id)) {
        talking = null
        return stop()
      }
      const key = `${id}:${mode}`
      if (flap && talking === key) return
      if (flap) clearInterval(flap)
      talking = key
      let open = false
      const set = (next: boolean) => {
        if (next === open) return
        open = next
        show(talk.layer, open ? talk.open : (current.current[talk.layer] ?? null))
      }
      if (mode === 'voice' && voiceLevel(id) !== null) {
        // The mouth follows this character's own clip: open while it is loud enough, held open a
        // moment, shut once it has ended (others on the line may still be talking).
        const { threshold, holdMs } = scenes.voice.lipSync
        let openUntil = 0
        flap = setInterval(() => {
          const now = performance.now()
          if ((voiceLevel(id) ?? 0) >= threshold) openUntil = now + holdMs
          set(now < openUntil)
        }, VOICE_FRAME_MS)
      } else {
        flap = setInterval(() => set(!open), talk.frameMs)
      }
    })
    return () => {
      unsubscribe()
      stop()
    }
  }, [portrait, id])

  const base =
    portrait.base &&
    optionCss(
      { ...portrait, layers: { base: { x: 0, y: 0, options: { base: portrait.base } } } },
      'base',
      'base',
    )
  return (
    <Box
      role="img"
      aria-label={alt}
      sx={{
        position: 'relative',
        // Sized by width only (aspect-ratio gives the height), so a width limit shrinks the whole
        // portrait instead of squashing it.
        width: maxWidth
          ? `min(${maxWidth}, calc(${height} * ${portrait.width} / ${portrait.height}))`
          : `calc(${height} * ${portrait.width} / ${portrait.height})`,
        aspectRatio: `${portrait.width} / ${portrait.height}`,
        '& > div': {
          position: 'absolute',
          backgroundRepeat: 'no-repeat',
          imageRendering: portrait.pixelated ? 'pixelated' : 'auto',
        },
      }}
    >
      {/* The base fills the whole portrait. */}
      {base && <div style={{ ...base, left: 0, top: 0, width: '100%', height: '100%' }} />}
      {Object.keys(portrait.layers).map((layer) => (
        <div
          key={layer}
          data-layer-part={layer}
          ref={(el) => {
            elements.current[layer] = el
          }}
          style={optionCss(portrait, layer, resolved[layer] ?? null)}
        />
      ))}
    </Box>
  )
}
