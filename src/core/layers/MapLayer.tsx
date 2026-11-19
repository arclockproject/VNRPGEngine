import { Box } from '@mui/material'
import { useEffect, useRef } from 'react'
import { reportError } from '../errors'
import { registerCameraTarget } from '../scene/effects'
import { getWorld } from '../world/getWorld'
import { Z } from './zIndex'

/** Hosts the PixiJS canvas. The World itself lives for the whole game. */
export function MapLayer() {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = host.current
    if (!el) return
    let detach: (() => void) | undefined
    let cancelled = false
    // Event camera() zooms/pans the map behind the scene too.
    const stopCamera = registerCameraTarget(el)
    getWorld()
      .then((world) => {
        if (!cancelled) detach = world.attach(el)
      })
      .catch((error: unknown) => reportError('map', error))
    return () => {
      cancelled = true
      detach?.()
      stopCamera()
    }
  }, [])

  return (
    <Box
      ref={host}
      data-no-screenshot // screenshots draw the map themselves (core/screenshot.ts)
      sx={{
        position: 'absolute',
        inset: 0,
        zIndex: Z.map,
        bgcolor: 'common.black',
        '& canvas': { display: 'block' },
      }}
    />
  )
}
