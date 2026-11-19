// Full-screen picture with zoom and pan, e.g. a gallery image in Extras. It can hold several
// pictures (a CG's variants): dots at the bottom show which one is on screen.
// Mouse: scroll to zoom, drag to pan, double-click toggles zoom, click a dot to switch.
// Touch: pinch to zoom, drag to pan, double-tap toggles zoom, swipe or tap a dot to switch.
// Keyboard / pad: hold confirm (A) to zoom in, directions or stick pan, hold cancel (B) to zoom
// back out. Once fully out, cancel must be released and pressed again to close. Left/right switch
// pictures while not zoomed in (zoomed in they pan); tab keys / shoulder buttons switch any time.
import { Box } from '@mui/material'
import { type PointerEvent, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import screen from '@/content/config/screen'
import { ImageViewer as ViewerControls } from '@/content/ui/ImageViewer'
import { type Picture, pictureUrls } from '../gallery'
import { input } from '../input/manager'
import { useAction } from '../input/useAction'
import { gameScreen } from '../layers/screen'
import { Z } from '../layers/zIndex'
import { useSystemStore } from '../stores/system'
import { StackedPictureView } from './StackedPictureView'

// Zoom limit, speeds and background: src/content/config/screen.ts (imageViewer).
const {
  maxZoom: MAX_ZOOM,
  zoomPerSecond: ZOOM_PER_SECOND,
  panSpeed: PAN_SPEED,
} = screen.imageViewer
const DOUBLE_TAP_MS = screen.imageViewer.doubleTapMs
/** A horizontal drag this long (px), not zoomed in, switches picture. */
const SWIPE_PX = screen.imageViewer.swipePx

/** One picture: an image URL, or a stacked picture (a layered CG with toggles on). */
export interface ViewerPicture {
  picture: Picture
  /** Locked pictures show as an empty dot and are skipped. Default: unlocked. */
  locked?: boolean
}

interface View {
  s: number
  x: number
  y: number
}

export function ImageViewer(props: {
  pictures: readonly ViewerPicture[]
  /** Index of the picture to open on. */
  start?: number
  caption?: string
  onClose: () => void
}) {
  const device = useSystemStore((s) => s.device)
  const rootRef = useRef<HTMLDivElement>(null)
  const stackRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const { pictures } = props
  const [index, setIndex] = useState(() => Math.min(props.start ?? 0, pictures.length - 1))
  const picture = pictures[index]
  const switchable = pictures.filter((p) => !p.locked).length > 1

  /** Next unlocked picture in direction `step` (wraps around). */
  const go = (step: 1 | -1) => {
    for (let i = 1; i < pictures.length; i++) {
      const next = (index + step * i + pictures.length) % pictures.length
      if (!pictures[next]?.locked) return setIndex(next)
    }
  }

  // The neighbours load in the background, so switching is instant.
  useEffect(() => {
    for (const step of [1, -1]) {
      const near = pictures[(index + step + pictures.length) % pictures.length]
      if (near && !near.locked)
        for (const url of pictureUrls(near.picture)) {
          const img = new Image()
          img.src = url
        }
    }
  }, [index, pictures])
  const view = useRef<View>({ s: 1, x: 0, y: 0 })
  // Another picture: keep the zoom, but keep it inside the new picture.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the picture changes
  useEffect(() => apply(view.current), [index])
  /** Which button is zooming while held. 'out' stays set until cancel is released. */
  const holding = useRef<'in' | 'out' | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const tap = useRef({ downAt: 0, x: 0, y: 0, moved: false, lastTapAt: 0 })

  /** Clamps zoom and pan (the picture always covers the screen once zoomed) and writes it to the DOM. */
  const apply = (next: View) => {
    const root = rootRef.current
    const stack = stackRef.current
    if (!root || !stack) return
    const W = root.clientWidth
    const H = root.clientHeight
    // The picture's shape: a stacked picture knows it, a plain image once it has loaded.
    const shown = picture?.picture
    const img = imgRef.current
    const aspect =
      shown && typeof shown !== 'string'
        ? shown.aspect
        : img?.naturalWidth && img.naturalHeight
          ? img.naturalWidth / img.naturalHeight
          : W / H || 1
    // Its size on screen at zoom 1 (as large as fits).
    const fitW = Math.min(W, H * aspect)
    const fitH = fitW / aspect
    const s = Math.min(MAX_ZOOM, Math.max(1, next.s))
    const maxX = Math.max(0, (fitW * s - W) / 2)
    const maxY = Math.max(0, (fitH * s - H) / 2)
    const v = {
      s,
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    }
    view.current = v
    stack.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.s})`
    root.style.cursor = v.s > 1 ? 'grab' : 'zoom-in'
  }

  /** Zoom to `s`, keeping the picture point under (px, py) in place. px/py: from the screen centre. */
  const zoomAt = (s: number, px = 0, py = 0) => {
    const v = view.current
    const target = Math.min(MAX_ZOOM, Math.max(1, s))
    const r = target / v.s
    apply({ s: target, x: px - (px - v.x) * r, y: py - (py - v.y) * r })
  }

  /** A client point relative to the centre of the viewer. */
  const fromCentre = (clientX: number, clientY: number) => {
    const rect = rootRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 }
  }

  // Pad / keyboard: one press starts a hold; the loop below zooms while it stays held.
  useAction('confirm', (e) => {
    if (!e.repeat) holding.current = 'in'
  })
  useAction('cancel', (e) => {
    if (e.repeat) return
    if (view.current.s > 1) holding.current = 'out'
    else props.onClose()
  })
  // Directions pan in the loop. Taking them here stops focus moving in the window underneath,
  // and taking these stops other windows or tabs opening behind the picture.
  const take = () => {}
  useAction('up', take)
  useAction('down', take)
  // Not zoomed in, left/right switch picture; zoomed in they pan (the loop below).
  useAction('left', (e) => {
    if (!e.repeat && view.current.s <= 1) go(-1)
  })
  useAction('right', (e) => {
    if (!e.repeat && view.current.s <= 1) go(1)
  })
  useAction('menu', take)
  useAction('inventory', take)
  // Tab keys / shoulder buttons switch at any zoom (compare the same spot across variants).
  useAction('tabPrev', (e) => {
    if (!e.repeat) go(-1)
  })
  useAction('tabNext', (e) => {
    if (!e.repeat) go(1)
  })

  useEffect(() => {
    let last = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const v = view.current
      if (holding.current === 'in') {
        if (input.isDown('confirm')) zoomAt(v.s * ZOOM_PER_SECOND ** dt)
        else holding.current = null
      } else if (holding.current === 'out') {
        // Stops at 1 but stays 'out' until released, so the same hold never closes the viewer.
        if (input.isDown('cancel')) zoomAt(v.s / ZOOM_PER_SECOND ** dt)
        else holding.current = null
      }
      const move = input.move()
      if (view.current.s > 1 && (move.x !== 0 || move.y !== 0)) {
        const c = view.current
        apply({ ...c, x: c.x - move.x * PAN_SPEED * dt, y: c.y - move.y * PAN_SPEED * dt })
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  })

  // Mouse wheel. Native listener: React's onWheel is passive and can't stop the page scrolling.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const p = fromCentre(e.clientX, e.clientY)
      zoomAt(view.current.s * Math.exp(-e.deltaY * 0.0015), p.x, p.y)
    }
    root.addEventListener('wheel', onWheel, { passive: false })
    // Re-clamp when the screen changes size.
    const observer = new ResizeObserver(() => apply(view.current))
    observer.observe(root)
    return () => {
      root.removeEventListener('wheel', onWheel)
      observer.disconnect()
    }
  })

  // Focus moves here (so Enter can't click the thumbnail underneath) and back on close.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    rootRef.current?.focus({ preventScroll: true })
    return () => before?.focus({ preventScroll: true })
  }, [])

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 1)
      tap.current = {
        ...tap.current,
        downAt: performance.now(),
        x: e.clientX,
        y: e.clientY,
        moved: false,
      }
    else tap.current.moved = true
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    if (Math.hypot(e.clientX - tap.current.x, e.clientY - tap.current.y) > 10)
      tap.current.moved = true
    const others = [...pointers.current].filter(([id]) => id !== e.pointerId)
    const other = others[0]?.[1]
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (other) {
      // Pinch: scale by the change in finger distance, around the point between the fingers.
      const before = Math.hypot(prev.x - other.x, prev.y - other.y)
      const after = Math.hypot(e.clientX - other.x, e.clientY - other.y)
      const midBefore = fromCentre((prev.x + other.x) / 2, (prev.y + other.y) / 2)
      const midAfter = fromCentre((e.clientX + other.x) / 2, (e.clientY + other.y) / 2)
      if (before > 0) zoomAt(view.current.s * (after / before), midBefore.x, midBefore.y)
      const v = view.current
      apply({ ...v, x: v.x + midAfter.x - midBefore.x, y: v.y + midAfter.y - midBefore.y })
    } else {
      const v = view.current
      apply({ ...v, x: v.x + e.clientX - prev.x, y: v.y + e.clientY - prev.y })
    }
  }

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(e.pointerId)) return
    const now = performance.now()
    const t0 = tap.current
    // Swipe sideways (one finger, not zoomed in): next / previous picture.
    const dx = e.clientX - t0.x
    const dy = e.clientY - t0.y
    if (
      pointers.current.size === 0 &&
      view.current.s <= 1 &&
      Math.abs(dx) > SWIPE_PX &&
      Math.abs(dx) > Math.abs(dy) * 1.5
    ) {
      go(dx < 0 ? 1 : -1)
      return
    }
    if (pointers.current.size > 0 || t0.moved || now - t0.downAt > DOUBLE_TAP_MS) return
    if (now - t0.lastTapAt < DOUBLE_TAP_MS) {
      // Double tap / double click: zoom in on that spot, or back out.
      const p = fromCentre(e.clientX, e.clientY)
      if (view.current.s > 1) apply({ s: 1, x: 0, y: 0 })
      else zoomAt(screen.imageViewer.doubleTapZoom, p.x, p.y)
      t0.lastTapAt = 0
    } else {
      t0.lastTapAt = now
    }
  }

  const target = gameScreen() ?? document.body
  return createPortal(
    <Box
      ref={rootRef}
      tabIndex={-1}
      role="dialog"
      aria-label={props.caption}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      sx={{
        position: 'absolute',
        inset: 0,
        zIndex: Z.viewer,
        background: screen.imageViewer.background,
        overflow: 'hidden',
        touchAction: 'none',
        userSelect: 'none',
        outline: 'none',
        cursor: 'zoom-in',
      }}
    >
      <Box
        ref={stackRef}
        sx={{
          position: 'absolute',
          inset: 0,
          transformOrigin: 'center',
          willChange: 'transform',
          pointerEvents: 'none',
        }}
      >
        {typeof picture?.picture === 'string' ? (
          <Box
            component="img"
            ref={imgRef}
            src={picture.picture}
            alt=""
            draggable={false}
            onLoad={() => apply(view.current)}
            sx={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
          />
        ) : (
          picture && <StackedPictureView picture={picture.picture} fit="contain" />
        )}
      </Box>
      <ViewerControls
        caption={props.caption ?? null}
        device={device}
        switchable={switchable}
        variants={pictures.length > 1 ? pictures.map((p) => ({ locked: !!p.locked })) : []}
        index={index}
        select={setIndex}
        close={props.onClose}
      />
    </Box>,
    target,
  )
}
