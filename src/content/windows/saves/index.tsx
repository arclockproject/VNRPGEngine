// Save / load: a paged grid of slots. Each box shows the save's picture with its details on top.
// Press a box to save there (empty) or to pick Load / Overwrite / Delete (filled).
// Left / right at the edge of the grid (or Q / R, LB / RB, or the arrows below) change the page.
import { Alert, Box, Button, ButtonBase, IconButton, Stack, Typography } from '@mui/material'
import { type DragEvent, useEffect, useRef, useState } from 'react'
import look from '@/content/look'
import { defineWindow, type WindowProps } from '@/core/define'
import { game } from '@/core/game'
import { useAction } from '@/core/input/useAction'
import { t as translate, useLang } from '@/core/lang'
import { SHORT_SCREEN, useShortScreen } from '@/core/layers/screen'
import { windowGapCss } from '@/core/look'
import { canShowSaveFolder, openTextFile, showSaveFolder } from '@/core/platform'
import { SAVE_NOTE_MAX, type SaveSlot, type SlotInfo, type SlotStatus } from '@/core/save/manager'
import { useSystemStore } from '@/core/stores/system'

// Boxes per page: normal screens, and short ones (phones). How many slots exist: src/content/save.
const GRID = { columns: 5, rows: 4 }
const SMALL_GRID = { columns: 4, rows: 3 }
/** Shape of one box (width / height), same as the save pictures. */
const BOX_RATIO = 16 / 9
const GAP = 8
/** The strip behind a box's text, and the text on it. */
const INFO_BACKGROUND = 'rgba(0, 0, 0, 0.55)'
const INFO_TEXT = '#fff'
/** Height the window needs besides the grid (title bar, padding, bottom row), in px. */
const AROUND = { normal: 158, short: 158 }

/** The page that was open last time, so the window comes back to it. */
let lastPage = 0

/** Slots the player saves into from this window (not the autosave or quick save). */
const isManual = (slot: SaveSlot) => slot.startsWith('slot')

function label(slot: SaveSlot) {
  if (slot === 'auto') return 'Autosave'
  if (slot === 'quick') return 'Quick save'
  return `Slot ${slot.slice(4)}`
}

function formatTime(ms: number) {
  const minutes = Math.floor(ms / 60000)
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

/** "countryside/old_town" -> "Old town". */
function prettyId(id: string | null) {
  const last = id?.split('/').at(-1)
  return last ? last.charAt(0).toUpperCase() + last.slice(1).replaceAll('_', ' ') : null
}

/** Where the save was made: the map's title, and the event's when saved during one. */
function placeName(s: SlotInfo) {
  // Saves from before titles were stored: the last part of the id ("old_town" -> "Old town").
  const event = s.eventTitle ? translate(s.eventTitle) : prettyId(s.eventId)
  const map = s.mapTitle ? translate(s.mapTitle) : (prettyId(s.mapId) ?? 'Start')
  return event ? `${map} · ${event}` : map
}

/** The save's chapter title (translated), or null when it has none. */
function chapterTitle(s: SlotInfo) {
  return game.chapters.fullTitle(s.chapter) ?? null
}

/** A blank line, the chapter title and its description (when the save has a chapter). */
function chapterLines(s: SlotInfo) {
  const chapter = game.chapters.info(s.chapter)
  if (!chapter) return []
  return [
    '',
    game.chapters.fullTitle(s.chapter) as string,
    ...(chapter.description ? [translate(chapter.description)] : []),
  ]
}

/** A small padlock (drawn, so it shows the same on every device, with or without emoji fonts). */
function LockIcon({ label }: { label: string }) {
  return (
    <Box
      component="svg"
      viewBox="0 0 12 14"
      role="img"
      aria-label={label}
      sx={{ width: '0.85em', height: '1em', verticalAlign: '-0.12em', mr: '0.3em' }}
    >
      <title>{label}</title>
      <path d="M3 6V4a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="1" y="6" width="10" height="8" rx="1.5" fill="currentColor" />
    </Box>
  )
}

/** Width of the grid: as wide as the screen allows, but never so wide that its rows don't fit. */
function gridWidth(grid: typeof GRID, around: number) {
  const gap = windowGapCss(look.windowGap)
  const shape = (grid.columns * BOX_RATIO) / grid.rows
  // The gaps between boxes are not scaled by the shape: take the row gaps off the height first, then
  // add the column gaps to the width.
  const rowGaps = (grid.rows - 1) * GAP
  const columnGaps = (grid.columns - 1) * GAP
  const byHeight = `calc((100cqh - 2 * ${gap} - ${around + rowGaps}px) * ${shape} + ${columnGaps}px)`
  return `min(calc(100cqw - 2 * ${gap} - 48px), ${byHeight})`
}

function Saves({ params }: WindowProps<{ mode: 'save' | 'load' }>) {
  const t = useLang()
  const [, refresh] = useState(0)
  const short = useShortScreen()
  const device = useSystemStore((s) => s.device)
  const gridRef = useRef<HTMLDivElement>(null)
  /** The box to focus once the new page is drawn (after a page turn with the arrows). */
  const focusNext = useRef<number | null>(null)

  const saving = params.mode === 'save'
  const grid = short ? SMALL_GRID : GRID
  const perPage = grid.columns * grid.rows
  // In the browser this is already only as many as fit in its storage (`browser` in content/save).
  const slots = game.save.slots
  const stored = game.save.storage()
  /** Where the saves are kept, shown at the bottom of the window. */
  const storedIn = {
    files: t('Saved to: files on this device'),
    browser: t('Saved to: this browser (localStorage)'),
    memory: t('Not saved: memory only'),
  }[stored.kind]
  const pages = Math.max(1, Math.ceil(slots.length / perPage))
  const [wantedPage, setPage] = useState(lastPage)
  const page = Math.min(wantedPage, pages - 1)
  lastPage = page

  const shown = slots.slice(page * perPage, (page + 1) * perPage)
  const status = new Map<SaveSlot, SlotStatus>(game.save.list(shown).map((s) => [s.slot, s]))
  const canSave = game.save.canSave()

  // A save's picture is replaced by a better one a moment after saving: draw it when it arrives.
  useEffect(() => game.save.onSaved(() => refresh((n) => n + 1)), [])

  // Web version: say once (ever, on this device) that it has fewer slots than the full game.
  useEffect(() => {
    if (!stored.limited || game.save.noticeSeen('web-slots')) return
    game.toast(
      t('The web version has fewer save slots ({count}). Use "Back up all…" to keep a copy.', {
        count: game.save.manualSlots.length,
      }),
      { ms: 8000 },
    )
  }, [stored.limited, t])

  const run = (action: () => unknown) => {
    Promise.resolve()
      .then(action)
      .catch((error: unknown) => game.toast(error instanceof Error ? error.message : String(error)))
      .finally(() => refresh((n) => n + 1))
  }

  const turn = (by: number, focusIndex?: number) => {
    const next = page + by
    if (next < 0 || next >= pages) return
    focusNext.current = focusIndex ?? null
    setPage(next)
  }

  // After a page turn with the arrows: focus the box in the same row on the new page.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the page changes
  useEffect(() => {
    const index = focusNext.current
    focusNext.current = null
    if (index === null) return
    const boxes = gridRef.current?.querySelectorAll<HTMLElement>('[data-box]')
    const box = boxes?.[Math.min(index, boxes.length - 1)]
    box?.focus({ focusVisible: true } as FocusOptions)
  }, [page])

  /** Left / right on a box at the edge of the grid turns the page. */
  const edge = (direction: 'left' | 'right') => {
    const active = document.activeElement
    if (!(active instanceof HTMLElement) || !gridRef.current?.contains(active)) return false
    const index = Number(active.dataset.box)
    const column = index % grid.columns
    const row = Math.floor(index / grid.columns)
    if (direction === 'right') {
      // The last box of a short last page counts as the edge too.
      if (column !== grid.columns - 1 && index !== shown.length - 1) return false
      turn(1, row * grid.columns)
    } else {
      if (column !== 0) return false
      turn(-1, row * grid.columns + grid.columns - 1)
    }
    return true // also on the first / last page, so focus doesn't jump to the buttons below
  }
  useAction('right', () => edge('right'))
  useAction('left', () => edge('left'))
  useAction('tabNext', () => turn(1))
  useAction('tabPrev', () => turn(-1))

  const describe = (slot: SaveSlot, s: SlotStatus) =>
    'error' in s
      ? `${label(slot)}: unreadable (${s.error})`
      : [
          // Save type, time, place / scene; below: the chapter and what it is about.
          [
            label(slot),
            formatTime(s.playtimeMs),
            formatDate(s.savedAt),
            s.gameVersion && `v${s.gameVersion}`,
          ]
            .filter(Boolean)
            .join(' · '),
          placeName(s),
          ...(s.note ? ['', `\u201C${s.note}\u201D`] : []),
          ...chapterLines(s),
          ...(s.locked ? ['', t('Locked: it cannot be overwritten or deleted.')] : []),
        ].join('\n')

  const saveTo = (slot: SaveSlot) => {
    if (!game.save.save(slot)) {
      // Possible to save, yet it wasn't stored: the browser's storage is full.
      throw new Error(
        game.save.canSave()
          ? t("Could not save: this browser's storage is full. Delete a save or export a backup.")
          : t('Could not save here right now.'),
      )
    }
    game.audio.sfx('sfx/confirm')
    game.toast(`Saved to ${label(slot)}.`)
    void game.systemVoice.play('saved') // the picked character says "Saved" (if they have that clip)
  }

  const press = (slot: SaveSlot, box: HTMLElement) => {
    const s = status.get(slot)
    const manual = isManual(slot)
    run(async () => {
      if (!s) {
        if (saving && manual) saveTo(slot)
        return
      }
      const broken = 'error' in s
      const locked = !broken && s.locked
      const options: Record<string, string> = {}
      if (saving && manual && canSave && !locked) options.overwrite = 'Overwrite'
      if (!saving && !broken) options.load = 'Load'
      // The player's own slots can carry a note and be locked against overwriting / deleting.
      if (manual && !broken) {
        options.note = s.note ? 'Edit note' : 'Add note'
        options.lock = locked ? 'Unlock' : 'Lock'
      }
      if (!locked) options.delete = 'Delete'
      options.cancel = 'Cancel'
      const choice = await game.dialog.ask(describe(slot, s), options, { title: label(slot) })
      // Back to the box it was about (the window would focus its first box otherwise).
      if (choice !== 'load' && device !== 'touch') {
        box.focus({ focusVisible: true } as FocusOptions)
      }
      if (choice === 'overwrite') saveTo(slot)
      if (choice === 'lock' && !broken) {
        game.save.setLocked(slot, !s.locked)
        game.toast(s.locked ? `Unlocked ${label(slot)}.` : `Locked ${label(slot)}.`)
      }
      if (choice === 'note' && !broken) {
        const note = await game.dialog.prompt(t('A note for this save'), {
          title: label(slot),
          default: s.note ?? '',
          maxLength: SAVE_NOTE_MAX,
          placeholder: t('e.g. before the festival'),
        })
        if (device !== 'touch') box.focus({ focusVisible: true } as FocusOptions)
        if (note !== null) game.save.setNote(slot, note)
      }
      if (choice === 'load') {
        await game.save.load(slot)
        game.systemVoice.playAfterReplay('loaded')
      }
      if (choice === 'delete') {
        const sure = await game.dialog.ask(
          `Delete ${label(slot)}? This cannot be undone.`,
          { delete: 'Delete', cancel: 'Cancel' },
          { title: label(slot) },
        )
        if (device !== 'touch') box.focus({ focusVisible: true } as FocusOptions)
        if (sure !== 'delete') return
        game.save.delete(slot)
        game.toast(`Deleted ${label(slot)}.`)
      }
    })
  }

  /** A backup (all slots + progress) replaces everything; asks first. Nothing else is imported. */
  const importText = async (name: string, text: string) => {
    const kind = game.save.fileKind(text)
    if (kind !== 'backup') {
      return game.toast(
        kind === 'save'
          ? t('"{name}" is a single save. Only a full backup ("Back up all…") can be imported.', {
              name,
            })
          : t('"{name}" is not a backup of this game.', { name }),
      )
    }
    const plan = game.save.readBackup(text)
    const date = plan.savedAt ? ` from ${new Date(plan.savedAt).toLocaleString()}` : ''
    const choice = await game.dialog.ask(
      `This replaces all saves and progress on this device (read lines, unlocks, achievements) with the backup${date}. Anything not in the backup is gone. Continue?`,
      { replace: 'Replace everything', cancel: 'Cancel' },
      { title: 'Import backup' },
    )
    if (choice !== 'replace') return
    const written = game.save.applyBackup(plan)
    game.toast(
      written.length > 0
        ? `Backup restored: ${written.length} ${written.length === 1 ? 'save' : 'saves'}.`
        : 'Backup restored (it had no saves).',
    )
  }

  // Native "Open…" dialog on desktop, the system file picker otherwise.
  const pickFile = () => {
    run(async () => {
      const file = await openTextFile()
      if (file) await importText(file.name, file.text)
    })
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) run(async () => importText(file.name, await file.text()))
  }

  const backUp = () => {
    run(async () => {
      if (await game.save.exportBackup()) game.toast('Backup exported (all saves and progress).')
    })
  }

  return (
    <Box onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <Stack spacing={1} sx={{ alignItems: 'center' }}>
        {stored.kind === 'memory' && (
          <Alert severity="warning" sx={{ py: 0, alignSelf: 'stretch' }}>
            {t('This browser stores nothing: saves are lost when the page closes. Export them.')}
          </Alert>
        )}
        {stored.failing && (
          <Alert severity="error" sx={{ py: 0, alignSelf: 'stretch' }}>
            {stored.kind === 'browser'
              ? t('Browser storage has run out. Export your saves to keep your progress.')
              : t("The save files can't be written. Check the free space on this device.")}
          </Alert>
        )}
        {saving && !canSave && (
          <Alert severity="info" sx={{ py: 0, alignSelf: 'stretch' }}>
            {t("You can't save right now.")}
          </Alert>
        )}
        <Box
          ref={gridRef}
          sx={{
            display: 'grid',
            gridTemplateColumns: `repeat(${GRID.columns}, minmax(0, 1fr))`,
            gap: `${GAP}px`,
            width: gridWidth(GRID, AROUND.normal),
            [SHORT_SCREEN]: {
              gridTemplateColumns: `repeat(${SMALL_GRID.columns}, minmax(0, 1fr))`,
              width: gridWidth(SMALL_GRID, AROUND.short),
            },
          }}
        >
          {shown.map((slot, index) => {
            const s = status.get(slot)
            const manual = isManual(slot)
            const useless = !s && !(saving && manual && canSave)
            const good = s && !('error' in s) ? s : null
            return (
              <ButtonBase
                key={slot}
                data-box={index}
                data-sound={saving && !s ? 'none' : undefined}
                aria-disabled={useless || undefined}
                focusRipple
                onClick={(e) => press(slot, e.currentTarget)}
                sx={{
                  containerType: 'inline-size',
                  aspectRatio: String(BOX_RATIO),
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: 1,
                  border: 1,
                  borderStyle: s ? 'solid' : 'dashed',
                  borderColor: 'divider',
                  bgcolor: 'action.hover',
                  backgroundImage: good?.thumbnail ? `url("${good.thumbnail}")` : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  opacity: useless ? 0.45 : 1,
                  cursor: useless ? 'default' : 'pointer',
                  '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main' },
                }}
              >
                {good && good.cycle > 0 && (
                  // A save from a New Game+ playthrough: a small tag in the top left corner.
                  <Box
                    sx={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      px: '3cqw',
                      py: '1.5cqw',
                      borderBottomRightRadius: 4,
                      fontSize: 'clamp(9px, 6.2cqw, 15px)',
                      fontWeight: 700,
                      lineHeight: 1.25,
                      background: INFO_BACKGROUND,
                      color: INFO_TEXT,
                    }}
                  >
                    {t('NG+')}
                  </Box>
                )}
                <Box
                  sx={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    px: '4cqw',
                    py: '2cqw',
                    textAlign: 'left',
                    fontSize: 'clamp(9px, 6.2cqw, 15px)',
                    lineHeight: 1.25,
                    ...(s ? { background: INFO_BACKGROUND, color: INFO_TEXT } : {}),
                  }}
                >
                  <Typography noWrap sx={{ font: 'inherit', fontWeight: 700 }}>
                    {good?.locked && <LockIcon label={t('Locked')} />}
                    {label(slot)}
                    {good && ` · ${chapterTitle(good) ?? placeName(good)}`}
                  </Typography>
                  <Typography noWrap sx={{ font: 'inherit', opacity: s ? 0.9 : 0.7 }}>
                    {!s
                      ? t('Empty')
                      : good
                        ? good.note
                          ? `\u201C${good.note}\u201D`
                          : `${formatTime(good.playtimeMs)} · ${formatDate(good.savedAt)}`
                        : t('Unreadable')}
                  </Typography>
                </Box>
              </ButtonBase>
            )
          })}
        </Box>

        <Stack
          direction="row"
          spacing={1}
          sx={{ alignSelf: 'stretch', alignItems: 'center', whiteSpace: 'nowrap' }}
        >
          <Button size="small" variant="outlined" onClick={backUp}>
            {t('Back up all…')}
          </Button>
          {!saving && (
            <Button size="small" variant="outlined" onClick={pickFile}>
              {t('Import backup…')}
            </Button>
          )}
          {canShowSaveFolder && (
            <Button size="small" onClick={() => run(showSaveFolder)}>
              {t('Open folder')}
            </Button>
          )}
          <Typography
            variant="caption"
            noWrap
            sx={{ flex: 1, minWidth: 0, px: 1, textAlign: 'center', color: 'text.secondary' }}
          >
            {storedIn}
          </Typography>
          <IconButton
            size="small"
            aria-label="Previous page"
            disabled={page === 0}
            onClick={() => turn(-1)}
          >
            ◀
          </IconButton>
          <Typography variant="body2" aria-label="Page">
            {page + 1} / {pages}
          </Typography>
          <IconButton
            size="small"
            aria-label="Next page"
            disabled={page === pages - 1}
            onClick={() => turn(1)}
          >
            ▶
          </IconButton>
        </Stack>
      </Stack>
    </Box>
  )
}

export default defineWindow({ title: 'Saves', component: Saves, width: 320 })
