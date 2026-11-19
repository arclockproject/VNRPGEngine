// The log (backlog): the engine keeps its keys, scrolling and the line buttons' actions;
// src/content/ui/Log.tsx draws it.
import { Box } from '@mui/material'
import { useEffect, useRef } from 'react'
import scenes from '@/content/scenes'
import { Log } from '@/content/ui/Log'
import { type LineVoice, voicesKey } from '../../audio/voiceClips'
import { getGame } from '../../gameRef'
import { useAction } from '../../input/useAction'
import { playVoices } from '../../scene/director'
import type { SceneState } from '../../scene/state'
import type { LogEntryInfo } from '../../slots'
import { usePersistentStore } from '../../stores/persistent'
import { useSettingsStore } from '../../stores/settings'
import { LogListRef } from '../../ui/Log'

export function LogPanel({ log, onClose }: { log: SceneState['log']; onClose: () => void }) {
  // "Jump back here": only lines of the scene that is running, and only while it can go back.
  // Lines of the running scene, and (in a route) of the scenes before it that are remembered.
  const canJump = (at: { run: number; step: number } | undefined) =>
    scenes.log.jumpBack && getGame().save.canJumpTo(at)
  const jump = (at: { run: number; step: number }) => {
    onClose()
    void getGame().save.rollbackTo(at)
  }
  const listRef = useRef<HTMLDivElement>(null)
  /** When the wheel last moved: only a fresh turn at the end of the list closes the log. */
  const lastWheel = useRef(0)
  const textSize = useSettingsStore((s) => s.textSize)
  const hasVoices = log.some((entry) => entry.voices || canJump(entry.at))
  // Favourite voices (src/content/scenes.ts voice.favourites): a star per voiced line.
  const stars = scenes.voice.favourites.on
  const starred = usePersistentStore((s) => s.voices)
  const isStarred = (voices: readonly LineVoice[]) => {
    const key = voicesKey(voices)
    return !!starred?.some((line) => voicesKey(line.voices) === key)
  }

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [])

  const scroll = (by: number) => {
    listRef.current?.scrollBy({ top: by })
  }
  /** Left / right step through the lines that have a voice (newest first); confirm plays one. */
  const stepVoice = (by: number) => {
    const buttons = [...(listRef.current?.querySelectorAll<HTMLElement>('[data-voice]') ?? [])]
    if (buttons.length === 0) return
    const current = buttons.indexOf(document.activeElement as HTMLElement)
    const next =
      current === -1 ? buttons.length - 1 : Math.min(buttons.length - 1, Math.max(0, current + by))
    const target = buttons[next]
    target?.focus({ focusVisible: true } as FocusOptions)
    target?.scrollIntoView({ block: 'nearest' })
  }
  // While the log is open it takes all event input.
  useAction('cancel', () => onClose())
  useAction('menu', () => onClose())
  useAction('log', () => onClose())
  useAction('confirm', (e) => {
    const focused = document.activeElement
    // The log presses the focused button itself, for every device, and takes the press: a press
    // passed on would reach the chat box behind the log (it would continue the line), and the
    // input manager stops a key the game used, so the button would never get its own click.
    if (focused instanceof HTMLElement && focused.dataset.voice !== undefined && !e.repeat)
      focused.click()
    return true
  })
  useAction('left', () => stepVoice(-1))
  useAction('right', () => stepVoice(1))
  useAction('up', () => scroll(-60))
  // Down at the end closes the log (a fresh press only: holding down to scroll stops there).
  useAction('down', (e) => {
    const list = listRef.current
    const atEnd = !list || list.scrollTop + list.clientHeight >= list.scrollHeight - 1
    if (atEnd && !e.repeat) onClose()
    else scroll(60)
  })

  const entries: LogEntryInfo[] = log.map((entry, i) => {
    const at = entry.at
    const voices = entry.voices
    return {
      name: entry.name ?? null,
      color: entry.color ?? null,
      text: entry.text,
      jumpBack: at && canJump(at) && i < log.length - 1 ? () => jump(at) : null,
      replay: voices ? () => playVoices(voices) : null,
      star:
        stars && voices
          ? {
              on: isStarred(voices),
              toggle: () =>
                getGame().extras.toggleFavouriteVoice({
                  voices,
                  name: entry.name,
                  color: entry.color,
                  text: entry.text,
                }),
            }
          : null,
    }
  })

  return (
    <Box
      data-log
      onClick={(e) => e.stopPropagation()}
      onWheel={(e) => {
        const list = listRef.current
        const now = performance.now()
        const fresh = now - lastWheel.current > 250
        lastWheel.current = now
        const atEnd = !list || list.scrollTop + list.clientHeight >= list.scrollHeight - 1
        if (scenes.wheel.closeLog && e.deltaY > 0 && atEnd && fresh) onClose()
      }}
      sx={{ position: 'absolute', inset: 0 }}
    >
      <LogListRef value={listRef}>
        <Log entries={entries} close={onClose} hasButtons={hasVoices} textSize={textSize} />
      </LogListRef>
    </Box>
  )
}
