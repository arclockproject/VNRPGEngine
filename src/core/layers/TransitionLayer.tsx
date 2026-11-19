// The fade between maps, with a loading screen when loading takes a while: drawn by
// src/content/ui/Loading.tsx (MapLoading). The engine keeps the layer and the timing.
import { Box } from '@mui/material'
import { MapLoading } from '@/content/ui/Loading'
import { FADE_MS } from '../managers/maps'
import { useSystemStore } from '../stores/system'
import { Z } from './zIndex'

export function TransitionLayer() {
  const phase = useSystemStore((s) => s.mapTransition)
  const progress = useSystemStore((s) => s.loadingProgress)
  if (!phase) return null
  return (
    <Box data-map-transition sx={{ position: 'absolute', inset: 0, zIndex: Z.transition }}>
      <MapLoading phase={phase} progress={progress} fadeMs={FADE_MS} />
    </Box>
  )
}
