// Props of the content "slots": the components in src/content/ui/ that lay out and style what the
// engine draws (the chat box, windows, choices, the toolbar, toasts, the log…). The engine keeps the
// logic and hands over ready parts or plain data. Types only. Must not import content.
import type { SxProps, Theme } from '@mui/material'
import type { ReactNode } from 'react'
import type { ChapterId } from './managers/chapters'
import type { RecipeId } from './managers/crafting'
import type { PlaceId } from './managers/travel'
import type {
  AchievementId,
  CharacterId,
  CodexId,
  EndingId,
  ItemId,
  QuestId,
  SkillId,
  WindowId,
} from './registry'

/** src/content/ui/Window.tsx: the inside of every window's frame. */
export interface WindowSlotProps {
  /** Which window it is (src/content/windows/<id>): for something on one window only. */
  id: WindowId
  /** Its title, translated. Empty while the window loads. */
  title: string
  /** Whether it has a × button (the window's `closable`). */
  closable: boolean
  /** It is the front window. */
  isTop: boolean
  /** Closes this window. */
  close: () => void
  /**
   * The window's own component (src/content/windows/<id>). Put it inside <WindowContent>
   * (@/core/ui/WindowContent), exactly once. Wrapped in another box of your own, that box needs
   * `display: 'flex', flexDirection: 'column', minHeight: 0` to keep long windows scrolling.
   */
  children: ReactNode
}

/**
 * src/content/ui/TextDialog.tsx: the chat box of events. It lays out the parts; each is placed once
 * (a part may also be left out, except `text`).
 */
export interface TextDialogSlotProps {
  /** The box's look (look.dialog, a character's chatBox), faded by "Text box opacity". */
  background: ReactNode
  /** The text that types out. Goes inside <DialogTextArea> (@/core/ui/ChatBox). */
  text: ReactNode
  /** The ▼ once the line has typed out, or null. Its corner is the DialogTextArea's. */
  continueMark: ReactNode | null
  /** The speaker's side image, or null when none shows. */
  face: ReactNode | null
  /** The speaker's name on the top edge, or null (narration, full-page text). */
  nameTag: ReactNode | null
  /**
   * Back / Auto / Skip / …: wrap it in <SceneToolbarPlace> (@/core/ui/SceneToolbarPlace), which
   * places it (its sx) and can hide it until the mouse comes near (autoHide).
   */
  toolbar: ReactNode
  /**
   * src/content/ui/VoiceBar.tsx: how long the line's voice still plays, or null on a line without a
   * voice (it draws nothing while no clip plays). Default place: the text area, above the ▼.
   */
  voiceBar: ReactNode | null
  /** Who speaks (a character id), or null. */
  speaker: CharacterId | null
  /** The name shown for the line (also "Student A" style names), or null. */
  name: string | null
  /** Full-page text (nvl()): the box covers the screen. */
  nvl: boolean
  /** The line has finished typing. */
  typed: boolean
  /** The player has read this line before (in any playthrough): draw it differently if you like. */
  read: boolean
}

/** src/content/ui/VoiceBar.tsx: the bar that shows how long the line's voice still plays. */
export interface VoiceBarSlotProps {
  /** The whole voice (its longest clip), ms. */
  durationMs: number
  /** How much of it has played already, ms (start a CSS animation this far in: a negative delay). */
  elapsedMs: number
}

/** The scene toolbar's buttons, by what they do. */
export type SceneToolbarButtonId =
  /** Opens Settings. */
  | 'settings'
  /** Only when the toolbar auto-hides (src/content/scenes.ts toolbar.autoHide): keeps it shown. */
  | 'lock'
  /** Open the Saves window to save / to load. */
  | 'save'
  | 'load'
  | 'quickSave'
  | 'quickLoad'
  /** Back again and again (a toggle) until it is pressed again, a click, or nothing is left. */
  | 'skipBack'
  /** Back to the last choice the player made: it is asked again. */
  | 'lastChoice'
  /** One line back. */
  | 'back'
  | 'auto'
  /** Skip quickly up to the next choice. */
  | 'toChoice'
  /** Skip read lines (a toggle). */
  | 'skip'
  /** Only in visual novel mode (src/content/config/mode.ts vnOnly): opens the Flowchart. */
  | 'flowchart'
  /** Plays the line's voice again (disabled on lines without one). */
  | 'replayVoice'
  /** Only with favourite voices on (scenes.ts voice.favourites): Extras on its Voices tab. */
  | 'favouriteVoices'
  | 'hide'

/** One toolbar button as the engine hands it over: draw it with <SceneToolbarButton>. */
export interface SceneToolbarButtonInfo {
  id: SceneToolbarButtonId
  /** Its name, translated ("Auto"). Also the button's accessible name when it shows an icon. */
  label: string
  /** Switched on right now (Auto playing, Skip skipping…). Always false for one-shot buttons. */
  on: boolean
  /**
   * Nothing to do right now (Replay voice on a line without a voice). <SceneToolbarButton> then
   * ignores presses; draw it faded. (Not a real disabled button: a click would go through it.)
   */
  disabled: boolean
  /** Does what the button does. <SceneToolbarButton> calls it; call it yourself only from your own control. */
  press: () => void
}

/**
 * src/content/ui/SceneToolbar.tsx: the small buttons in scenes (Back, Auto, Skip…). It lays them out
 * and decides how each looks; what they do and where the toolbar sits are the engine's.
 */
export interface SceneToolbarSlotProps {
  /** Every button, in the engine's order. Leave one out to hide it, sort them to reorder. */
  buttons: SceneToolbarButtonInfo[]
  /** 'box' = with the chat box (where TextDialog.tsx places it); 'choices' = alone in the corner while choices show. */
  where: 'box' | 'choices'
}

/** One answer of a choice, as src/content/ui/Choice.tsx gets it: draw it with <ChoiceButton>. */
export interface ChoiceAnswerInfo {
  /** Its place in the list (what picking it answers). */
  index: number
  /** Its text, translated. */
  label: string
  /** Why it can't be picked right now (shown under it), or null when it can. */
  disabled: string | null
  /** Picked before, in any playthrough (src/content/scenes.ts choices.markChosen). */
  chosen: boolean
}

/**
 * src/content/ui/Choice.tsx: the answers of a choice, its time limit, and the toolbar while no line
 * shows. Answers go inside <ChoiceList>, each a <ChoiceButton> (@/core/ui/Choice).
 */
export interface ChoiceSlotProps {
  answers: ChoiceAnswerInfo[]
  /** The time-left bar (shrinks by itself), or null without a time limit. */
  timer: ReactNode | null
  /**
   * Back / Auto / Skip / … while no line shows (else null: the chat box has it). Wrap it in
   * <SceneToolbarPlace> (@/core/ui/SceneToolbarPlace), like TextDialog.tsx does.
   */
  toolbar: ReactNode | null
  /** A line shows with the choice (its question, in the chat box). */
  withLine: boolean
}

/** src/content/ui/NameTag.tsx: the speaker's name on the chat box (not for narration, full pages). */
export interface NameTagSlotProps {
  /** The name shown (also "Student A" style names). */
  name: string
  /** Who speaks (a character id), or null. */
  speaker: CharacterId | null
  /** The character's colour (its file's `color`), or null. */
  color: string | null
  /** The character's own name-tag look (its `chatBox.name`): put it last in your sx. */
  characterLook: SxProps<Theme>
}

/** src/content/ui/ContinueMark.tsx: the ▼ once a line has typed out (only drawn then). */
export interface ContinueMarkSlotProps {
  /** Full-page text (nvl()). */
  nvl: boolean
}

/**
 * What each kind of toast is about: `params` of a toast with that `kind`. The engine's own toasts
 * use the named kinds; game.toast() without a `kind` is 'message', with any params you pass.
 */
export interface ToastKinds {
  /** game.toast() without a kind, and engine notes that need no style of their own. */
  message: Readonly<Record<string, unknown>>
  /** game.items.add(..., { notify }): how many were really added. */
  item: { item: ItemId; count: number }
  /** game.money.add(..., { notify }): how much was really added. */
  money: { amount: number }
  questNew: { quest: QuestId }
  questDone: { quest: QuestId }
  achievement: { achievement: AchievementId }
  ending: { ending: EndingId }
  /** A new journal entry. */
  codex: { entry: CodexId }
  recipe: { recipe: RecipeId }
  /** A new fast-travel place. */
  place: { place: PlaceId }
  /** A chapter begins (content/chapters.ts `announce`). */
  chapter: { chapter: ChapterId }
  partyJoin: { character: CharacterId }
  levelUp: { character: CharacterId; level: number }
  skillLearned: { character: CharacterId; skill: SkillId }
  /** game.relationships.change(..., { notify }): `change` is + or -, `value` the new total. */
  relationship: { character: CharacterId; change: number; value: number }
  /** Quick save / quick load, and saves that can't be written. */
  save: { result: 'quickSaved' | 'quickSaveFailed' | 'noQuickSave' | 'loadFailed' | 'storageFull' }
  /** `where`: the folder/file, or null when the platform doesn't say (download, share sheet). */
  screenshot: { where: string | null }
  /** An error nothing caught. `where` and `message` are shown in dev builds only. */
  error: { where: string; message: string }
}

export type ToastKind = keyof ToastKinds

/** A kind with its params: `switch (toast.kind)` and TypeScript knows the params. */
export type ToastKindParams = { [K in ToastKind]: { kind: K; params: ToastKinds[K] } }[ToastKind]

/** One message of game.toast(). */
export type ToastInfo = ToastKindParams & {
  id: number
  /** As given to game.toast() (already translated by the caller). */
  text: string
  /** A small picture (an item icon) or a symbol ('💾'), or null. */
  icon: string | null
}

/** src/content/ui/Toast.tsx: the messages showing right now, oldest first. */
export interface ToastSlotProps {
  toasts: ToastInfo[]
}

/** src/content/ui/Loading.tsx `MapLoading`: the fade between maps, and the loading screen in it. */
export interface MapLoadingSlotProps {
  /** 'out' = fading to the cover, 'loading' = covered while the map loads, 'in' = fading back in. */
  phase: 'out' | 'loading' | 'in'
  /** 0..1 while loading (0 = not known yet). */
  progress: number
  /** How long each fade takes (src/content/config/screen.ts timings), ms. */
  fadeMs: number
}

/** src/content/ui/ChapterCard.tsx (or a chapter's own `screen`): the chapter card (chapters.ts announce: 'card'). */
export interface ChapterCardSlotProps {
  /** "Chapter 2" (chapters.ts label). */
  label: string
  /** The chapter's title. */
  title: string
  /** The chapter's description (translated), or null. */
  description: string | null
  /** Its picture (already the right language's file), or null. */
  image: string | null
  /** 'screen': covers the stage (draw it solid). 'overlay': over the scene (see-through). */
  style: 'screen' | 'overlay'
  /** Fade in while true, out once false. */
  shown: boolean
  /** How long the fade takes right now (shorter when skipped; 0 with "Reduce motion"), ms. */
  fadeMs: number
  /** 'in' fading in, 'on' on screen (the steps run), 'out' fading out. */
  phase: 'in' | 'on' | 'out'
  /** Which of the card's `steps` is running (0, 1, …), like a boot screen: draw more as it grows. */
  step: number
  /** The player skipped it: show everything in its final look at once. */
  skipped: boolean
}

/** One on-screen timer (game.timers with `show`). */
export interface TimerInfo {
  id: string
  /** Its label, translated, or null. */
  label: string | null
  paused: boolean
}

/** src/content/ui/Timers.tsx: the timers on screen. Each goes in a <TimerFrame> (@/core/ui/Timers). */
export interface TimersSlotProps {
  timers: TimerInfo[]
}

/** One line of the log. Its buttons are null when it has none. */
export interface LogEntryInfo {
  /** The speaker's name, or null (narration). */
  name: string | null
  /** The speaker's colour, or null. */
  color: string | null
  text: string
  /** "Jump back here" (only lines the story can go back to). */
  jumpBack: (() => void) | null
  /** Play its voice again (voiced lines). */
  replay: (() => void) | null
  /** Favourite voice star (voiced lines, src/content/scenes.ts voice.favourites). */
  star: { on: boolean; toggle: () => void } | null
}

/**
 * src/content/ui/Log.tsx: the log (backlog). The lines go in <LogList>, each line button is a
 * <LogButton> (@/core/ui/Log): the engine scrolls the list and steps through the buttons.
 */
export interface LogSlotProps {
  entries: LogEntryInfo[]
  close: () => void
  /** Some line has a button (show a "◀ ▶ pick a line" hint). */
  hasButtons: boolean
  /** The player's text size setting (1 = normal). */
  textSize: number
}

/** One on-screen touch button (src/content/config/input.ts touchButtons, for the layer on top). */
export interface TouchButtonInfo {
  action: string
  /** Its label, translated. */
  label: string
  /** 'top-right' = asked for the top right corner; 'group' = the usual bottom right group. */
  place: 'top-right' | 'group'
}

/**
 * src/content/ui/TouchControls.tsx: the joystick and buttons on touch screens (only shown after
 * the player touches the screen, over the map and scenes). Draw them with <Joystick> and
 * <TouchButton> (@/core/ui/TouchControls).
 */
export interface TouchControlsSlotProps {
  buttons: TouchButtonInfo[]
  /** The joystick shows (on the map, not in scenes). */
  joystick: boolean
}

/**
 * src/content/ui/ImageViewer.tsx: the controls over a full-screen picture (gallery). The engine keeps
 * the picture, zoom, pan, swipe and keys. Anything clickable must be a button (ButtonBase / Button):
 * presses on buttons are not taken as a drag on the picture.
 */
export interface ImageViewerSlotProps {
  /** Under the picture, or null. */
  caption: string | null
  /** For which hints to show: touch gestures, or keys / buttons. */
  device: 'keyboard' | 'gamepad' | 'touch'
  /** More than one unlocked picture: switching is possible. */
  switchable: boolean
  /** One per picture when there are several (variants), else empty. Locked ones can't be picked. */
  variants: { locked: boolean }[]
  /** The picture on screen. */
  index: number
  select: (index: number) => void
  close: () => void
}

/** src/content/ui/MovieSkip.tsx: the skip button over a movie (shown a few seconds after a tap or key). */
export interface MovieSkipSlotProps {
  skip: () => void
}

/**
 * src/content/ui/RotateCover.tsx: covers the screen on a phone held upright (landscape-only games).
 * The engine decides when it shows and keeps it on top of everything.
 */
export type RotateCoverSlotProps = Record<string, never>

/**
 * src/content/ui/CrashNotice.tsx: shown in place of a piece of the game that crashed (a window, the
 * map, an event). Keep it plain: if it crashes too, a bare text notice shows instead.
 */
export interface CrashNoticeSlotProps {
  /** What crashed, e.g. 'window "shop"' (for dev builds). */
  label: string
  /** The error message (for dev builds). */
  message: string
  /** A dev build: show label and message; players get a plain sentence. */
  dev: boolean
  /** 'Close' (the broken window, event…) or 'Try again', or null when neither is possible. */
  action: { label: string; run: () => void } | null
}

/**
 * src/content/ui/TitleSwitcher.tsx: switching between unlocked title screens (◀ name ▶). Only drawn
 * while more than one is unlocked. The tab keys / shoulder buttons switch too (the engine's).
 */
export interface TitleSwitcherSlotProps {
  /** The title screen shown now (translated). */
  name: string
  /** Its place among the unlocked ones, from 0, and how many there are. */
  index: number
  count: number
  previous: () => void
  next: () => void
  /** False while the menu is still coming in: buttons do nothing yet (the engine makes them inert). */
  usable: boolean
}

/** src/content/ui/MusicPlayer.tsx: the music room's controls (Extras -> Music). */
export interface MusicPlayerSlotProps {
  /** The loaded track's title, or null (nothing picked yet). */
  title: string | null
  playing: boolean
  /** 'off' = stop after the track, 'one' = repeat it, 'all' = go on to the next. */
  repeat: 'off' | 'one' | 'all'
  shuffle: boolean
  /** Where it is and how long it is, ms (0 before it has loaded). */
  positionMs: number
  durationMs: number
  /** The loop part of a track with an intro, ms (null without loop points). */
  loopMs: { start: number; end: number } | null
  onToggle: () => void
  onStop: () => void
  onPrevious: () => void
  onNext: () => void
  /** Jump to a point, ms. */
  onSeek: (ms: number) => void
  onRepeat: () => void
  onShuffle: () => void
}
