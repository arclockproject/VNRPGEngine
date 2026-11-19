// The parts of src/content/ui/Log.tsx that the engine needs. Each sx is the content's.
//   <LogList>    the scrolling list of lines: the engine scrolls it (up / down, to the end when the
//                log opens) and a wheel turn at its end closes the log
//   <LogButton>  a button on a line (jump back, replay, star): left / right step through them and
//                confirm presses the focused one, on every device
import { Box, IconButton, type SxProps, type Theme } from '@mui/material'
import { createContext, type ReactNode, type RefObject, use } from 'react'

export const LogListRef = createContext<RefObject<HTMLDivElement | null> | null>(null)

export function LogList({ sx, children }: { sx?: SxProps<Theme>; children: ReactNode }) {
  const ref = use(LogListRef)
  return (
    <Box ref={ref} data-log-list sx={[{ overflow: 'auto' }, ...(Array.isArray(sx) ? sx : [sx])]}>
      {children}
    </Box>
  )
}

export function LogButton({
  label,
  onPress,
  pressed,
  sx,
  children,
}: {
  /** What it does, for screen readers and the mouse tooltip ("Jump back here"). */
  label: string
  onPress: () => void
  /** For an on / off button (the star). */
  pressed?: boolean
  sx?: SxProps<Theme>
  /** What it shows: a symbol, an icon. */
  children: ReactNode
}) {
  return (
    <IconButton
      size="small"
      data-voice
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onClick={onPress}
      sx={sx}
    >
      {children}
    </IconButton>
  )
}
