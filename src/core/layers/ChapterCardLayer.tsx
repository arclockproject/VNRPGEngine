// The chapter card (core/scene/chapterCard.ts): fades (or masks) in, runs its steps, waits for the
// stage's new pictures ('screen' style), fades (or masks) out. A click, a tap or confirm skips it
// when the chapter config allows. Drawn by src/content/ui/ChapterCard.tsx or the chapter's own
// `screen`; the engine keeps the timing and the skip.
import { Box } from '@mui/material'
import { useEffect, useRef, useState } from 'react'
import { ChapterCard as ChapterCardSlot } from '@/content/ui/ChapterCard'
import { useAction } from '../input/useAction'
import { lang } from '../lang'
import {
  type ChapterCard,
  type ChapterCardPhase,
  chapterCardCovering,
  chapterCardLeaving,
  endChapterCard,
  useChapterCard,
} from '../scene/chapterCard'
import {
  DEFAULT_SOFTNESS,
  loadRule,
  MASK_H,
  MASK_W,
  maskAlpha,
  maskTransition,
} from '../scene/mask'
import { stagePicturesReady } from '../scene/stageReady'
import type { TransitionName } from '../scene/types'
import { useSettingsStore } from '../stores/settings'
import { Z } from './zIndex'

/** A skipped card leaves at most this fast, ms. */
const SKIP_OUT_MS = 250

export function ChapterCardLayer() {
  const card = useChapterCard((s) => s.card)
  return card ? <Card key={card.id} card={card} /> : null
}

/**
 * Shows `el` through a mask transition: 'in' = it appears where the rule reaches first, 'out' = it
 * goes there first. Resolves when done (at once, false, when the transition can't be used).
 */
async function runMask(
  el: HTMLElement | null,
  name: string,
  ms: number,
  direction: 'in' | 'out',
  alive: () => boolean,
): Promise<boolean> {
  const config = maskTransition(name as TransitionName)
  if (!el || !config || ms <= 0 || typeof document === 'undefined') return false
  let rule: Float32Array
  try {
    rule = await loadRule(name as TransitionName)
  } catch {
    return false
  }
  const canvas = document.createElement('canvas')
  canvas.width = MASK_W
  canvas.height = MASK_H
  const ctx = canvas.getContext('2d')
  if (!ctx) return false
  const image = ctx.createImageData(MASK_W, MASK_H)
  const pixels = image.data
  const softness = config.softness ?? DEFAULT_SOFTNESS
  const draw = (progress: number) => {
    for (let i = 0; i < rule.length; i++) {
      const a = maskAlpha(rule[i] ?? 0, progress, softness)
      pixels[i * 4 + 3] = (direction === 'in' ? a : 1 - a) * 255
    }
    ctx.putImageData(image, 0, 0)
    const url = `url(${canvas.toDataURL()})`
    el.style.maskImage = url
    el.style.webkitMaskImage = url
  }
  el.style.maskSize = '100% 100%'
  el.style.webkitMaskSize = '100% 100%'
  draw(0)
  const start = performance.now()
  await new Promise<void>((resolve) => {
    const frame = () => {
      if (!alive()) return resolve()
      const progress = Math.min(1, (performance.now() - start) / ms)
      draw(progress)
      if (progress >= 1) resolve()
      else requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  })
  if (direction === 'in') {
    el.style.maskImage = 'none'
    el.style.webkitMaskImage = 'none'
  }
  return true
}

function Card({ card }: { card: ChapterCard }) {
  const still = useSettingsStore((s) => s.reduceMotion)
  const [shown, setShown] = useState(false)
  const [phase, setPhase] = useState<ChapterCardPhase>('in')
  const [step, setStep] = useState(0)
  const [skipped, setSkipped] = useState(false)
  const [fadeMs, setFadeMs] = useState(still ? 0 : card.fadeIn)
  const box = useRef<HTMLDivElement>(null)
  const skip = useRef<() => void>(() => {})
  const skippedRef = useRef(false)
  const masked = card.style === 'screen' && !still

  // biome-ignore lint/correctness/useExhaustiveDependencies: one timing per card (keyed by id)
  useEffect(() => {
    let alive = true
    const timers: ReturnType<typeof setTimeout>[] = []
    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        timers.push(setTimeout(resolve, ms))
      })
    const skipped = new Promise<void>((resolve) => {
      skip.current = resolve
    })
    const fadeIn = still ? 0 : card.fadeIn
    void (async () => {
      // In: a mask, or (one frame at opacity 0 first, so it runs) a fade.
      const maskIn = masked && card.maskIn ? card.maskIn : null
      if (maskIn) {
        setFadeMs(0)
        setShown(true)
      } else requestAnimationFrame(() => alive && setShown(true))
      const usedMask = maskIn && (await runMask(box.current, maskIn, fadeIn, 'in', () => alive))
      if (!usedMask) await sleep(fadeIn)
      if (!alive) return
      chapterCardCovering()
      setPhase('on')
      // The steps (a skip ends them).
      for (let i = 0; i < card.steps.length && !skippedRef.current; i++) {
        setStep(i)
        await Promise.race([sleep(card.steps[i] ?? 0), skipped])
        if (!alive) return
      }
      // A covering card leaves only once the new stage has loaded: no picture pops in after it.
      if (card.style === 'screen') await stagePicturesReady()
      // Two frames: the stage under it is drawn before the card starts to go.
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      if (!alive) return
      chapterCardLeaving()
      setPhase('out')
      const out = still
        ? 0
        : skippedRef.current
          ? Math.min(card.fadeOut, SKIP_OUT_MS)
          : card.fadeOut
      const maskOut = masked && card.maskOut && !skippedRef.current ? card.maskOut : null
      if (maskOut && (await runMask(box.current, maskOut, out, 'out', () => alive))) {
        if (box.current) box.current.style.opacity = '0'
      } else {
        setFadeMs(out)
        setShown(false)
        await sleep(out)
      }
      if (alive) endChapterCard()
    })()
    return () => {
      alive = false
      for (const timer of timers) clearTimeout(timer)
    }
  }, [])

  const onSkip = () => {
    if (!card.skippable || skippedRef.current) return false
    skippedRef.current = true
    setSkipped(true)
    skip.current()
    return true
  }
  // Between two events of a route no event is on top: listen on the map layer too.
  useAction('confirm', onSkip, { layers: ['event', 'map'] })

  const Screen = card.screen ?? ChapterCardSlot
  return (
    <Box
      ref={box}
      data-chapter-card
      onClick={(e) => {
        e.stopPropagation()
        onSkip()
      }}
      sx={{ position: 'absolute', inset: 0, zIndex: Z.chapterCard }}
    >
      <Screen
        label={card.label}
        title={card.title}
        description={card.description ?? null}
        image={card.image ? lang.image(card.image) : null}
        style={card.style}
        shown={shown}
        fadeMs={fadeMs}
        phase={phase}
        step={step}
        skipped={skipped}
      />
    </Box>
  )
}
