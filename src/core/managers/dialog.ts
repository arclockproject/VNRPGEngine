// game.dialog.ask(): a small question with buttons (a window). Resolves with the chosen key,
// or null when the window is closed without a choice (✕, Escape, or it was replaced).
// game.dialog.prompt(): asks for a line of text (a name). Keyboard, touch and controller.
import { useSystemStore } from '../stores/system'
import { windows } from './windows'

const WINDOW = 'confirm'
const TEXT_WINDOW = 'textinput'
let instance = 0

export interface PromptOptions {
  title?: string
  /** What the field starts with. */
  default?: string
  /** Most characters allowed. Default 16. */
  maxLength?: number
  placeholder?: string
  /** false = no Cancel button and no ✕: the player has to answer. Default true. */
  cancellable?: boolean
}

/** What the text input window gets (src/content/windows/textinput). */
export interface TextInputParams extends PromptOptions {
  id: number
  /** Already translated. */
  message: string
  answer: (value: string | null) => void
}

export const dialog = {
  ask<K extends string>(
    message: string,
    options: Record<K, string>,
    settings: { title?: string } = {},
  ): Promise<K | null> {
    return new Promise((resolve) => {
      let finished = false
      const finish = (value: K | null) => {
        if (finished) return
        finished = true
        unsubscribe()
        resolve(value)
      }
      // Closing the window any other way (✕, Escape) counts as no answer.
      const unsubscribe = useSystemStore.subscribe((s) => {
        if (!s.windows.some((w) => w.id === WINDOW)) finish(null)
      })
      const id = ++instance
      const params = {
        id,
        title: settings.title,
        message,
        options,
        answer: (key: string) => {
          finish(key as K)
          windows.close(WINDOW)
        },
      }
      ;(windows.open as (id: string, params: unknown) => void)(WINDOW, params)
    })
  },

  /**
   * Asks the player to type a line of text. Resolves with it (trimmed, may be empty), or null when
   * they cancel. On a controller the window shows its own keys; a phone opens its keyboard.
   */
  prompt(message: string, options: PromptOptions = {}): Promise<string | null> {
    return new Promise((resolve) => {
      let finished = false
      const finish = (value: string | null) => {
        if (finished) return
        finished = true
        unsubscribe()
        resolve(value)
      }
      const unsubscribe = useSystemStore.subscribe((s) => {
        if (!s.windows.some((w) => w.id === TEXT_WINDOW)) finish(null)
      })
      const params: TextInputParams = {
        ...options,
        id: ++instance,
        message,
        answer: (value) => {
          finish(value === null ? null : value.trim())
          windows.close(TEXT_WINDOW)
        },
      }
      ;(windows.open as (id: string, params: unknown) => void)(TEXT_WINDOW, params)
    })
  },
}
