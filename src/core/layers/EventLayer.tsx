// Visual-novel layer: background, portraits, filters, dialogue box, choices and log.

import { Box } from '@mui/material'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import scenes from '@/content/scenes'
import { game } from '../game'
import { InputScope, useAction } from '../input/useAction'
import { registerVeil } from '../scene/effects'
import { backdropCss, backgroundTint, filterCss, tintScales } from '../scene/filters'
import { playback } from '../scene/playback'
import { isFastForward, isRewinding, onReplayChange } from '../scene/replay'
import type { SceneState } from '../scene/state'
import { useGameStore } from '../stores/game'
import { topLayer, useSystemStore } from '../stores/system'
import { Actor } from './event/Actor'
import { Backgrounds } from './event/Backgrounds'
import { Choices } from './event/Choices'
import { DialogueBox, SceneToolbar } from './event/DialogueBox'
import { Inset } from './event/Inset'
import { LogPanel } from './event/LogPanel'
import { MovieLayer } from './event/MovieLayer'
import { Pictures } from './event/Pictures'
import { SceneWeather } from './event/SceneWeather'
import { useCameraTarget } from './event/shared'
import { TintDefs } from './event/TintDefs'
import { Z } from './zIndex'

// The mouse wheel: src/content/scenes.ts wheel.
const WHEEL_MIN = scenes.wheel.min ?? 4
const WHEEL_GAP_MS = scenes.wheel.gapMs ?? 140
const WHEEL_AFTER_LOG_MS = scenes.wheel.afterLogMs ?? 350
/** inset() over the chat box instead of under it (src/content/scenes.ts inset.layer). */
const INSET_OVER_BOX = scenes.inset?.layer === 'overBox'

const logRequests = new Set<() => void>()

/** Opens the log of the running scene (the pause menu uses this). */
export function openLog() {
  for (const open of logRequests) open()
}

export function EventLayer() {
  const event = useSystemStore((s) => s.event)
  // While a scene fast-forwards (a mid-scene save loading, Back) it changes many times behind the
  // black cover: draw none of that, only where it ends up. This keeps Back quick in long scenes.
  useSyncExternalStore(onReplayChange, isFastForward, () => false)
  const held = useRef<SceneState | null>(null)
  const scene = useSystemStore((s) => {
    if (!held.current || !isFastForward()) held.current = s.scene
    return held.current
  })
  // Between two events of a route (VN mode) the stage stays on screen: no black frame. Its
  // controls only act while an event is on top, so nothing reacts in that moment.
  const carried = useGameStore((s) => s.route != null)
  const hasStage =
    scene.background !== null ||
    scene.actors.length > 0 ||
    scene.images.length > 0 ||
    scene.inset !== null
  // Back tears the scene down and runs it again: keep showing it meanwhile (no empty frame).
  if (!event && !(carried && hasStage) && !isRewinding()) return null
  return (
    <InputScope layer="event">
      <Scene scene={scene} />
    </InputScope>
  )
}

function Scene({ scene }: { scene: SceneState }) {
  const replayOverTitle = useSystemStore((s) => s.sceneReplay)
  const [logOpen, setLogOpen] = useState(false)
  /** "Hide" in the toolbar: the box and choices step aside to show the scene. Any tap brings them back. */
  const [hidden, setHidden] = useState(false)
  const show = () => setHidden(false)
  /** Set by the dialogue box: continue (finish typing or go to the next line). */
  const continueRef = useRef<() => boolean>(() => false)
  /** Who says the current line: its speaker, or everyone in a line said together. */
  const talkers: string[] = scene.line?.group ?? (scene.line?.speaker ? [scene.line.speaker] : [])
  /**
   * A tap only continues if it started on the scene while the scene was on top. A tap on the ☰
   * button can still end in a click over the scene, and must not move the dialogue on. (Clicks
   * outside an open window never get here: WindowLayer's catcher takes them.)
   */
  const root = useRef<HTMLDivElement>(null)
  const tapStarted = useRef(false)
  /** The mouse wheel acts again after this time (one step per notch, not one per event). */
  const wheelFrom = useRef(0)
  useEffect(() => {
    const onDown = (e: globalThis.PointerEvent) => {
      tapStarted.current =
        !e.defaultPrevented &&
        e.target instanceof Node &&
        !!root.current?.contains(e.target) &&
        topLayer(useSystemStore.getState()) === 'event'
    }
    window.addEventListener('pointerdown', onDown, { capture: true })
    return () => window.removeEventListener('pointerdown', onDown, { capture: true })
  }, [])

  // Menu opens the pause menu (save, load, settings, title…). The log is in the menu too.
  useAction('menu', () => {
    game.windows.toggle('menu')
  })
  useAction('confirm', () => {
    if (!hidden) return false
    show()
    return true
  })
  useAction('hide', () => {
    setHidden((h) => !h)
  })
  // Back: here and not in the chat box, so it also works while choices show without a line.
  useAction('back', () => {
    void game.save.rollback()
  })
  // Log: its own key / button (L, View) any time; the same closes it again (LogPanel).
  useAction('log', (e) => {
    if (e.repeat) return false
    setLogOpen(true)
    return true
  })
  // Auto-play on / off (T, RB), like the toolbar's Auto.
  useAction('auto', (e) => {
    if (!e.repeat) playback.toggleAuto()
  })
  // Up opens the log (down at its end, or cancel, closes it). Choices use up/down themselves.
  useAction('up', (e) => {
    if (e.repeat || (scene.choices && !hidden)) return false
    setLogOpen(true)
    return true
  })

  useEffect(() => {
    const open = () => setLogOpen(true)
    logRequests.add(open)
    return () => {
      logRequests.delete(open)
    }
  }, [])

  // Filters and tints (scene/filters.ts): the whole stage, the background only, the characters
  // (their own one, else the characters' one, else the background variant's tint).
  const stageFilter = filterCss(scene.filter)
  const stageBackdrop = backdropCss(scene.filter)
  const autoTint = backgroundTint(scene.backgroundRef?.variant)
  const charactersFilter = scene.partFilters.characters ?? autoTint
  const actorFilter = (actor: SceneState['actors'][number]) =>
    actor.tint !== undefined ? actor.tint : charactersFilter
  const scales = tintScales([
    scene.filter,
    scene.partFilters.background,
    charactersFilter,
    ...scene.actors.map((a) => a.tint),
  ])

  return (
    <Box
      ref={root}
      data-capture // part of save pictures (core/save/thumbnail.ts)
      // The same gate for everything in the scene (toolbar, choices): a tap that started on
      // something else (a touch button that is gone now) must not press what was under it.
      // detail 0 = a click made by a key or by code, which has no tap to check.
      onClickCapture={(e) => {
        if (e.detail !== 0 && !tapStarted.current) e.stopPropagation()
      }}
      onClick={() => {
        if (!tapStarted.current) return
        tapStarted.current = false
        if (hidden) show()
        else continueRef.current()
      }}
      // Mouse wheel: up opens the log, down continues (src/content/scenes.ts `wheel`).
      onWheel={(e) => {
        if (logOpen || hidden || scene.movie || (scene.choices && !scene.line)) return
        if (scene.choices || Math.abs(e.deltaY) < WHEEL_MIN) return
        if (topLayer(useSystemStore.getState()) !== 'event') return
        const now = performance.now()
        if (now < wheelFrom.current) return
        wheelFrom.current = now + WHEEL_GAP_MS
        if (e.deltaY < 0 && scenes.wheel.log) setLogOpen(true)
        else if (e.deltaY > 0 && scenes.wheel.advance) continueRef.current()
      }}
      // Right-click hides / shows the text box, as in most visual novels.
      onContextMenu={(e) => {
        e.preventDefault()
        setHidden((h) => !h)
      }}
      sx={{
        position: 'absolute',
        inset: 0,
        zIndex: replayOverTitle ? Z.replay : Z.event,
        userSelect: 'none',
      }}
    >
      {/* Replays from Extras have no map behind them. */}
      {replayOverTitle && <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'common.black' }} />}
      {/* Filters everything below the event layer (the map) as well as the stage. */}
      <TintDefs scales={scales} />
      {stageBackdrop && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            backdropFilter: stageBackdrop,
            WebkitBackdropFilter: stageBackdrop,
          }}
        />
      )}
      <Box
        sx={{ position: 'absolute', inset: 0, filter: stageFilter ?? 'none', overflow: 'hidden' }}
      >
        {/* The stage moves with camera(): background and portraits. */}
        <Box ref={useCameraTarget()} sx={{ position: 'absolute', inset: 0 }}>
          {/* Always this box (adding it later would start the background over). */}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              filter: filterCss(scene.partFilters.background) ?? 'none',
            }}
          >
            <Backgrounds
              value={scene.background}
              fadeMs={scene.backgroundFade}
              transition={scene.backgroundTransition}
            />
          </Box>
          <Pictures images={scene.images} layer="back" />
          {scene.actors.map((actor) => (
            <Actor
              key={actor.id}
              actor={actor}
              filter={filterCss(actorFilter(actor))}
              dimmed={scenes.stage.dim.on && talkers.length > 0 && !talkers.includes(actor.id)}
            />
          ))}
          <Pictures images={scene.images} layer="front" />
        </Box>
        {/* inset(): a framed picture in the middle, over the stage (it does not move with camera()). */}
        {!INSET_OVER_BOX && <Inset inset={scene.inset} fadeMs={scene.insetFade} />}
        {/* Weather stays put while the camera moves (it falls in front of the lens). */}
        {scene.weather && <SceneWeather weather={scene.weather} />}
      </Box>
      {/* flash() / fade() colour layer, above the stage and below the dialogue. */}
      <Box
        ref={registerVeil}
        sx={{ position: 'absolute', inset: 0, opacity: 0, pointerEvents: 'none' }}
      />

      {scene.line && (
        <DialogueBox
          line={scene.line}
          page={scene.page}
          speakerOnStage={scene.actors.some((actor) => talkers.includes(actor.id))}
          continueRef={continueRef}
          onHide={() => setHidden(true)}
          hidden={hidden}
          onShow={show}
        />
      )}
      {/* scenes.ts inset.layer 'overBox': the picture over the chat box (under the choices). */}
      {INSET_OVER_BOX && <Inset inset={scene.inset} fadeMs={scene.insetFade} />}
      {scene.choices && !hidden && (
        <Choices
          options={scene.choices}
          timer={scene.choiceTimer}
          withLine={!!scene.line}
          // With a line the chat box has the toolbar (TextDialog.tsx); else Choice.tsx places it.
          toolbar={
            scene.line ? null : <SceneToolbar onHide={() => setHidden(true)} where="choices" />
          }
        />
      )}
      <Pictures images={scene.images} layer="top" />
      {logOpen && (
        <LogPanel
          log={scene.log}
          onClose={() => {
            // A wheel that closed the log must not also continue the line under it.
            wheelFrom.current = performance.now() + WHEEL_AFTER_LOG_MS
            setLogOpen(false)
          }}
        />
      )}
      {scene.movie && <MovieLayer key={scene.movie.id} movie={scene.movie} />}
    </Box>
  )
}
