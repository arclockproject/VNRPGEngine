import { Box } from '@mui/material'
import { useEffect, useRef } from 'react'
import screen from '@/content/config/screen'
import { DevPanel } from '../dev/DevPanel'
import { getGame } from '../gameRef'
import { endChapterCard } from '../scene/chapterCard'
import { useSettingsStore } from '../stores/settings'
import { ChapterCardLayer } from './ChapterCardLayer'
import { ErrorBoundary } from './ErrorBoundary'
import { EventLayer } from './EventLayer'
import { HudLayer } from './HudLayer'
import { MapLayer } from './MapLayer'
import { MenuButtonLayer } from './MenuButtonLayer'
import { MinigameLayer } from './MinigameLayer'
import { QuickKeys } from './QuickKeys'
import { ReplayCover } from './ReplayCover'
import { RotateCover } from './RotateCover'
import { screenSize } from './screen'
import { TimerLayer } from './TimerLayer'
import { TitleLayer } from './TitleLayer'
import { ToastLayer } from './ToastLayer'
import { TouchControls } from './TouchControls'
import { TransitionLayer } from './TransitionLayer'
import { WindowLayer } from './WindowLayer'

/** All screen layers, bottom to top: map → hud → transition → event → touch → minigame → windows → title. */
export function GameRoot() {
  const ratio = useSettingsStore((s) => s.screenRatio)
  const ref = useRef<HTMLDivElement>(null)

  // Marks the screen as short (written to the DOM, no re-render) for compact layouts.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      el.toggleAttribute('data-short', el.clientHeight <= screen.shortHeight)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // The map canvas and minigames resize on window 'resize'; a new ratio changes the box without one.
  useEffect(
    () =>
      useSettingsStore.subscribe((s, prev) => {
        if (s.screenRatio !== prev.screenRatio)
          requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
      }),
    [],
  )

  return (
    <>
      <RotateCover />
      <Box
        ref={ref}
        id="game-screen"
        sx={{
          position: 'fixed',
          inset: 0,
          m: 'auto',
          ...screenSize(ratio),
          overflow: 'hidden',
          // Container units (cqw/cqh) measure this box; also keeps position: fixed children inside it.
          containerType: 'size',
        }}
      >
        {/* One broken layer must not blank the whole game: each has its own boundary. */}
        <ErrorBoundary label="map" retry>
          <MapLayer />
        </ErrorBoundary>
        <ErrorBoundary label="hud" retry>
          <HudLayer />
        </ErrorBoundary>
        <TransitionLayer />
        <ErrorBoundary label="event" onDismiss={() => getGame().events.abort()}>
          <EventLayer />
        </ErrorBoundary>
        <ErrorBoundary label="chapter card" onDismiss={endChapterCard}>
          <ChapterCardLayer />
        </ErrorBoundary>
        <TouchControls />
        <MinigameLayer />
        <ReplayCover />
        <WindowLayer />
        <ErrorBoundary label="title screen" retry>
          <TitleLayer />
        </ErrorBoundary>
        <ErrorBoundary label="menu button" retry>
          <MenuButtonLayer />
        </ErrorBoundary>
        <ErrorBoundary label="timers" retry>
          <TimerLayer />
        </ErrorBoundary>
        <ToastLayer />
        <QuickKeys />
        {import.meta.env.DEV && <DevPanel />}
      </Box>
    </>
  )
}
