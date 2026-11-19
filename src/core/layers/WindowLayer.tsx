import { keyframes } from '@emotion/react'
import { Box, Paper } from '@mui/material'
import {
  type ComponentType,
  type MouseEvent,
  type ReactNode,
  Suspense,
  use,
  useEffect,
  useRef,
  useState,
} from 'react'
import look from '@/content/look'
import { Window } from '@/content/ui/Window'
import type { WindowProps, WindowTransition } from '../define'
import { game } from '../game'
import { firstFocusable } from '../input/navigation'
import { useLang } from '../lang'
import { boxLook, hasFrame, windowGapCss } from '../look'
import { loadWindow } from '../registry'
import { useSettingsStore } from '../stores/settings'
import { type OpenWindow, useSystemStore } from '../stores/system'
import { part } from '../ui/part'
import { WindowIdContext } from '../ui/WindowContent'
import { ErrorBoundary } from './ErrorBoundary'
import { Loading } from './Loading'
import { Z } from './zIndex'

interface LoadedWindowDef {
  title: string
  component: ComponentType<WindowProps<unknown>>
  width?: number | string
  modal?: boolean
  closable?: boolean
  transition?: WindowTransition
}

/** Each loaded window's `transition` (defineWindow), so a closing one knows how long to stay. */
const transitions = new Map<string, WindowTransition | undefined>()

/** Where a window comes from / goes to (CSS transform), for its transition's effect. */
function offstage(t: WindowTransition, still: boolean): string {
  const d = t.distance ?? 24
  if (still) return 'none'
  switch (t.effect ?? 'fade') {
    case 'scale':
      return 'scale(0.94)'
    case 'slideUp':
      return `translateY(${d}px)`
    case 'slideDown':
      return `translateY(${-d}px)`
    case 'slideLeft':
      return `translateX(${d}px)`
    case 'slideRight':
      return `translateX(${-d}px)`
    default:
      return 'none'
  }
}

/** The CSS animation of a window coming in or going out (none without a transition). */
function windowAnimation(
  t: WindowTransition | undefined,
  leaving: boolean,
  still: boolean,
): string | undefined {
  const ms = leaving ? (t?.out ?? 0) : (t?.in ?? 0)
  if (!t || ms <= 0) return undefined
  const away = offstage(t, still)
  const motion = leaving
    ? keyframes`from { opacity: 1; transform: none } to { opacity: 0; transform: ${away} }`
    : keyframes`from { opacity: 0; transform: ${away} } to { opacity: 1; transform: none }`
  return `${motion} ${ms}ms ${t.ease ?? 'ease'} both`
}

interface Leaving {
  entry: OpenWindow
  index: number
}

const POPUPS = '.MuiPopover-root, .MuiPopper-root, .MuiMenu-root, .MuiDialog-root'

/** Closes the front window, unless it is `closable: false`. */
function closeTopWindow() {
  const top = useSystemStore.getState().windows.at(-1)
  if (!top) return
  const el = document.querySelector(`[data-window-id="${top.id}"]`)
  if (el instanceof HTMLElement && el.dataset.closable === 'false') return
  game.windows.close(top.id)
}

/**
 * A click that both started and ended outside the windows. A press that starts inside a window
 * and is released outside (dragging a slider) clicks their shared parent, not this element.
 */
function clickOutside(e: MouseEvent) {
  if (e.target === e.currentTarget) closeTopWindow()
}

export function WindowLayer() {
  const stack = useSystemStore((s) => s.windows)
  // Windows closed with an `out` transition stay (same instance, no input) until it has played.
  // Worked out while rendering, so the window never leaves the screen for a frame.
  const [shown, setShown] = useState(stack)
  const [leaving, setLeaving] = useState<Leaving[]>([])
  if (shown !== stack) {
    const gone = shown
      .map((entry, index) => ({ entry, index }))
      .filter(
        ({ entry }) =>
          !stack.some((w) => w.id === entry.id) && (transitions.get(entry.id)?.out ?? 0) > 0,
      )
    setShown(stack)
    setLeaving((list) => [
      ...list.filter(
        (l) =>
          !stack.some((w) => w.id === l.entry.id) && !gone.some((g) => g.entry.id === l.entry.id),
      ),
      ...gone,
    ])
  }
  useEffect(() => {
    if (leaving.length === 0) return
    const timers = leaving.map((l) =>
      setTimeout(
        () => setLeaving((list) => list.filter((x) => x !== l)),
        transitions.get(l.entry.id)?.out ?? 0,
      ),
    )
    return () => {
      for (const timer of timers) clearTimeout(timer)
    }
  }, [leaving])

  // The bars around the game screen are outside the catcher below: a click there closes too.
  useEffect(() => {
    if (stack.length === 0) return
    const inside = (target: EventTarget | null) =>
      target instanceof Element && !!target.closest(`#game-screen, ${POPUPS}`)
    // The press must start in the bars too. A press on a dropdown opens its list under the
    // finger, so the release lands on the list's backdrop: the browser then sends the click to
    // their shared parent (the page), which looks just like a click on the bars. On touch this
    // closed the window the moment a dropdown was tapped.
    let startedOutside = false
    const onDown = (e: globalThis.PointerEvent) => {
      startedOutside = !inside(e.target)
    }
    const onClick = (e: globalThis.MouseEvent) => {
      const outside = startedOutside
      startedOutside = false
      // A button that was removed by its own click (title menu) has no parents left to check.
      if (!(e.target instanceof Element) || !e.target.isConnected) return
      if (!outside || inside(e.target)) return
      closeTopWindow()
    }
    // Added a tick later: the click that opened the window is still on its way up to `window`
    // and would otherwise be heard here too.
    const timer = setTimeout(() => window.addEventListener('click', onClick))
    window.addEventListener('pointerdown', onDown, { capture: true })
    return () => {
      clearTimeout(timer)
      window.removeEventListener('click', onClick)
      window.removeEventListener('pointerdown', onDown, { capture: true })
    }
  }, [stack.length])

  return (
    <Box sx={{ position: 'absolute', inset: 0, zIndex: Z.windows, pointerEvents: 'none' }}>
      {/* While a window is open, this takes every click that misses the windows, so nothing
          under them (map, scene, toolbar, title menu) gets it. The click closes the top window. */}
      {stack.length > 0 && (
        <Box
          data-window-catcher
          onClick={clickOutside}
          sx={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }}
        />
      )}
      {stack.map((entry, index) => (
        <WindowSlot key={entry.id} entry={entry} index={index} isTop={index === stack.length - 1} />
      ))}
      {leaving.map(({ entry, index }) => (
        <WindowSlot key={entry.id} entry={entry} index={index} isTop={false} leaving />
      ))}
    </Box>
  )
}

interface SlotProps {
  entry: OpenWindow
  index: number
  isTop: boolean
  /** Closed, playing its `out` transition: drawn, but takes no input. */
  leaving?: boolean
}

function WindowSlot(props: SlotProps) {
  const close = () => game.windows.close(props.entry.id)
  return (
    <ErrorBoundary label={`window "${props.entry.id}"`} onDismiss={close}>
      <Suspense
        fallback={
          <WindowFrame {...props} title="" closable>
            <Loading />
          </WindowFrame>
        }
      >
        <LoadedWindow {...props} close={close} />
      </Suspense>
    </ErrorBoundary>
  )
}

function LoadedWindow(props: SlotProps & { close: () => void }) {
  const t = useLang()
  const def = use(loadWindow(props.entry.id)) as unknown as LoadedWindowDef
  transitions.set(props.entry.id, def.transition)
  const Component = def.component
  return (
    <WindowFrame
      {...props}
      title={t(def.title)}
      width={def.width}
      modal={def.modal}
      closable={def.closable ?? true}
      transition={def.transition}
    >
      <ErrorBoundary label={`window "${props.entry.id}"`} onDismiss={props.close}>
        <Component params={props.entry.params} close={props.close} />
      </ErrorBoundary>
    </WindowFrame>
  )
}

interface FrameProps extends SlotProps {
  title: string
  width?: number | string
  modal?: boolean
  closable: boolean
  transition?: WindowTransition
  children: ReactNode
}

function WindowFrame({
  entry,
  index,
  isTop,
  title,
  width = 420,
  modal,
  closable,
  transition,
  leaving = false,
  children,
}: FrameProps) {
  const ref = useRef<HTMLDivElement>(null)
  const device = useSystemStore((s) => s.device)
  const still = useSettingsStore((s) => s.reduceMotion)
  const animation = windowAnimation(transition, leaving, still)

  // A window that comes to the front focuses its first control, so a pad or keyboard works at
  // once. Not on touch (it would show focus rings and pop the on-screen keyboard).
  useEffect(() => {
    const el = ref.current
    if (!isTop || !el || device === 'touch') return
    if (el.contains(document.activeElement)) return
    const content = el.querySelector('[data-window-content]')
    const first = content ? firstFocusable(content) : undefined
    first?.focus({ focusVisible: true } as FocusOptions)
  }, [isTop, device])

  // src/content/ui/Window.tsx must put the content in a <WindowContent>: without it, keys, buttons
  // and focus don't reach the window. Dev only.
  useEffect(() => {
    if (import.meta.env.DEV && !ref.current?.querySelector('[data-window-content]'))
      console.warn(
        `[windows] "${entry.id}" has no <WindowContent>: keep it in src/content/ui/Window.tsx, or keyboard and controller can't use the window.`,
      )
  }, [entry.id])

  const cssWidth = typeof width === 'number' ? `${width}px` : width

  return (
    <>
      {modal && !leaving && (
        <Box
          onClick={clickOutside}
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: index * 2,
            ...part('cover'),
            pointerEvents: 'auto',
          }}
        />
      )}
      {/* Centred. The gap around it (look.windowGap) is smaller on small screens. */}
      <Box
        // Going out (transition.out): still drawn, but nothing in it can be pressed or focused.
        inert={leaving}
        aria-hidden={leaving || undefined}
        sx={{
          position: 'absolute',
          inset: windowGapCss(look.windowGap),
          zIndex: index * 2 + 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <Paper
          ref={ref}
          role="dialog"
          data-window-id={leaving ? undefined : entry.id}
          data-closable={String(closable)}
          aria-label={title}
          elevation={isTop ? 12 : 4}
          onPointerDownCapture={() => game.windows.focus(entry.id)}
          sx={{
            ...boxLook(look.window),
            // As wide as the content needs: at least `width`, never past the screen.
            width: 'fit-content',
            minWidth: `min(${cssWidth}, 100%)`,
            maxWidth: '100%',
            maxHeight: '100%',
            minHeight: 0,
            // So a slot's position: 'absolute' sits on the window (src/content/ui/Window.tsx).
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            pointerEvents: 'auto',
            // A framed window shows its own edge, so no extra outline on the front one.
            outline: isTop && !hasFrame(look.window, look.panel) ? '1px solid' : 'none',
            outlineColor: 'primary.main',
            ...(animation ? { animation } : {}),
            ...(leaving ? { pointerEvents: 'none' } : {}),
          }}
        >
          {/* Title bar, the content's box (<WindowContent>) and anything else: src/content/ui/Window.tsx. */}
          <WindowIdContext value={entry.id}>
            <Window
              id={entry.id}
              title={title}
              closable={closable}
              isTop={isTop}
              close={() => game.windows.close(entry.id)}
            >
              {children}
            </Window>
          </WindowIdContext>
        </Paper>
      </Box>
    </>
  )
}
