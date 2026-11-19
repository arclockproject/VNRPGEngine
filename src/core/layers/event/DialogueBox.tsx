import { Box, Paper, type SxProps, type Theme, Typography } from '@mui/material'
import { type RefObject, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import look from '@/content/look'
import scenes from '@/content/scenes'
import { ContinueMark } from '@/content/ui/ContinueMark'
import { NameTag } from '@/content/ui/NameTag'
import { SceneToolbar as SceneToolbarSlot } from '@/content/ui/SceneToolbar'
import { TextDialog } from '@/content/ui/TextDialog'
import { VoiceBar as VoiceBarSlot } from '@/content/ui/VoiceBar'
import { audio } from '../../audio/manager'
import { game } from '../../game'
import { useAction, useHeld } from '../../input/useAction'
import { useLang } from '../../lang'
import { boxLook } from '../../look'
import { setTalking } from '../../portrait/talking'
import { advance, playVoices } from '../../scene/director'
import { stagePx } from '../../scene/effects'
import { parseMarkup } from '../../scene/markup'
import { playback, usePlaybackStore } from '../../scene/playback'
import { renderMarkup, revealChar } from '../../scene/renderMarkup'
import type { PageLine, SceneLine } from '../../scene/state'
import type {
  SceneToolbarButtonId,
  SceneToolbarButtonInfo,
  SceneToolbarSlotProps,
} from '../../slots'
import { TEXT_SPEED_INSTANT, useSettingsStore } from '../../stores/settings'
import { useSystemStore } from '../../stores/system'
import { CharacterFace, hasFace } from '../../ui/CharacterFace'
import { ChatBoxContext } from '../../ui/ChatBox'
import { optionalPart, part } from '../../ui/part'
import { toolbarAutoHides } from '../../ui/SceneToolbarPlace'
import { chatBoxLooks, info, SHORT, shake, TEXT_SIZE, TEXT_SIZE_SHORT } from './shared'

/** A finished line on a full page (nvl()): the same markup as the chat box, nothing hidden. */
function PageText({ line, still }: { line: PageLine; still: boolean }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const parsed = parseMarkup(line.text, { autoPause: false })
    for (const span of renderMarkup(el, parsed.chars, { still })) revealChar(span)
  }, [line.text, still])
  return (
    <Box
      sx={{
        mb: 1.5,
        fontStyle: line.style.italic ? 'italic' : 'normal',
        ...part(line.name ? 'lineText' : 'narrationText'),
        ...(line.read ? optionalPart(line.name ? 'lineTextRead' : 'narrationTextRead') : {}),
        ...(line.style.color ? { color: line.style.color } : {}),
      }}
    >
      {line.name && <PageName name={line.name} color={line.color} />}
      <span ref={ref} />
    </Box>
  )
}

/** Who speaks, written before their line on a full page. */
function PageName({ name, color }: { name: string; color: string | null | undefined }) {
  return (
    <Box component="span" sx={{ fontWeight: 700, color: color ?? 'text.primary', mr: 1 }}>
      {name}
    </Box>
  )
}

/** Gap between the side image and the text box's edge, px (normal and short screens). */
const [FACE_INSET, FACE_INSET_SHORT] = scenes.sideImage.inset ?? [12, 6]
/** The chat box's layout (src/content/scenes.ts textBox). */
const LAYOUT = scenes.textBox?.layout ?? 'center'
/** 'full' layout: room each side of the text, px (normal and short screens). */
const [TEXT_SPACE, TEXT_SPACE_SHORT] = scenes.textBox?.textSpace ?? [200, 110]
/** Where the side image goes: in the box ('center'), beside it, or in a 'full' box's side space. */
const FACE_PLACE: 'inside' | 'outside' | 'full' =
  LAYOUT === 'full' ? 'full' : (scenes.sideImage.place ?? 'inside')

/** The side image's place across the box and its size (CSS), for one screen size. */
function facePlace(inset: number, space: number, size: string) {
  const edge = scenes.sideImage.side
  if (FACE_PLACE === 'outside')
    return { [edge]: `calc(-1 * (${size} + ${inset}px))`, width: size, height: size }
  if (FACE_PLACE === 'full') {
    // Centred in the side's textSpace, never wider than that space allows.
    const fit = `max(0px, min(${size}, ${space - 2 * inset}px))`
    return { [edge]: `calc((${space}px - ${fit}) / 2)`, width: fit, height: fit }
  }
  return { [edge]: inset, width: size, height: size }
}

/** src/content/ui/VoiceBar.tsx while the line's voice plays (nothing otherwise). */
function VoiceBarPart() {
  const span = useSyncExternalStore(audio.onVoiceSpan, audio.voiceSpan, () => null)
  if (!span) return null
  return (
    <VoiceBarSlot
      key={`${span.startedAt}:${span.endsAt}`}
      durationMs={span.endsAt - span.startedAt}
      elapsedMs={performance.now() - span.startedAt}
    />
  )
}
/** CSS variable on the box: its height in px, kept up to date by useBoxHeight. */
const BOX_HEIGHT = '--dialog-box-height'

/**
 * Side of the side image (CSS): `size` x the box's height inside the gaps, at least `minSize`
 * stage pixels, but never more than fits in the box.
 */
function sideImageSize(inset: number): string {
  const { size, minSize } = scenes.sideImage
  const room = `(var(${BOX_HEIGHT}, 150px) - ${2 * inset}px)`
  return `max(0px, min(${room}, max(${room} * ${size}, ${stagePx(minSize)})))`
}

/**
 * Writes the box's height into a CSS variable on it (straight to the DOM, no React render): the
 * side image's size depends on it, and CSS can't size a width from a height on its own here.
 */
function useBoxHeight(ref: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el && import.meta.env.DEV)
      console.warn(
        '[event] the chat box has no <ChatBoxFrame>: keep it in src/content/ui/TextDialog.tsx.',
      )
    if (!el || typeof ResizeObserver === 'undefined') return
    const write = () => el.style.setProperty(BOX_HEIGHT, `${el.offsetHeight}px`)
    write()
    const observer = new ResizeObserver(write)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
}

export function DialogueBox(props: {
  line: SceneLine
  /** Full-page text: the lines already read on this page. */
  page: PageLine[]
  /** The speaker is shown on the stage right now (the side image may hide then). */
  speakerOnStage: boolean
  continueRef: RefObject<() => boolean>
  onHide: () => void
  hidden: boolean
  onShow: () => void
}) {
  const { line } = props
  const textRef = useRef<HTMLSpanElement>(null)
  const finishRef = useRef<() => void>(() => {})
  const [typed, setTyped] = useState(false)
  const textSpeed = useSettingsStore((s) => s.textSpeed)
  const textSize = useSettingsStore((s) => s.textSize)
  const boxOpacity = useSettingsStore((s) => s.boxOpacity)
  const showSide = useSettingsStore((s) => s.sideImage)
  const still = useSettingsStore((s) => s.reduceMotion)
  const speaker = line.speaker ? info(line.speaker) : undefined
  // The speaker's own box, name tag and text looks (their character file's `chatBox`).
  const own = chatBoxLooks(line.speaker, !!line.page)

  // The line's voice clip: auto-play waits for it to end.
  const hasVoice = line.voices.length > 0
  const [voiceOver, setVoiceOver] = useState(!hasVoice)
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new line (id) starts a new clip
  useEffect(() => {
    if (!hasVoice) {
      setVoiceOver(true)
      return
    }
    setVoiceOver(!audio.voicePlaying())
    return audio.onVoice((playing) => setVoiceOver(!playing))
  }, [line.id, hasVoice])

  // Lip sync: on a voiced line the speaker's mouth moves while the clip plays (how loud decides
  // open or shut: LayeredPortraitView), and stops when it ends or the line is left.
  const voiced = hasVoice && scenes.voice.lipSync.on
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new line (id) starts a new clip
  useEffect(() => {
    if (!voiced || line.advanced) return
    // Everyone with a clip on the line (a line said together, or a second voice under it).
    const voices = line.voices.flatMap((voice) => (voice.speaker ? [voice.speaker] : []))
    const talk = (playing: boolean) => setTalking(playing ? voices : null, 'voice')
    talk(audio.voicePlaying())
    const off = audio.onVoice(talk)
    return () => {
      off()
      setTalking(null)
    }
  }, [line.id, voiced, line.speaker, line.advanced])

  // Typewriter: one span per character, written straight to the DOM (no React render per
  // character). Hidden characters keep their space, so the text never jumps while typing.
  useEffect(() => {
    const el = textRef.current
    if (!el) {
      // src/content/ui/TextDialog.tsx left out `text`: nothing to type, but the story goes on.
      if (import.meta.env.DEV)
        console.warn(
          '[event] the chat box has no `text`: keep it in src/content/ui/TextDialog.tsx.',
        )
      setTyped(true)
      return
    }
    const parsed = parseMarkup(line.text, { autoPause: !line.style.noAutoPause })
    if (import.meta.env.DEV && parsed.unknown.length > 0)
      console.warn(`[event] unknown text tags: ${parsed.unknown.join(', ')} in "${line.text}"`)
    const spans = renderMarkup(el, parsed.chars, { still })
    // A voiced line moves the mouth with its clip (the effect above), not with the typing.
    const talk = (who: readonly string[] | null) => {
      if (!voiced) setTalking(who)
    }
    // Who flaps while typing: the speaker, or everyone of a line said together.
    const typists = line.group ?? (line.speaker ? [line.speaker] : [])
    const chars = parsed.chars
    let raf = 0
    const finish = () => {
      cancelAnimationFrame(raf)
      for (const span of spans) revealChar(span)
      setTyped(true)
      talk(null)
    }
    finishRef.current = finish
    const cps =
      textSpeed >= TEXT_SPEED_INSTANT
        ? Number.POSITIVE_INFINITY
        : textSpeed * (line.style.speed ?? 1)
    if (!Number.isFinite(cps) || line.advanced) {
      finish()
      return
    }
    setTyped(false)
    // Layered portraits flap their mouth while their line types.
    talk(typists)
    // The speaker's blip sound while typing (not when the line has a voice clip). A line said
    // together blips with the first of the group.
    const blipper = line.speaker ?? line.group?.[0]
    const blip = hasVoice || !blipper ? undefined : info(blipper)?.blip
    let shown = 0
    let count = 0
    let blipped = 0
    let last = performance.now()
    /** {w=…} pauses: typing waits until this time. */
    let waitUntil = 0
    let pausedAt = -1
    const step = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      if (now < waitUntil) {
        raf = requestAnimationFrame(step)
        return
      }
      shown += dt * cps
      while (count < chars.length && count < Math.floor(shown)) {
        const next = chars[count] as (typeof chars)[number]
        if (next.pauseBefore > 0 && pausedAt !== count) {
          pausedAt = count
          waitUntil = now + next.pauseBefore
          shown = count
          talk(null)
          break
        }
        if (pausedAt === count) talk(typists)
        revealChar(spans[count] as HTMLSpanElement)
        count++
        // One blip every 2 letters, skipping spaces and punctuation.
        if (blip && count - blipped >= 2 && /\p{L}/u.test(next.char)) {
          blipped = count
          audio.sfx(blip, { volume: 0.7, rate: 0.95 + Math.random() * 0.1 })
        }
      }
      if (count >= chars.length) {
        setTyped(true)
        talk(null)
      } else {
        raf = requestAnimationFrame(step)
      }
    }
    raf = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(raf)
      talk(null)
    }
  }, [
    line.text,
    line.speaker,
    line.group?.[0],
    line.style.speed,
    hasVoice,
    voiced,
    line.advanced,
    textSpeed,
    line.style.noAutoPause,
    still,
  ])

  const onContinue = () => {
    // "Skip back" running: a click / confirm stops it where it is.
    if (usePlaybackStore.getState().back) {
      playback.stopSkipBack()
      return true
    }
    if (props.hidden) {
      props.onShow()
      return true
    }
    if (line.advanced) return false
    if (!typed) finishRef.current()
    else advance()
    return true
  }

  // Clicking anywhere on the stage continues too.
  const { continueRef } = props
  useEffect(() => {
    continueRef.current = onContinue
    return () => {
      continueRef.current = () => false
    }
  })

  useAction('confirm', () => onContinue())

  // autoAdvance: continue by itself once the text is fully shown.
  useEffect(() => {
    if (!typed || line.advanced || line.style.autoAdvance === undefined) return
    const timer = setTimeout(advance, line.style.autoAdvance)
    return () => clearTimeout(timer)
  }, [typed, line.advanced, line.style.autoAdvance])

  // Skip mode (toggle, or hold the skip key): read lines fly by. Unread ones stop it unless the
  // "skip unread" setting is on.
  const skipOn = usePlaybackStore((s) => s.skip)
  const skipFast = usePlaybackStore((s) => s.fast)
  const held = useHeld('skip')
  const skipUnread = useSettingsStore((s) => s.skipUnread)
  // A minigame opened over the scene (Extras from the toolbar): the scene waits under it.
  const covered = useSystemStore((s) => s.minigame !== null)
  const skipping = (skipOn || held) && !line.advanced && !covered
  useEffect(() => {
    if (!skipping) return
    if (!line.read && !skipUnread) {
      playback.stopSkip()
      return
    }
    // Tells the engine that skipping is running now: fades and waits finish at once.
    usePlaybackStore.setState({ active: true })
    finishRef.current()
    // "To choice" doesn't stop to show each line.
    const timer = setTimeout(advance, skipFast ? 0 : 50)
    return () => clearTimeout(timer)
  }, [skipping, skipFast, line.read, skipUnread])

  useEffect(() => () => usePlaybackStore.setState({ active: false }), [])

  // Auto-play: continue after a pause that grows a little with the length of the line.
  const auto = usePlaybackStore((s) => s.auto)
  const autoDelay = useSettingsStore((s) => s.autoDelay)
  useEffect(() => {
    if (!auto || !typed || line.advanced || !voiceOver || covered) return
    // A spoken line has had its time: only the pause follows. Others get reading time per letter.
    const letters = hasVoice ? 0 : parseMarkup(line.text).plain.length
    const timer = setTimeout(advance, autoDelay + letters * 30)
    return () => clearTimeout(timer)
  }, [auto, typed, line.advanced, line.text, hasVoice, voiceOver, autoDelay, covered])

  const style = line.style
  const nvl = !!line.page
  // Full-page text: keep the newest line in view.
  const pageRef = useRef<HTMLDivElement>(null)
  const pageLines = props.page.length
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new line or page scrolls down
  useEffect(() => {
    if (nvl) pageRef.current?.scrollTo({ top: pageRef.current.scrollHeight })
  }, [nvl, line.id, pageLines, typed])
  // The speaker's face next to the text (src/content/scenes.ts sideImage, Settings → Text).
  const side = scenes.sideImage
  const showFace =
    !nvl &&
    !!line.speaker &&
    showSide !== 'never' &&
    (showSide === 'always' || !props.speakerOnStage) &&
    hasFace(line.speaker)
  const frameRef = useRef<HTMLDivElement>(null)
  useBoxHeight(frameRef)
  const faceSize = sideImageSize(FACE_INSET)
  const faceSizeShort = sideImageSize(FACE_INSET_SHORT)

  // The parts, handed to src/content/ui/TextDialog.tsx, which lays them out.
  // The box's look on its own layer, so "Text box opacity" fades the box and not the text.
  const background = (
    <Paper
      elevation={8}
      aria-hidden
      sx={{
        position: 'absolute',
        inset: 0,
        ...boxLook(look.dialog),
        ...own.box,
        backdropFilter: 'blur(4px)',
        opacity: boxOpacity,
        ...(nvl ? part('nvlPage') : {}),
      }}
    />
  )
  // Room for the face next to the text: its side plus a gap on each side of it (DialogTextArea).
  // Only for a face inside a 'center' box: in a 'full' box the text keeps its textSpace anyway.
  const pad = side.side === 'left' ? 'pl' : 'pr'
  const faceRoom: SxProps<Theme> =
    showFace && FACE_PLACE === 'inside'
      ? {
          [pad]: `calc(${faceSize} + ${2 * FACE_INSET}px) !important`,
          [SHORT]: { [pad]: `calc(${faceSizeShort} + ${2 * FACE_INSET_SHORT}px) !important` },
        }
      : {}
  // A face outside the box: the box keeps that room free beside it, face or not (no jumping).
  const margin = side.side === 'left' ? 'ml' : 'mr'
  // --face-room: the width a face inside the box takes on its side (0px without one), for content
  // parts that must keep clear of it too (a toolbar row along the bottom: TextDialog.tsx).
  const inside = showFace && FACE_PLACE === 'inside'
  const frameRoom: SxProps<Theme> = {
    '--face-room': inside ? `calc(${faceSize} + ${2 * FACE_INSET}px)` : '0px',
    ...(FACE_PLACE === 'outside' && !nvl
      ? { [margin]: `calc(${faceSize} + ${FACE_INSET}px)` }
      : {}),
    [SHORT]: {
      '--face-room': inside ? `calc(${faceSizeShort} + ${2 * FACE_INSET_SHORT}px)` : '0px',
      ...(FACE_PLACE === 'outside' && !nvl
        ? { [margin]: `calc(${faceSizeShort} + ${FACE_INSET_SHORT}px)` }
        : {}),
    },
  }
  const text = (
    <Typography
      component="div"
      sx={{
        fontSize: `calc(${TEXT_SIZE[style.size ?? 'normal']} * ${textSize})`,
        fontStyle: style.italic ? 'italic' : 'normal',
        // Solid colours from the look (the box may be see-through): a named line (a
        // character, or "Student A") or narration. The line's own colour wins.
        ...part(line.name ? 'lineText' : 'narrationText'),
        // Read before (any playthrough): look/parts.ts lineTextRead / narrationTextRead, if set.
        ...(line.read ? optionalPart(line.name ? 'lineTextRead' : 'narrationTextRead') : {}),
        ...own.text,
        ...(style.color ? { color: style.color } : {}),
        lineHeight: 1.6,
        whiteSpace: 'pre-wrap',
        // Japanese and Chinese: no line starts with 。 or 、 and none ends with （.
        lineBreak: 'strict',
        overflowWrap: 'break-word',
        animation: style.shake && !still ? `${shake} 0.25s linear infinite` : 'none',
        // Room for ruby text ({ruby=…}) above the letters.
        '& rt': { fontSize: '0.5em', lineHeight: 1 },
        [SHORT]: {
          fontSize: `calc(${TEXT_SIZE_SHORT[style.size ?? 'normal']} * ${textSize})`,
          lineHeight: 1.45,
        },
      }}
    >
      {nvl && props.page.map((old) => <PageText key={old.id} line={old} still={still} />)}
      {nvl && line.name && <PageName name={line.name} color={speaker?.color} />}
      <span ref={textRef} />
    </Typography>
  )
  // The ▼ once the line has typed out (sits in the corner of the DialogTextArea).
  // src/content/ui/ContinueMark.tsx, once the line has typed out.
  const continueMark = typed && !line.advanced ? <ContinueMark nvl={nvl} /> : null
  const face =
    showFace && line.speaker ? (
      <Box
        aria-hidden
        data-side-image
        sx={{
          position: 'absolute',
          // Centred on the box's height; across: see facePlace.
          top: '50%',
          transform: 'translateY(-50%)',
          ...facePlace(FACE_INSET, TEXT_SPACE, faceSize),
          overflow: 'hidden',
          pointerEvents: 'none',
          [SHORT]: facePlace(FACE_INSET_SHORT, TEXT_SPACE_SHORT, faceSizeShort),
          ...part('sideImage'),
        }}
      >
        <CharacterFace id={line.speaker} pose={style.face} />
      </Box>
    ) : null
  // src/content/ui/NameTag.tsx (not for narration or full pages).
  const nameTag =
    line.name && !nvl ? (
      <NameTag
        name={line.name}
        speaker={line.speaker ?? null}
        color={speaker?.color ?? null}
        characterLook={own.name}
      />
    ) : null
  // TextDialog.tsx places it (<SceneToolbarPlace>).
  const toolbar = <SceneToolbar onHide={props.onHide} voices={line.voices} />

  return (
    <ChatBoxContext
      value={{ frameRef, textRef: pageRef, hidden: props.hidden, nvl, faceRoom, frameRoom }}
    >
      <TextDialog
        background={background}
        text={text}
        continueMark={continueMark}
        face={face}
        nameTag={nameTag}
        toolbar={toolbar}
        voiceBar={hasVoice && !nvl ? <VoiceBarPart /> : null}
        speaker={line.speaker ?? null}
        name={line.name ?? null}
        nvl={nvl}
        typed={typed}
        read={line.read}
      />
    </ChatBoxContext>
  )
}

/**
 * The scene toolbar (Back, Auto, Skip…): the engine's buttons and their state, drawn by
 * src/content/ui/SceneToolbar.tsx, in the order below. `voices` = the line's voice (Replay voice).
 */
export function SceneToolbar({
  onHide,
  where = 'box',
  voices = [],
}: {
  onHide: () => void
  where?: SceneToolbarSlotProps['where']
  voices?: SceneLine['voices']
}) {
  const t = useLang()
  const auto = usePlaybackStore((s) => s.auto)
  const skip = usePlaybackStore((s) => s.skip)
  const fast = usePlaybackStore((s) => s.fast)
  const skipBack = usePlaybackStore((s) => s.back)
  const autoHide = toolbarAutoHides()
  const locked = useSettingsStore((s) => s.toolbarLocked)
  const open = game.windows.open as (id: string, params?: unknown) => void
  const button = (
    id: SceneToolbarButtonId,
    label: string,
    press: () => void,
    state: { on?: boolean; disabled?: boolean } = {},
  ): SceneToolbarButtonInfo => ({
    id,
    label,
    press,
    on: state.on ?? false,
    disabled: state.disabled ?? false,
  })
  const buttons: SceneToolbarButtonInfo[] = [
    button('settings', t('Settings'), () => open('settings')),
    ...(autoHide
      ? [
          button(
            'lock',
            locked ? t('Unlock') : t('Lock'),
            () =>
              useSettingsStore.setState((s) => {
                s.toolbarLocked = !s.toolbarLocked
              }),
            { on: locked },
          ),
        ]
      : []),
    button('save', t('Save'), () => open('saves', { mode: 'save' })),
    button('load', t('Load'), () => open('saves', { mode: 'load' })),
    button('quickSave', t('Q.Save'), () => void game.save.quickSave()),
    button('quickLoad', t('Q.Load'), () => void game.save.quickLoad()),
    button('skipBack', t('Skip back'), playback.toggleSkipBack, { on: skipBack }),
    button('lastChoice', t('Last choice'), () => void game.save.backToChoice()),
    button('back', t('Back'), () => void game.save.rollback()),
    button('auto', t('Auto'), playback.toggleAuto, { on: auto }),
    button('toChoice', t('To choice'), playback.skipToChoice, { on: skip && fast }),
    button('skip', t('Skip'), playback.toggleSkip, { on: skip && !fast }),
    ...(game.vnOnly ? [button('flowchart', t('Flowchart'), () => open('flowchart'))] : []),
    button('replayVoice', t('Replay voice'), () => playVoices(voices), {
      disabled: voices.length === 0,
    }),
    ...(scenes.voice.favourites.on
      ? [
          button('favouriteVoices', t('Voices'), () => {
            // Extras is a full-screen minigame; the scene waits under it.
            void (game.minigames.open as (id: string, params?: unknown) => Promise<unknown>)(
              'extras',
              { tab: 'voices' },
            )
          }),
        ]
      : []),
    button('hide', t('Hide'), onHide),
  ]
  return <SceneToolbarSlot buttons={buttons} where={where} />
}
