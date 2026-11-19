// The part of a window that holds its content, placed by src/content/ui/Window.tsx. It carries what
// the engine needs: the first control is focused when the window comes to the front, a controller
// can scroll it (data-window-content), and keys / buttons go to this window only (InputScope).
// Its look (padding, scrolling) is the `sx` the content file gives it.
import { Box, type SxProps, type Theme } from '@mui/material'
import { createContext, type ReactNode, use } from 'react'
import { InputScope } from '../input/useAction'
import type { WindowId } from '../registry'

/** Which window the content is in (set by the window frame, WindowLayer). */
export const WindowIdContext = createContext<WindowId | null>(null)

export function WindowContent({ sx, children }: { sx?: SxProps<Theme>; children: ReactNode }) {
  const id = use(WindowIdContext)
  return (
    <Box data-window-content sx={sx}>
      {id === null ? (
        children
      ) : (
        <InputScope layer="windows" windowId={id}>
          {children}
        </InputScope>
      )}
    </Box>
  )
}
