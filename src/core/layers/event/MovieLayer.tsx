import { Box } from '@mui/material'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import scenes from '@/content/scenes'
import { MovieSkip } from '@/content/ui/MovieSkip'
import { voiceLangFile } from '../../audio/voiceClips'
import { useAction } from '../../input/useAction'
import { lang } from '../../lang'
import { endMovie } from '../../scene/director'
import type { SceneState } from '../../scene/state'
import { useSettingsStore } from '../../stores/settings'
import { useSystemStore } from '../../stores/system'

export function MovieLayer({ movie }: { movie: NonNullable<SceneState['movie']> }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [asking, setAsking] = useState(false)
  const skippable = movie.skippable ?? true
  // The Movies slider (Settings -> Audio), on top of master.
  const volume = useSettingsStore((s) => s.volume.master * s.volume.movie) * (movie.volume ?? 1)
  const paused = useSystemStore((s) => s.windows.length > 0)
  const end = () => endMovie(movie.id)
  const finished = useEffectEvent(end)

  useEffect(() => {
    if (ref.current) ref.current.volume = Math.min(1, Math.max(0, volume))
  }, [volume])

  // Plays while nothing covers it: a window (the pause menu) or a hidden tab pauses it.
  useEffect(() => {
    const video = ref.current
    if (!video) return
    const sync = () => {
      if (paused || document.hidden) video.pause()
      else
        video.play().catch(() => {
          // Sound may be refused before the player has pressed anything: play it silent.
          video.muted = true
          video.play().catch(() => finished())
        })
    }
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => document.removeEventListener('visibilitychange', sync)
  }, [paused])

  useEffect(() => {
    if (!asking) return
    const timer = setTimeout(() => setAsking(false), scenes.skip.movieButtonMs ?? 3000)
    return () => clearTimeout(timer)
  }, [asking])

  const press = () => {
    if (!skippable) return true
    if (asking) end()
    else setAsking(true)
    return true
  }
  useAction('confirm', press)
  // Nothing else of the scene reacts while the movie plays.
  useAction('up', () => true)
  useAction('back', () => true)
  useAction('hide', () => true)

  return (
    <Box
      onClick={(e) => {
        e.stopPropagation()
        press()
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      sx={{ position: 'absolute', inset: 0, bgcolor: movie.background ?? 'common.black' }}
    >
      <Box
        component="video"
        ref={ref}
        src={lang.image(voiceLangFile(movie.src))}
        playsInline
        disablePictureInPicture
        onEnded={end}
        onError={end}
        sx={{
          width: '100%',
          height: '100%',
          objectFit: movie.fit ?? 'contain',
          display: 'block',
        }}
      />
      {asking && (
        // A press on the button must not reach the movie (a tap there shows the button again).
        <Box onClick={(e) => e.stopPropagation()} sx={{ display: 'contents' }}>
          <MovieSkip skip={end} />
        </Box>
      )}
    </Box>
  )
}
