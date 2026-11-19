// The inside of every window (src/content/windows/*, also the confirm and text input ones): its
// title bar and the box with its content. Edit freely. The frame around it (picture, background,
// size) is `window` / `panel` in src/content/look/index.ts.
//
// <WindowContent> must stay (once): it is where keys, buttons and focus reach the window. Its sx
// is yours: padding, scrolling (keep overflowY: 'auto' so long windows scroll).
// The window is position: relative, so position: 'absolute' here sits on the window itself, e.g.
// a logo in the bottom right corner:
//   <Box component="img" src={logo} alt="" sx={{ position: 'absolute', right: 12, bottom: 12,
//     width: 48, opacity: 0.5, pointerEvents: 'none' }} />
// Only on one window: {id === 'settings' && …}. Something that should not scroll away (a
// footer) goes outside <WindowContent>.
import { Box, IconButton, Typography } from '@mui/material'
import type { WindowSlotProps } from '@/core/slots'
import { WindowContent } from '@/core/ui/WindowContent'

export function Window({ title, closable, isTop, close, children }: WindowSlotProps) {
  return (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          pl: 2,
          pr: 0.5,
          py: 0.5,
          userSelect: 'none',
          borderBottom: 1,
          borderColor: 'divider',
          opacity: isTop ? 1 : 0.7,
        }}
      >
        <Typography variant="subtitle1" sx={{ flex: 1 }} noWrap>
          {title}
        </Typography>
        {closable && (
          <IconButton size="small" aria-label="Close" onClick={close}>
            ✕
          </IconButton>
        )}
      </Box>
      <WindowContent sx={{ p: 2, overflowX: 'hidden', overflowY: 'auto' }}>
        {children}
      </WindowContent>
    </>
  )
}
