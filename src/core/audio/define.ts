// Types for src/content/music.ts. Must not import content or the registry (the audio manager
// imports the content file).

export interface LoopPoints {
  /** Seconds from the start of the file where the repeating part begins (after the intro). */
  start?: number
  /** Seconds where it jumps back to `start`. Leave out = the end of the file. */
  end?: number
  /** 0..1 on top of the music volume. Default 1. */
  volume?: number
}

export interface MusicConfig {
  /** Default crossfade between tracks, ms. */
  fadeMs: number
  /** Per sound id ('music/town'). */
  loops: Record<string, LoopPoints>
}

export function defineMusic(config: MusicConfig): MusicConfig {
  return config
}
