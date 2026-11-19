// The chat box's wrappers, placed by src/content/ui/TextDialog.tsx (outside in):
//   <ChatBoxPlace>   where the box sits on the screen. Engine: hidden while the player hides it.
//   <ChatBoxFrame>   the box itself; parts with position: 'absolute' sit on it. Engine: its height
//                    is measured (the side image's size), data-dialog-box (tests), position: relative,
//                    room beside it for a side image placed outside the box.
//   <DialogTextArea> the text inside. Engine: room for the side image, full pages scroll to the
//                    newest line, the frame's widths and text colour.
// Everything else (where, how wide, padding) is the `sx` the content file gives them.
import { Box, type SxProps, type Theme } from '@mui/material'
import { createContext, type ReactNode, type RefObject, use } from 'react'
import { DIALOG_TEXT_BOX } from '../layers/event/shared'

export interface ChatBoxContextValue {
  /** The frame: its height is written into a CSS variable (the side image's size). */
  frameRef: RefObject<HTMLDivElement | null>
  /** The text area: scrolled to the bottom on full pages. */
  textRef: RefObject<HTMLDivElement | null>
  /** The player hid the chat box (Hide). */
  hidden: boolean
  nvl: boolean
  /** Padding that keeps the text clear of the side image (wins over the content's padding). */
  faceRoom: SxProps<Theme>
  /** Margin that keeps room beside the box for a side image placed outside it (scenes.ts sideImage.place). */
  frameRoom: SxProps<Theme>
}

export const ChatBoxContext = createContext<ChatBoxContextValue | null>(null)

type WrapperProps = { sx?: SxProps<Theme>; children: ReactNode }
const list = (sx: SxProps<Theme> | undefined) => (Array.isArray(sx) ? sx : [sx])

export function ChatBoxPlace({ sx, children }: WrapperProps) {
  const box = use(ChatBoxContext)
  return (
    // Hidden, not unmounted: the typewriter keeps its place.
    <Box sx={[...list(sx), { visibility: box?.hidden ? 'hidden' : 'visible' }]}>{children}</Box>
  )
}

export function ChatBoxFrame({ sx, children }: WrapperProps) {
  const box = use(ChatBoxContext)
  return (
    <Box
      ref={box?.frameRef}
      data-dialog-box
      sx={[...list(sx), { position: 'relative' }, ...(box ? [box.frameRoom] : [])]}
    >
      {children}
    </Box>
  )
}

export function DialogTextArea({ sx, children }: WrapperProps) {
  const box = use(ChatBoxContext)
  return (
    <Box
      ref={box?.textRef}
      sx={[
        {
          position: 'relative',
          ...(box?.nvl ? { height: '100%', overflowY: 'auto' } : {}),
          // Same frame widths, padding and text colour as the box behind; nothing drawn.
          ...DIALOG_TEXT_BOX,
          cursor: 'pointer',
        },
        ...list(sx),
        ...(box ? [box.faceRoom] : []),
      ]}
    >
      {children}
    </Box>
  )
}
