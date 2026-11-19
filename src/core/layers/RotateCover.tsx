// Phones held upright: the game is landscape only (content/config/screen.ts `landscapeOnly`). The Android
// app is locked to landscape in its manifest; in a browser the page can't turn the phone, so this
// covers the screen and asks the player to.
import { Box, useMediaQuery } from '@mui/material'
import { useEffect } from 'react'
import screen from '@/content/config/screen'
import { RotateCover as Cover } from '@/content/ui/RotateCover'

export function RotateCover() {
  // Touch devices only: a tall desktop window is the player's own choice.
  const upright = useMediaQuery('(orientation: portrait) and (pointer: coarse)')
  const show = screen.landscapeOnly && upright

  // Where the browser allows it (installed / fullscreen pages), turn the screen for them.
  useEffect(() => {
    if (!screen.landscapeOnly) return
    const orientation = window.screen?.orientation as
      | (ScreenOrientation & { lock?: (o: string) => Promise<void> })
      | undefined
    orientation?.lock?.('landscape').catch(() => {})
  }, [])

  if (!show) return null
  return (
    <Box role="alert" sx={{ position: 'fixed', inset: 0, zIndex: 100000 }}>
      <Cover />
    </Box>
  )
}
