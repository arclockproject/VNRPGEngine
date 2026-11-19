import { keyframes } from '@emotion/react'
import { Box, Button, CircularProgress, Stack, type SxProps, type Theme } from '@mui/material'
import { type ComponentType, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import screen from '@/content/config/screen'
import { TitleFrame } from '@/content/ui/TitleFrame'
import { TitleSwitcher as SwitcherLook } from '@/content/ui/TitleSwitcher'
import { audio } from '../audio/manager'
import { bootScreenAt, stepList } from '../boot'
import type { TitleConfig, TitleScreenProps } from '../define'
import { InputScope, useAction } from '../input/useAction'
import { useLang } from '../lang'
import { pickTitleMenu, title, titleMenuEntered } from '../managers/title'
import { type TitleId, titles } from '../registry'
import { usePersistentStore } from '../stores/persistent'
import { type SystemState, useSystemStore } from '../stores/system'
import {
  currentTitle,
  prepareTitle,
  readyTitle,
  stepTitle,
  titlesHaveMusic,
  unlockedTitles,
} from '../titles'
import { Z } from './zIndex'

/** A menu button appearing: fades in, from a few pixels to one side if the menu says so. */
const enter = keyframes`
  from { opacity: 0; transform: translate(var(--enter-x, 0), var(--enter-y, 0)) }
  to   { opacity: 1; transform: none }
`
const fadeOut = keyframes`from { opacity: 1 } to { opacity: 0 }`
/** How long the old title screen takes to fade out when the player switches. */
const SWITCH_FADE_MS = screen.timings.titleSwitchFade
/** Loading shorter than this shows only black (no spinner flash). */
const SPINNER_DELAY_MS = screen.timings.titleSpinnerDelay

/** Shows src/content/ui/TitleFrame.tsx while the title screen is up. */
export function TitleLayer() {
  const state = useSystemStore((s) => s.title)
  const ready = useSystemStore((s) => s.titleReady)
  if (!state) return null
  return (
    <Box
      data-layer="title"
      sx={{
        position: 'absolute',
        inset: 0,
        zIndex: Z.title,
        opacity: state === 'leaving' ? 0 : 1,
        transition: `opacity ${title.fadeMs}ms ease`,
        pointerEvents: state === 'leaving' ? 'none' : 'auto',
        bgcolor: 'common.black',
      }}
    >
      <InputScope layer="title">
        {state === 'boot' ? <BootScreens /> : ready ? <TitleFrame /> : <TitleLoading />}
      </InputScope>
    </Box>
  )
}

/** The boot screen that is playing (src/content/boot), black between them. */
function BootScreens() {
  const boot = useSystemStore((s) => s.boot)
  if (!boot) return null
  return <BootScreen key={boot.index} {...boot} />
}

function BootScreen({ index, step, out, fade }: NonNullable<SystemState['boot']>) {
  const ref = useRef<HTMLDivElement>(null)
  const [on, setOn] = useState(false)
  // Drawn see-through first (the read makes the browser note that), then faded in. A skip in the
  // middle of the fade-in then fades back out from where it was.
  useEffect(() => {
    void ref.current?.offsetWidth
    setOn(true)
  }, [])
  const Screen = bootScreenAt(index)?.screen
  if (!Screen) return null
  return (
    <Box
      ref={ref}
      data-boot={index}
      sx={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        opacity: on && !out ? 1 : 0,
        transition: `opacity ${fade}ms ease`,
      }}
    >
      <Screen step={step} />
    </Box>
  )
}

/** Black while the title screen loads; a spinner only if it takes a while. */
function TitleLoading() {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SPINNER_DELAY_MS)
    return () => clearTimeout(timer)
  }, [])
  return (
    <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
      {slow && <CircularProgress size={28} />}
    </Box>
  )
}

/** Re-renders when title screens are unlocked or picked. */
function useTitleChoice(): { current: TitleId | null; unlocked: TitleId[] } {
  usePersistentStore(
    (s) =>
      `${s.titleScreen ?? ''}|${Object.keys(s.unlocked)
        .filter((k) => k.startsWith('title:'))
        .join(',')}`,
  )
  return { current: currentTitle(), unlocked: unlockedTitles() }
}

interface Shown {
  id: TitleId
  key: number
  Screen: ComponentType<TitleScreenProps>
}

/**
 * The current title screen variant (src/content/titles). Place it in TitleFrame.tsx, behind the
 * menu. A new pick waits until it is fully loaded, then plays its entrance while the old one fades.
 */
export function TitleArt() {
  const phase = useSystemStore((s) => s.title)
  // Nothing behind "press any key": the art mounts (and plays its entrance) after the press.
  if (phase === 'waiting' || phase === 'boot' || phase === null) return null
  return <TitleArtLayers phase={phase} />
}

/** Jumps every CSS animation inside to its end (endless ones to their start: past the delay). */
function finishAnimations(element: HTMLElement | null) {
  if (typeof element?.getAnimations !== 'function') return
  for (const animation of element.getAnimations({ subtree: true })) {
    const timing = animation.effect?.getComputedTiming()
    try {
      if (timing && Number(timing.endTime) === Number.POSITIVE_INFINITY)
        animation.currentTime = Number(timing.delay ?? 0)
      else animation.finish()
    } catch {
      // an animation that cannot be finished keeps playing
    }
  }
}

/** One title screen variant, walking through its `intro` steps from the moment it appears. */
function ArtLayer({
  id,
  Screen,
  phase,
}: Pick<Shown, 'id' | 'Screen'> & { phase: TitleScreenProps['phase'] }) {
  const ref = useRef<HTMLDivElement>(null)
  const steps = useMemo(
    () => stepList((titles as Record<string, TitleConfig | undefined>)[id]?.intro),
    [id],
  )
  const skips = useSystemStore((s) => s.titleSkips)
  const [skipsAtMount] = useState(skips)
  const skipped = skips !== skipsAtMount
  const [step, setStep] = useState(0)
  useEffect(() => {
    const ms = steps[step]
    if (ms === undefined) return
    const timer = setTimeout(() => setStep(step + 1), ms)
    return () => clearTimeout(timer)
  }, [step, steps])
  // Skipped: the screen gets its last step, and whatever is still animating jumps to its end.
  useLayoutEffect(() => {
    if (skipped) finishAnimations(ref.current)
  }, [skipped])
  return (
    <Box ref={ref} sx={{ position: 'absolute', inset: 0 }}>
      <Screen phase={phase} step={skipped ? steps.length : step} />
    </Box>
  )
}

function TitleArtLayers({ phase }: { phase: TitleScreenProps['phase'] }) {
  const { current } = useTitleChoice()
  const counter = useRef(0)
  const [layers, setLayers] = useState<Shown[]>(() => {
    const Screen = current ? readyTitle(current) : undefined
    return current && Screen ? [{ id: current, key: 0, Screen }] : []
  })
  const top = layers.at(-1)

  useEffect(() => {
    if (!current || top?.id === current) return
    let alive = true
    prepareTitle(current)
      .then((Screen) => {
        if (!alive) return
        counter.current += 1
        const key = counter.current
        setLayers((list) => [...list.slice(-1), { id: current, key, Screen }])
        setTimeout(() => setLayers((list) => list.filter((l) => l.key >= key)), SWITCH_FADE_MS)
      })
      .catch((error: unknown) => console.error('[title] could not load', current, error))
    return () => {
      alive = false
    }
  }, [current, top?.id])

  // Each variant's own music (if any title has music, one without stops it).
  const shownId = top?.id
  useEffect(() => {
    if (!shownId) return
    const music = titles[shownId]?.music
    if (music) audio.music(music)
    else if (titlesHaveMusic()) audio.stopMusic()
  }, [shownId])

  return (
    <Box sx={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {layers.map((layer) => (
        <Box
          key={layer.key}
          sx={{
            position: 'absolute',
            inset: 0,
            ...(layer.key !== top?.key && {
              animation: `${fadeOut} ${SWITCH_FADE_MS}ms ease both`,
              pointerEvents: 'none',
            }),
          }}
        >
          <ArtLayer id={layer.id} Screen={layer.Screen} phase={phase} />
        </Box>
      ))}
    </Box>
  )
}

/**
 * Switches between unlocked title screens: ◀ name (2/3) ▶. Place it in TitleFrame.tsx (bottom
 * left). Hidden until 2 are unlocked and until the entrance is over; usable once the menu has
 * appeared. Q / R, LB / RB also switch.
 */
export function TitleSwitcher() {
  const t = useLang()
  const { current, unlocked } = useTitleChoice()
  const phase = useSystemStore((s) => s.title)
  const usable = useSystemStore((s) => s.titleMenuIn)
  const active = phase === 'menu' || phase === 'shown'
  useAction('tabPrev', () => (active && usable ? stepTitle(-1) : false), { layers: ['title'] })
  useAction('tabNext', () => (active && usable ? stepTitle(1) : false), { layers: ['title'] })
  if (!current || unlocked.length < 2 || !active) return null
  const index = unlocked.indexOf(current)
  const name = titles[current]?.name ?? current
  // The look: src/content/ui/TitleSwitcher.tsx. Inert until the menu has come in.
  return (
    <Stack direction="row" spacing={1} inert={!usable} sx={{ alignItems: 'center' }}>
      <SwitcherLook
        name={t(name)}
        index={index}
        count={unlocked.length}
        previous={() => stepTitle(-1)}
        next={() => stepTitle(1)}
        usable={usable}
      />
    </Stack>
  )
}

/** How a title menu button appears: a plain fade, or a fade while sliding in from a side. */
export type TitleMenuEffect = 'fade' | 'left' | 'right' | 'top' | 'bottom'

export interface TitleMenuProps {
  /** Default 'fade'. */
  effect?: TitleMenuEffect
  /** How far a button slides in, px (not used by 'fade'). Default 12. */
  distance?: number
  /** How long one button takes to appear, ms. Default 250. */
  duration?: number
  /** Delay between one button and the next (top to bottom), ms. Default 80. */
  stagger?: number
  /** Styles for the list (e.g. a smaller `gap` on short screens). */
  sx?: SxProps<Theme>
  /** Styles for every button (e.g. a smaller `minHeight` on short screens). */
  buttonSx?: SxProps<Theme>
}

/** An sx prop as a list, to merge it after the engine's own styles. */
type SxItem = Exclude<SxProps<Theme>, readonly unknown[]>
const sxList = (sx: SxProps<Theme> | undefined): readonly SxItem[] =>
  sx === undefined ? [] : Array.isArray(sx) ? (sx as readonly SxItem[]) : [sx as SxItem]

const ENTER_FROM: Record<TitleMenuEffect, readonly [x: number, y: number]> = {
  fade: [0, 0],
  left: [-1, 0],
  right: [1, 0],
  top: [0, -1],
  bottom: [0, 1],
}

/**
 * The buttons of game.title.menu(). Place it in TitleFrame.tsx where the menu should appear.
 * They appear one after another, top to bottom, and cannot be used until the last one is fully
 * in (a confirm press, click or tap skips to that). Arrows / d-pad / stick move between them
 * (engine default for the title layer).
 */
export function TitleMenu({
  effect = 'fade',
  distance = 12,
  duration = 250,
  stagger = 80,
  sx,
  buttonSx,
}: TitleMenuProps) {
  const labels = useSystemStore((s) => s.titleMenu)
  const entered = useSystemStore((s) => s.titleMenuIn)
  const count = labels?.length ?? 0

  // Usable once the last button has finished appearing.
  useEffect(() => {
    if (count === 0 || entered) return
    const timer = setTimeout(titleMenuEntered, duration + stagger * (count - 1))
    return () => clearTimeout(timer)
  }, [count, entered, duration, stagger])

  const ref = useRef<HTMLDivElement>(null)
  const hasWindow = useSystemStore((s) => s.windows.length > 0)
  // A pointer click only counts if its press started on this menu. The tap that leaves
  // "Tap to continue" (or closes a window) would otherwise click the button that just appeared
  // under the finger.
  const armed = useRef(false)

  // Focus the first button when the menu has appeared or a window over it closes.
  useEffect(() => {
    armed.current = false
    if (labels && !hasWindow && entered)
      ref.current?.querySelector('button')?.focus({ focusVisible: true } as FocusOptions)
  }, [labels, hasWindow, entered])

  if (!labels) return null
  return (
    <Stack
      ref={ref}
      spacing={1.5}
      useFlexGap
      inert={!entered}
      sx={[
        {
          width: '100%',
          maxWidth: 320,
          '--enter-x': `${ENTER_FROM[effect][0] * distance}px`,
          '--enter-y': `${ENTER_FROM[effect][1] * distance}px`,
        },
        ...sxList(sx),
      ]}
      onPointerDownCapture={() => {
        armed.current = true
      }}
    >
      {labels.map((label, index) => (
        <Button
          key={label}
          variant="titleButton"
          size="large"
          onClick={(e) => {
            // detail 0 = keyboard Enter/Space or the gamepad's scripted click(): always allowed.
            if (e.detail !== 0 && !armed.current) return
            pickTitleMenu(index)
          }}
          // No animation once entered: a skip shows every button in full at once.
          sx={[
            ...sxList(buttonSx),
            !entered && {
              animation: `${enter} ${duration}ms ease ${index * stagger}ms both`,
            },
          ]}
        >
          {label}
        </Button>
      ))}
    </Stack>
  )
}
