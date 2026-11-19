// The speaker's name on the chat box (not for narration or full-page text). Edit freely: its place,
// shape, an icon next to it. src/content/ui/TextDialog.tsx decides where in the box it goes.
// Its look is `nameTag` in src/content/look/parts.ts; a character can add its own (its file's
// chatBox.name), handed over as `characterLook`: keep it last so it wins.
import { Box } from '@mui/material'
import scenes from '@/content/scenes'
import { SHORT_SCREEN } from '@/core/layers/screen'
import type { NameTagSlotProps } from '@/core/slots'
import { part } from '@/core/ui/part'

/** A 'full' chat box (scenes.ts textBox): the name starts where the text does. */
const [LEFT, LEFT_SHORT] =
  scenes.textBox?.layout === 'full' ? (scenes.textBox.textSpace ?? [200, 110]) : [20, 12]

export function NameTag({ name, color, characterLook }: NameTagSlotProps) {
  return (
    <Box
      sx={[
        {
          // Centred on the box's top border, at the left (the toolbar is on the right).
          position: 'absolute',
          top: 0,
          left: LEFT,
          transform: 'translateY(-50%)',
          px: 2,
          py: 0.5,
          [SHORT_SCREEN]: { left: LEFT_SHORT, px: 1.5, py: 0.25 },
        },
        part('nameTag'),
        // The character's colour (its file's `color`) as the background.
        color ? { background: color } : {},
        characterLook,
      ]}
    >
      {name}
    </Box>
  )
}
