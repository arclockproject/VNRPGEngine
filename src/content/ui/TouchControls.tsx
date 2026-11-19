// The on-screen joystick and buttons on touch screens (shown after the player touches the screen,
// over the map and scenes; windows and minigames are tapped directly). Edit freely: where they sit,
// their sizes, symbols instead of words. Which buttons: src/content/config/input.ts touchButtons;
// joystick size: input.ts feel.joystick. Looks: touchButton / joystick / joystickKnob in look/parts.ts.
// <Joystick> and <TouchButton> (@/core/ui/TouchControls) keep the touch handling.
import { Box } from '@mui/material'
import type { TouchControlsSlotProps } from '@/core/slots'
import { part } from '@/core/ui/part'
import { Joystick, TouchButton } from '@/core/ui/TouchControls'

export function TouchControls({ buttons, joystick }: TouchControlsSlotProps) {
  const corner = buttons.filter((b) => b.place === 'top-right')
  const group = buttons.filter((b) => b.place === 'group')
  return (
    <>
      {joystick && (
        <Joystick
          sx={{
            position: 'absolute',
            left: 'max(24px, env(safe-area-inset-left))',
            bottom: 'max(24px, env(safe-area-inset-bottom))',
            ...part('joystick'),
          }}
          knobSx={part('joystickKnob')}
        />
      )}
      <Box
        sx={{
          position: 'absolute',
          right: 'max(12px, env(safe-area-inset-right))',
          top: 'max(12px, env(safe-area-inset-top))',
          display: 'flex',
          gap: 1,
        }}
      >
        {corner.map((b) => (
          <TouchButton
            key={b.action}
            button={b}
            sx={{ width: 44, height: 44, ...part('touchButton') }}
          />
        ))}
      </Box>
      <Box
        sx={{
          // The main group, bottom right: the first button is the big one.
          position: 'absolute',
          right: 'max(16px, env(safe-area-inset-right))',
          bottom: 'max(16px, env(safe-area-inset-bottom))',
          display: 'flex',
          flexDirection: 'row-reverse',
          flexWrap: 'wrap-reverse',
          gap: 1.5,
          maxWidth: 220,
          alignItems: 'center',
        }}
      >
        {group.map((b, i) => {
          const size = i === 0 ? 76 : 56
          return (
            <TouchButton
              key={b.action}
              button={b}
              sx={{ width: size, height: size, ...part('touchButton') }}
            />
          )
        })}
      </Box>
    </>
  )
}
