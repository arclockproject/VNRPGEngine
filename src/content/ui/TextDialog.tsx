// The chat box of events (say(), narrate(), full-page text). Edit freely. Its look (frame,
// background, text colours) is `dialog` in src/content/look/index.ts and parts.ts. Its layout
// ('center' / 'full', widths, spaces), the side image's place and the toolbar's place are set in
// src/content/scenes.ts (textBox, sideImage, toolbar.place): this file reads them.
//
// Three wrappers from @/core/ui/ChatBox, each once, in this order (outside in). Their sx is yours;
// they only add what the engine needs:
//   <ChatBoxPlace>    where the box sits on the screen (hides when the player presses Hide)
//   <ChatBoxFrame>    the box itself: position: 'absolute' parts sit on it (name tag, toolbar...);
//                     the engine adds room beside it for a side image placed outside the box
//   <DialogTextArea>  the text: keeps it clear of the side image, scrolls full pages
//
// The engine hands over the parts. Each goes in once:
//   background    the box's look, faded by "Text box opacity"
//   text          the typing text: must stay, inside <DialogTextArea>
//   continueMark  the ▼ when the line is done (null while typing)
//   voiceBar      how long the voice still plays (src/content/ui/VoiceBar.tsx), null without one
//   face          the side image (null when none shows)
//   nameTag       the name on the top edge (null for narration and full pages)
//   toolbar       Back / Auto / Skip / … (its buttons: src/content/ui/SceneToolbar.tsx). Wrap it in
//                 <SceneToolbarPlace sx> (@/core/ui/SceneToolbarPlace): its sx places it. While
//                 choices show without a line, src/content/ui/Choice.tsx places it instead.
// Also given: speaker, name, nvl (full-page text), typed (the line has finished typing).
//
// To add a logo in the bottom right corner of the box, put it inside <ChatBoxFrame>
// (pointerEvents: 'none' so a click still continues the text):
//   <Box component="img" src={logo} alt="" sx={{ position: 'absolute', right: 12, bottom: 12,
//     width: 40, opacity: 0.6, pointerEvents: 'none' }} />
//
// To hide the toolbar until the mouse comes near the bottom (with a Lock button), set
// toolbar.autoHide in src/content/scenes.ts.
import { Box } from '@mui/material'
import scenes from '@/content/scenes'
import { SHORT_SCREEN } from '@/core/layers/screen'
import type { TextDialogSlotProps } from '@/core/slots'
import { ChatBoxFrame, ChatBoxPlace, DialogTextArea } from '@/core/ui/ChatBox'
import { SceneToolbarPlace } from '@/core/ui/SceneToolbarPlace'

const BOX = scenes.textBox
const FULL = BOX?.layout === 'full'
const MAX_WIDTH = BOX?.maxWidth ?? 960
const [MARGIN, MARGIN_SHORT] = BOX?.margin ?? [16, 4]
const [SPACE, SPACE_SHORT] = BOX?.textSpace ?? [200, 110]
const TOOLBAR = scenes.toolbar.place ?? 'boxTop'
/** The side the side image is on: a toolbar row keeps clear of it there. */
const FACE_PAD = scenes.sideImage.side === 'left' ? 'pl' : 'pr'

export function TextDialog({
  background,
  text,
  continueMark,
  voiceBar,
  face,
  nameTag,
  toolbar,
  nvl,
}: TextDialogSlotProps) {
  // A full page (nvl) takes the whole screen; 'full' spans the bottom edge to edge.
  const full = FULL && !nvl
  return (
    <ChatBoxPlace
      sx={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        ...(nvl ? { top: 0, alignItems: 'stretch' } : {}),
        display: 'flex',
        justifyContent: 'center',
        ...(full
          ? { p: 0 }
          : {
              px: `${MARGIN}px`,
              py: { xs: 1, sm: 2 },
              // Short screens (phones held sideways): less room around it.
              [SHORT_SCREEN]: { px: `${MARGIN_SHORT}px`, py: 0.5 },
            }),
        // The toolbar under the box, in the screen's corner: room for it.
        ...(TOOLBAR === 'screen' && !nvl
          ? { pb: '50px !important', [SHORT_SCREEN]: { pb: '44px !important' } }
          : {}),
      }}
    >
      <ChatBoxFrame
        sx={{
          // A flex item that may shrink: room for a side image outside the box still fits.
          minWidth: 0,
          width: nvl ? `min(${scenes.nvl.width}cqw, 100%)` : full ? '100%' : `${MAX_WIDTH}px`,
          ...(nvl ? { mt: 2 } : {}),
        }}
      >
        {background}
        <DialogTextArea
          sx={{
            minHeight: 150,
            px: full ? `${SPACE}px` : { xs: 2, sm: 3 },
            pt: 2.5,
            pb: 2,
            // Short screens: a smaller box, so the scene stays visible.
            [SHORT_SCREEN]: {
              minHeight: 76,
              px: full ? `${SPACE_SHORT}px` : 1.5,
              pt: 2,
              pb: 1,
            },
          }}
        >
          {text}
          {continueMark}
          {voiceBar && (
            // On the right, just above the ▼.
            <Box
              sx={{
                position: 'absolute',
                right: 16,
                bottom: 34,
                [SHORT_SCREEN]: { right: 10, bottom: 22 },
              }}
            >
              {voiceBar}
            </Box>
          )}
        </DialogTextArea>
        {TOOLBAR === 'boxBottom' && !nvl && (
          // A row along the box's bottom, at the right (under the text, so the ▼ stays clear).
          // Clear of the side image: --face-room is the room a face in the box takes (0px without
          // one); in a 'full' box the face has the side's textSpace.
          <SceneToolbarPlace
            sx={{
              position: 'relative',
              display: 'flex',
              justifyContent: 'flex-end',
              px: 1.5,
              pb: 0.75,
              mt: -1,
              [FACE_PAD]: full ? `${SPACE}px` : 'var(--face-room, 0px)',
              [SHORT_SCREEN]: {
                px: 1,
                pb: 0.25,
                mt: -0.5,
                [FACE_PAD]: full ? `${SPACE_SHORT}px` : 'var(--face-room, 0px)',
              },
            }}
          >
            {toolbar}
          </SceneToolbarPlace>
        )}
        {face}
        {nameTag}
        {(TOOLBAR === 'boxTop' || nvl) && (
          // On the box's top edge, at the right.
          <SceneToolbarPlace
            sx={{
              position: 'absolute',
              top: 0,
              right: 20,
              transform: 'translateY(-50%)',
              [SHORT_SCREEN]: { right: 12 },
            }}
          >
            {toolbar}
          </SceneToolbarPlace>
        )}
      </ChatBoxFrame>
      {TOOLBAR === 'screen' && !nvl && (
        // The screen's bottom right corner, under the box.
        <SceneToolbarPlace
          sx={{
            position: 'absolute',
            right: 8,
            bottom: 4,
            [SHORT_SCREEN]: { right: 4, bottom: 2 },
          }}
        >
          {toolbar}
        </SceneToolbarPlace>
      )}
    </ChatBoxPlace>
  )
}
