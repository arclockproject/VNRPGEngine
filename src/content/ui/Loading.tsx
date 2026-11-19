// Loading looks. Edit freely.
//   MapLoading  the fade between maps; when a map takes a while to load, its loading screen shows
//               in the middle of it (art, tips, your own progress bar). The fade length is
//               src/content/config/screen.ts timings.
//   Loading     the small spinner while a window or minigame loads its code (usually a blink)
//   ReplayCover the cover while a scene runs again up to where a save was made (usually a blink)
import { keyframes } from '@emotion/react'
import { Box, CircularProgress, LinearProgress, Typography } from '@mui/material'
import { useLang } from '@/core/lang'
import type { MapLoadingSlotProps } from '@/core/slots'

const fadeIn = keyframes`from { opacity: 0 } to { opacity: 1 }`
const fadeOut = keyframes`from { opacity: 1 } to { opacity: 0 }`

export function MapLoading({ phase, progress, fadeMs }: MapLoadingSlotProps) {
  const t = useLang()
  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        bgcolor: 'common.black',
        // 'out' = the cover fades in, 'in' = it fades away again; covered while loading.
        animation:
          phase === 'out'
            ? `${fadeIn} ${fadeMs}ms ease both`
            : phase === 'in'
              ? `${fadeOut} ${fadeMs}ms ease both`
              : 'none',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      {phase === 'loading' && (
        <Box sx={{ width: 'min(320px, 70cqw)', textAlign: 'center' }}>
          <Typography color="text.secondary" sx={{ mb: 1 }}>
            {t('Loading…')}
          </Typography>
          {/* progress 0 = not known yet: a bar that moves by itself. */}
          <LinearProgress
            variant={progress > 0 ? 'determinate' : 'indeterminate'}
            value={progress * 100}
          />
        </Box>
      )}
    </Box>
  )
}

export function Loading() {
  return (
    <Box sx={{ display: 'grid', placeItems: 'center', p: 3 }}>
      <CircularProgress size={28} />
    </Box>
  )
}

/**
 * Covers the screen while a scene runs again up to where it was (loading a save made mid-scene,
 * Back): usually a blink. The engine decides when it shows.
 */
export function ReplayCover() {
  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        bgcolor: 'common.black',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <CircularProgress size={28} />
    </Box>
  )
}
