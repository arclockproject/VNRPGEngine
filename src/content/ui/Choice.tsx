// A choice on screen: its answers, the time-left bar of a timed choice, and the toolbar while no line
// shows (with a line, src/content/ui/TextDialog.tsx has it). Edit freely: where the answers sit, their
// look, spacing, the ✓ mark. Answer looks: `choice` / `choiceChosen` in src/content/look.
//
// From @/core/ui/Choice, their sx is yours; they only add what the engine needs:
//   <ChoiceList>    holds the answers (arrows / d-pad move between them, nothing focused at first)
//   <ChoiceButton>  one answer: picks it (disabled while its condition isn't met)
// The parts:
//   answers   each: index, label, disabled (why it can't be picked, or null), chosen (picked before)
//   timer     the time-left bar, or null
//   toolbar   Back / Auto / Skip / … while no line shows, or null. Place it with
//             <SceneToolbarPlace sx> (@/core/ui/SceneToolbarPlace) like TextDialog.tsx; put it in
//             the same spot so it doesn't jump between lines and choices.
//   withLine  a line (the question) shows in the chat box
import { keyframes } from '@emotion/react'
import { Box, Typography } from '@mui/material'
import scenes from '@/content/scenes'
import { SHORT_SCREEN } from '@/core/layers/screen'
import type { ChoiceSlotProps } from '@/core/slots'
import { ChoiceButton, ChoiceList } from '@/core/ui/Choice'
import { part } from '@/core/ui/part'
import { SceneToolbarPlace } from '@/core/ui/SceneToolbarPlace'

/** Each answer rises in, one after another. */
const appear = keyframes`from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: none }`

export function Choice({ answers, timer, toolbar }: ChoiceSlotProps) {
  return (
    <>
      <Box
        sx={{
          // The answers in the middle, above the chat box.
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          pt: 1,
          pb: '160px',
          [SHORT_SCREEN]: { pt: 0.5, pb: '90px' },
          // Only the answers catch clicks: the toolbar behind stays usable.
          pointerEvents: 'none',
        }}
      >
        <ChoiceList
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            width: 'min(520px, 90cqw)',
            // A long list stays on the screen: it scrolls (moving the focus scrolls it too), and on
            // a phone held sideways the answers are lower and closer together.
            maxHeight: '100%',
            overflowY: 'auto',
            px: 0.5,
            py: 0.5,
            [SHORT_SCREEN]: {
              gap: 0.75,
              '& > .MuiButton-root': { mt: 0, py: 0.25, minHeight: 0, fontSize: 13 },
            },
          }}
        >
          {timer}
          {answers.map((answer) => (
            <ChoiceButton
              key={answer.label}
              answer={answer}
              sx={{
                animation: `${appear} 250ms ease ${answer.index * 60}ms both`,
                flexDirection: 'column',
                ...(answer.chosen ? part('choiceChosen') : {}),
              }}
            >
              <span>
                {answer.chosen && scenes.choices.chosenMark}
                {answer.label}
              </span>
              {answer.disabled && (
                <Typography variant="caption" sx={{ textTransform: 'none', opacity: 0.8 }}>
                  {answer.disabled}
                </Typography>
              )}
            </ChoiceButton>
          ))}
        </ChoiceList>
      </Box>
      {toolbar && (
        // No line shows: the toolbar in the bottom right corner.
        <SceneToolbarPlace
          sx={{
            position: 'absolute',
            right: 16,
            bottom: 16,
            [SHORT_SCREEN]: { right: 8, bottom: 8 },
          }}
        >
          {toolbar}
        </SceneToolbarPlace>
      )}
    </>
  )
}
