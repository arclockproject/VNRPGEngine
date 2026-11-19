import scenes from '@/content/scenes'
import type { LineVoice } from '../audio/voiceClips'
import type { StackedPicture } from '../gallery'
import type { CharacterId } from '../registry'
import type {
  ImageOptions,
  LineStyle,
  MovieOptions,
  SceneFilter,
  StagePosition,
  TransitionName,
} from './types'

export interface SceneLine {
  /** Increases with every line, so the UI can restart its typewriter. */
  id: number
  /** Who says it; null for narration and for a line said together (see group). */
  speaker: CharacterId | null
  /** Characters saying the line together (say(['jack', 'anna'], …)): 2 or more. */
  group?: CharacterId[]
  /** Shown name: the character's name, the group's names, or style.as. */
  name: string | null
  text: string
  style: LineStyle
  /** The player has continued past it (it stays visible until the next line). */
  advanced: boolean
  /** Read before (in any playthrough): skip mode may skip it. */
  read: boolean
  /** The voice clips this line plays (the ones that are recorded), all at once. Empty = none. */
  voices: LineVoice[]
  /** Shown on a full page (nvl()) instead of the box at the bottom. */
  page?: boolean
}

/** A line already read on the current page (nvl()). */
export interface PageLine {
  id: number
  name: string | null
  color: string | null
  text: string
  style: LineStyle
  /** It had been read before (in any playthrough) when it showed. */
  read?: boolean
}

/** A free picture on the stage (image()). */
export interface SceneImage extends Required<Omit<ImageOptions, 'width' | 'height'>> {
  name: string
  src: string
  width?: number
  height?: number
  /** Fading out: removed when the fade is over. */
  leaving?: boolean
}

export interface SceneActor {
  id: CharacterId
  pose: string | null
  /** Layered portraits: single parts on top of the pose's expression. */
  parts: Record<string, string | null>
  at: StagePosition
  flip: boolean
  /** Their own filter or tint (show({ tint })): undefined = the characters' one, null = none. */
  tint?: SceneFilter | null
}

export interface LogEntry {
  name: string | null
  color: string | null
  text: string
  /** The line's voice clips, to hear it again from the log. */
  voices?: LineVoice[]
  /** Who said it. */
  speaker?: CharacterId
  /** Where in the running scene it was shown (replay run + steps so far): "Jump back here". */
  at?: { run: number; step: number }
}

export interface ChoiceView {
  label: string
  /** null = can be picked; '' = greyed out; text = greyed out with this reason. */
  disabled: string | null
  /** Picked before, in any playthrough (src/content/scenes.ts choices.markChosen). */
  chosen?: boolean
}

/** inset(): which picture (so a saved stage finds it again) and what it draws. */
export interface SceneInset {
  id: string
  variant?: string
  picture: string | StackedPicture
}

/** What the event layer shows. Part of the system store, reset after each event. */
export interface SceneState {
  line: SceneLine | null
  choices: ChoiceView[] | null
  /** Timed choice: how long, and when it started (Date.now()). */
  choiceTimer: { ms: number; startedAt: number } | null
  actors: SceneActor[]
  /** A colour, gradient or image URL, or a stacked picture (a layered CG with toggles on). */
  background: string | StackedPicture | null
  /** How long a background change takes to crossfade, in ms (0 = at once). */
  backgroundFade: number
  /** The mask the current background came in with (src/content/scenes.ts), or null = crossfade. */
  backgroundTransition: TransitionName | null
  /** bg() / cg(): which picture it is, so a saved stage finds it again (scene/stage.ts). */
  backgroundRef: { kind: 'bg' | 'cg'; id: string; variant?: string } | null
  /** inset(): the framed picture in the middle (null = none), and how long its changes fade. */
  inset: SceneInset | null
  insetFade: number
  filter: SceneFilter | null
  /** filter(…, { on: 'background' | 'characters' }): one part of the stage only. */
  partFilters: { background: SceneFilter | null; characters: SceneFilter | null }
  /** A video playing over the scene (movie()). `id` changes with every movie. */
  movie: ({ id: number; src: string } & MovieOptions) | null
  /** Recent lines across events (newest last), for the log. */
  log: LogEntry[]
  /** Free pictures (image()), in the order they were added. */
  images: SceneImage[]
  /** Weather particles over the stage (weather()). */
  weather: { kind: string; intensity: number } | null
  /** Full-page text mode (nvl()). */
  nvl: boolean
  /** The lines already read on the current page. */
  page: PageLine[]
}

export const LOG_LIMIT = scenes.text.logLines
export const DEFAULT_BACKGROUND_FADE = scenes.backgroundFadeMs

export function emptyScene(log: LogEntry[] = []): SceneState {
  return {
    line: null,
    choices: null,
    choiceTimer: null,
    actors: [],
    background: null,
    backgroundFade: DEFAULT_BACKGROUND_FADE,
    backgroundTransition: null,
    backgroundRef: null,
    inset: null,
    insetFade: 0,
    filter: null,
    partFilters: { background: null, characters: null },
    movie: null,
    log,
    images: [],
    weather: null,
    nvl: false,
    page: [],
  }
}
