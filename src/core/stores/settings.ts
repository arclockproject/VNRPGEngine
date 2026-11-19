// Player settings. Per device and kept separate from save slots: loading a save never changes them.
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import scenes from '@/content/scenes'
import gameSettingDefaults from '@/content/settings'
import { DEFAULT_FONT, FONT_CHOICES } from '../fontList'
import { mergeGameSettings } from '../gameSettings'
import { validCursorAutoHide, validRatio } from '../layers/screen'
import { storage } from '../save/storage'
import type { SideImageShow } from '../scenes'
import type { ScreenRatio } from '../screen'

/** src/content/settings.ts: the game's own settings and their types. */
export type GameSettings = typeof gameSettingDefaults

/** Settings → Controls "Confirm with" (core/input/faceSwap.ts). */
export type ConfirmButton = 'auto' | 'bottom' | 'right'
const CONFIRM_BUTTONS: readonly ConfirmButton[] = ['auto', 'bottom', 'right']

export interface SettingsState {
  /** 0..1 each. Used by the audio manager. */
  /** 0..1 each. `movie` = movie() and the movies in Extras (on top of master). */
  volume: { master: number; music: number; sfx: number; voice: number; movie: number }
  /** Dialogue typing speed in characters per second. TEXT_SPEED_INSTANT = no typing effect. */
  textSpeed: number
  /** Start (and stay) fullscreen. F11 toggles it too. */
  fullscreen: boolean
  /** Game screen shape (choices and default: src/content/config/screen.ts). */
  screenRatio: ScreenRatio
  /** Hide the mouse cursor after this many seconds without mouse movement. 0 = never. */
  cursorAutoHide: number
  /** Dev builds only. Toggle with the ` key too. */
  showDevPanel: boolean
  /** Auto-play: pause after a line before continuing, in ms (plus a little per letter). */
  autoDelay: number
  /** Skip mode also skips lines never read before. */
  skipUnread: boolean
  /** Skip turns itself back on after the player picks an answer. */
  skipAfterChoice: boolean
  /** While skipping, fades, animations and waits finish at once (not walks on the map). */
  skipEffects: boolean
  /** 'source' (the language the game is written in) or a folder in src/content/lang. */
  language: string
  /**
   * The player's own key/button bindings, per action. Actions not listed use the defaults from
   * src/content/config/input.ts.
   */
  bindings: Record<string, { keys: string[]; buttons: number[] }>
  /** A voice clip keeps playing after the player continues (until the next clip starts). */
  voiceKeep: boolean
  /**
   * The voice language: one of src/content/scenes.ts voice.languages (not the text language).
   * New players get the first.
   */
  voiceLanguage: string
  /** Music goes quieter while a voice clip plays (how much: src/content/scenes.ts). */
  voiceDuck: boolean
  /** Voice volume per character id, 0..1 on top of the voice slider. Missing = 1. */
  voiceVolumes: Record<string, number>
  /** Characters the player muted (Settings → Voices). Their slider value is kept for unmuting. */
  voiceMuted: Record<string, boolean>
  /**
   * Who speaks the system voice (core/audio/systemVoice.ts): a character id, 'random' (a character
   * with that clip, picked each time) or 'off'.
   */
  systemVoice: string
  /** Dialogue and log text size, one of scenes.text.sizes (1 = as designed). */
  textSize: number
  /**
   * Which controller button confirms: 'bottom' (A on Xbox, ✕ on PlayStation), 'right' (A on
   * Nintendo), or 'auto' = right on Nintendo controllers, bottom on the rest. Cancel is the other one.
   */
  confirmButton: ConfirmButton
  /** The game's own settings (src/content/settings.ts): game.settings / useGameSetting(). */
  game: GameSettings
  /** A key of scenes.text.fonts or of src/content/fonts (core/fontList.ts FONT_CHOICES). */
  font: string
  /** How solid the chat box's background is, 0..1. */
  boxOpacity: number
  /** No screen shake, soft flashes, still letters. */
  reduceMotion: boolean
  /** Lines, choices and focused buttons are read aloud (where the device can). */
  selfVoicing: boolean
  /** Controller rumble and phone vibration. */
  vibration: boolean
  /** When the speaker's face shows next to the text (default: src/content/scenes.ts sideImage). */
  sideImage: SideImageShow
  /** An auto-hiding scene toolbar stays shown (its Lock button). */
  toolbarLocked: boolean
  /** The player's own minimap switch (only offered while src/content/config/screen.ts minimap.show is on). */
  showMinimap: boolean
}

export const TEXT_SPEED_INSTANT = 110
/** The choices for the side image setting. */
export const SIDE_IMAGE_SHOW: readonly SideImageShow[] = ['offstage', 'always', 'never']
const STORAGE_KEY = 'settings'

/** The device's own "reduce motion" wish, when scenes.comfort says to follow it. */
function prefersReducedMotion(): boolean {
  const choice = scenes.comfort.reduceMotionByDefault
  if (choice !== 'system') return choice
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

const defaults = (): SettingsState => ({
  volume: { master: 1, music: 0.8, sfx: 0.8, voice: 0.8, movie: 0.8 },
  textSpeed: 40,
  fullscreen: false,
  screenRatio: validRatio(undefined),
  cursorAutoHide: validCursorAutoHide(undefined),
  showDevPanel: import.meta.env.DEV,
  autoDelay: 1200,
  skipUnread: false,
  skipAfterChoice: scenes.skip.afterChoiceByDefault,
  skipEffects: true,
  language: 'source',
  bindings: {},
  voiceKeep: scenes.voice.keepByDefault,
  voiceLanguage: scenes.voice.languages[0],
  voiceDuck: scenes.voice.duckByDefault,
  voiceVolumes: {},
  voiceMuted: {},
  systemVoice: scenes.voice.system?.default ?? 'random',
  textSize: scenes.text.defaultSize,
  font: DEFAULT_FONT,
  game: { ...gameSettingDefaults },
  confirmButton: 'auto',
  boxOpacity: scenes.text.defaultBoxOpacity,
  reduceMotion: prefersReducedMotion(),
  selfVoicing: false,
  vibration: true,
  sideImage: scenes.sideImage.showByDefault,
  toolbarLocked: false,
  showMinimap: true,
})

let languageStored = false

/** Whether a language was saved on this device before (picked by the player, or on a first start). */
export function hasStoredLanguage(): boolean {
  return languageStored
}

/** Stored settings on top of the defaults, so settings added later still get a value. */
function loadSettings(): SettingsState {
  const base = defaults()
  try {
    const stored = JSON.parse(storage.get(STORAGE_KEY) ?? '{}') as Partial<SettingsState>
    languageStored = typeof stored.language === 'string'
    return {
      ...base,
      ...stored,
      screenRatio: validRatio(stored.screenRatio),
      cursorAutoHide: validCursorAutoHide(stored.cursorAutoHide),
      volume: { ...base.volume, ...stored.volume },
      bindings: { ...stored.bindings },
      voiceLanguage: scenes.voice.languages.includes(stored.voiceLanguage as string)
        ? (stored.voiceLanguage as string)
        : base.voiceLanguage,
      voiceVolumes: { ...stored.voiceVolumes },
      voiceMuted: { ...stored.voiceMuted },
      systemVoice: typeof stored.systemVoice === 'string' ? stored.systemVoice : base.systemVoice,
      textSize: scenes.text.sizes.includes(stored.textSize as number)
        ? (stored.textSize as number)
        : base.textSize,
      font: stored.font !== undefined && stored.font in FONT_CHOICES ? stored.font : base.font,
      game: mergeGameSettings(gameSettingDefaults as GameSettings, stored.game),
      confirmButton: CONFIRM_BUTTONS.includes(stored.confirmButton as ConfirmButton)
        ? (stored.confirmButton as ConfirmButton)
        : base.confirmButton,
      sideImage: SIDE_IMAGE_SHOW.includes(stored.sideImage as SideImageShow)
        ? (stored.sideImage as SideImageShow)
        : base.sideImage,
    }
  } catch {
    return base
  }
}

export const useSettingsStore = create<SettingsState>()(immer(loadSettings))

let saveTimer: ReturnType<typeof setTimeout> | undefined
useSettingsStore.subscribe((settings) => {
  // Sliders change many times per second; write once they settle.
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => storage.set(STORAGE_KEY, JSON.stringify(settings)), 300)
})
