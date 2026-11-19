// game.session.leave(): back to the title screen, or quit the app, with a warning about progress
// that is not saved yet.
import { audio } from '../audio/manager'
import { systemVoice } from '../audio/systemVoice'
import { t } from '../lang'
import { canQuit, quit } from '../platform'
import { save } from '../save/manager'
import { flushStorage, storage } from '../save/storage'
import { useGameStore } from '../stores/game'
import { useSystemStore } from '../stores/system'
import { dialog } from './dialog'
import { events } from './events'
import { maps } from './maps'
import { routes } from './routes'
import { windows } from './windows'

type StartFn = () => Promise<void>
let start: StartFn | undefined

/** Waits for a manual save: resolves true when saved, false if the Saves window is closed first. */
function saveFirst(): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false
    const finish = (saved: boolean) => {
      if (done) return
      done = true
      unsubscribe()
      unsubscribeSaved()
      resolve(saved)
    }
    const unsubscribe = useSystemStore.subscribe((s) => {
      if (!s.windows.some((w) => w.id === 'saves')) finish(false)
    })
    const unsubscribeSaved = save.onSaved((slot) => {
      if (slot !== 'auto') finish(true)
    })
    ;(windows.open as (id: string, params: unknown) => void)('saves', { mode: 'save' })
  })
}

async function goToTitle(): Promise<void> {
  events.abort()
  routes.stop()
  useGameStore.setState((s) => {
    s.route = null
  })
  windows.closeAll()
  useSystemStore.setState((s) => {
    s.minigame = null
  })
  await maps.unload()
  audio.stopMusic()
  audio.ambient(null)
  // Back to the start loop: title screen, then the menu (Continue, New game, …).
  if (start) void start().catch((error: unknown) => console.error('[session]', error))
}

export const session = {
  /** Straight to the title screen, without asking about unsaved progress (the game-over screen). */
  toTitle(): Promise<void> {
    return goToTitle()
  },

  /** Set once at startup (boot.tsx): the start loop that shows the title screen again. */
  setStart(fn: StartFn): void {
    start = fn
  },

  /**
   * Erases everything the game stored on this device (all save slots, settings, read lines,
   * unlocks, achievements), after asking. Then reloads the game from a clean slate.
   * Resolves false if the player cancelled.
   */
  async wipeAllData(): Promise<boolean> {
    const choice = await dialog.ask(
      t(
        'Erase all saves, progress, achievements and settings on this device? This cannot be undone.',
      ),
      { keep: t('Cancel'), erase: t('Erase everything') },
    )
    if (choice !== 'erase') return false
    // Reloading drops the in-memory stores, so nothing writes the old data back.
    storage.clear()
    await flushStorage() // desktop/Android: the files are deleted in the background
    window.location.reload()
    return true
  },

  /**
   * Leaves for the title screen ('title') or closes the app ('quit'). With unsaved progress it
   * asks first: save (if possible), leave anyway, or stay. Resolves true when it left.
   */
  async leave(kind: 'title' | 'quit'): Promise<boolean> {
    if (save.hasUnsavedChanges()) {
      const reason = save.whyCantSave()
      if (reason === null) {
        const choice = await dialog.ask(t('You have unsaved progress.'), {
          save: t('Save first'),
          leave: t('Leave without saving'),
          stay: t('Cancel'),
        })
        if (choice === 'save') {
          if (!(await saveFirst())) return false
        } else if (choice !== 'leave') return false
      } else {
        const choice = await dialog.ask(
          t("You can't save right now ({reason}). Unsaved progress will be lost.", { reason }),
          { leave: t('Leave anyway'), stay: t('Cancel') },
        )
        if (choice !== 'leave') return false
      }
    }
    if (kind === 'quit' && canQuit) {
      await systemVoice.finish() // "Goodbye!" (a Quit button with data-voice="quit") is heard first
      quit()
      return true
    }
    await goToTitle()
    return true
  },
}
