// The cover while a scene fast-forwards (loading a mid-scene save, rollback). Its look:
// src/content/ui/Loading.tsx ReplayCover.
// Back (a rewind) keeps the scene on screen instead: the cover is see-through (it only catches
// clicks), and its look shows only when Back takes longer than scenes.ts log.backCoverMs.
import { Box } from '@mui/material'
import { useEffect, useState, useSyncExternalStore } from 'react'
import scenes from '@/content/scenes'
import { ReplayCover as CoverLook } from '@/content/ui/Loading'
import { isFastForward, isRewinding, onReplayChange } from '../scene/replay'
import { Z } from './zIndex'

const BACK_COVER_MS = scenes.log.backCoverMs ?? 600

export function ReplayCover() {
  const active = useSyncExternalStore(onReplayChange, isFastForward, () => false)
  const rewinding = useSyncExternalStore(onReplayChange, isRewinding, () => false)
  if (!active) return null
  return (
    <Box sx={{ position: 'absolute', inset: 0, zIndex: Z.cover }}>
      {rewinding ? <SlowBack /> : <CoverLook />}
    </Box>
  )
}

/** Back: nothing at first (the scene stays as it was), the cover's look once it takes long. */
function SlowBack() {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), BACK_COVER_MS)
    return () => clearTimeout(timer)
  }, [])
  return slow ? <CoverLook /> : null
}
